import { Router } from 'express'
import XLSX from 'xlsx'
import { existsSync } from 'fs'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { ALUMNOS_XLSX, EXCEL_DIR } from '../paths.js'
import { leerPlanilla, texto, clavesDe, ALIAS } from '../planillas.js'

const router = Router()

// Separa "Perez, Maria Luz" en apellido y nombre. Corta en la PRIMERA coma:
// todo lo que sigue es el nombre, así un "Perez, Maria, Luz" no pierde "Luz".
function partirApellidoNombre(completo) {
  const coma = completo.indexOf(',')
  if (coma === -1) return { apellido: completo.trim(), nombre: '' }
  return { apellido: completo.slice(0, coma).trim(), nombre: completo.slice(coma + 1).trim() }
}

// Formato viejo, sin encabezados: se saltean dos filas y las columnas están en
// posiciones fijas (A=DNI, B="Apellido, Nombre", C=curso, D=grupo). Se mantiene
// para que las planillas que ya se venían usando sigan funcionando.
function leerFormatoPosicional(rutaArchivo) {
  const libro = XLSX.readFile(rutaArchivo)
  const filas = []
  for (const nombreHoja of libro.SheetNames) {
    const datos = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { header: 'A', range: 2 })
    for (const fila of datos) {
      const dni = String(fila.A ?? '').trim()
      const completo = String(fila.B ?? '').trim()
      if (!dni || !completo) continue
      filas.push({ dni, ...partirApellidoNombre(completo), curso: String(fila.C ?? '').trim(), grupo: String(fila.D ?? '').trim(), turno: '' })
    }
  }
  return filas
}

// Formato nuevo: columnas reconocidas por el nombre del encabezado. Admite
// apellido y nombre en columnas separadas, o juntos en una sola columna.
function leerFormatoPorEncabezados(rutaArchivo) {
  const crudas = leerPlanilla(rutaArchivo, clavesDe(
    ALIAS.dni, ALIAS.apellido, ALIAS.nombreAlumno, ALIAS.apellidoNombre, ALIAS.curso, ALIAS.grupo, ALIAS.turno
  ))
  return crudas.map(fila => {
    const dni = texto(fila, ALIAS.dni)
    let apellido = texto(fila, ALIAS.apellido)
    let nombre = texto(fila, ALIAS.nombreAlumno)

    // Si vienen juntos en una sola columna hay que partirlos. Ojo: "nombre" es
    // alias tanto de la columna de nombre de pila como de "nombre completo",
    // así que si no hay columna de apellido propia se trata como combinada.
    if (!apellido) {
      const combinado = texto(fila, ALIAS.apellidoNombre) || nombre
      const partido = partirApellidoNombre(combinado)
      apellido = partido.apellido
      nombre = partido.nombre
    }

    return { dni, apellido, nombre, curso: texto(fila, ALIAS.curso), grupo: texto(fila, ALIAS.grupo), turno: texto(fila, ALIAS.turno) }
  }).filter(a => a.dni && a.apellido)
}

router.post('/import', requirePermiso('alumnos_editar'), async (req, res) => {
  if (!existsSync(ALUMNOS_XLSX)) {
    return res.status(404).json({ error: `No se encontró alumnos.xlsx en la carpeta de planillas (${EXCEL_DIR}). Copiá la planilla ahí y volvé a intentar.` })
  }

  const resumen = { creados: 0, actualizados: 0, omitidos: 0, formato: 'encabezados', avisos: [] }
  let db

  try {
    let filas = leerFormatoPorEncabezados(ALUMNOS_XLSX)

    // Sin encabezados reconocibles se prueba el formato viejo de posiciones
    // fijas, para no romper las planillas que ya estaban en uso.
    if (filas.length === 0) {
      filas = leerFormatoPosicional(ALUMNOS_XLSX)
      resumen.formato = 'posicional'
      if (filas.length > 0) {
        resumen.avisos.push('No se encontraron encabezados, así que se leyó con el formato viejo (A=DNI, B="Apellido, Nombre", C=curso, D=grupo, salteando dos filas). Poniéndole encabezados a la planilla el orden de las columnas deja de importar.')
      }
    }

    if (filas.length === 0) {
      return res.status(400).json({ error: 'No se pudo leer ninguna fila. Revisá que la primera fila tenga los encabezados (dni, apellido, nombre, curso, grupo) y que haya datos debajo.' })
    }

    db = await getDB()
    await db.run('BEGIN')

    for (const a of filas) {
      if (!a.dni || !a.apellido) { resumen.omitidos++; continue }

      const existente = await db.get('SELECT id FROM alumnos WHERE dni = ?', [a.dni])

      // Sólo se tocan las columnas que la planilla realmente trae: si no hay
      // columna de turno, se conserva el que esté cargado a mano.
      const campos = { apellido: a.apellido, nombre: a.nombre }
      if (a.curso) campos.curso = a.curso
      if (a.grupo) campos.grupo = a.grupo
      if (a.turno) campos.turno = a.turno

      if (existente) {
        // Se actualiza en lugar de reemplazar: la fila conserva su id y con él
        // los préstamos que la referencian (prestamos.persona_id no tiene
        // clave foránea que los proteja).
        const cols = Object.keys(campos)
        await db.run(`UPDATE alumnos SET ${cols.map(c => `${c}=?`).join(', ')} WHERE id = ?`, [...cols.map(c => campos[c]), existente.id])
        resumen.actualizados++
      } else {
        await db.run(
          'INSERT INTO alumnos (dni, apellido, nombre, curso, grupo, turno) VALUES (?, ?, ?, ?, ?, ?)',
          [a.dni, a.apellido, a.nombre, campos.curso ?? null, campos.grupo ?? null, campos.turno ?? 'Mañana']
        )
        resumen.creados++
      }
    }

    await db.run('COMMIT')
  } catch (err) {
    if (db) await db.run('ROLLBACK').catch(() => {})
    return res.status(400).json({ error: `No se pudo importar: ${err.message}` })
  }

  const partes = [`${resumen.creados} creados`, `${resumen.actualizados} actualizados`]
  if (resumen.omitidos) partes.push(`${resumen.omitidos} omitidos (sin DNI o sin apellido)`)
  res.json({ message: `Importación terminada. ${partes.join(', ')}.`, ...resumen })
})

router.get('/', async (req, res) => {
  const db = await getDB()
  const { buscar, page = 1, limit = 100 } = req.query
  const offset = (Number(page) - 1) * Number(limit)
  const term = `%${buscar || ''}%`
  const [rows, countRow] = await Promise.all([
    db.all(
      'SELECT * FROM alumnos WHERE apellido LIKE ? OR nombre LIKE ? OR dni LIKE ? ORDER BY apellido ASC LIMIT ? OFFSET ?',
      [term, term, term, Number(limit), offset]
    ),
    db.get(
      'SELECT COUNT(*) as total FROM alumnos WHERE apellido LIKE ? OR nombre LIKE ? OR dni LIKE ?',
      [term, term, term]
    )
  ])
  res.json({ data: rows, total: countRow.total, page: Number(page) })
})

router.get('/:id', async (req, res) => {
  const db = await getDB()
  const row = await db.get('SELECT * FROM alumnos WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'No encontrado' })
  res.json(row)
})

router.post('/', requirePermiso('alumnos_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, apellido, dni, curso, grupo, turno } = req.body
  if (!nombre || !apellido || !dni) return res.status(400).json({ error: 'nombre, apellido y dni son requeridos' })
  const exists = await db.get('SELECT id FROM alumnos WHERE dni = ?', [dni])
  if (exists) return res.status(400).json({ error: 'Ya existe un alumno con ese DNI' })
  const result = await db.run(
    'INSERT INTO alumnos (nombre, apellido, dni, curso, grupo, turno) VALUES (?, ?, ?, ?, ?, ?)',
    [nombre, apellido, dni, curso || null, grupo || null, turno || 'Mañana']
  )
  res.status(201).json({ id: result.lastID })
})

router.put('/:id', requirePermiso('alumnos_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, apellido, dni, curso, grupo, turno } = req.body
  if (!nombre || !apellido || !dni) return res.status(400).json({ error: 'nombre, apellido y dni son requeridos' })
  const exists = await db.get('SELECT id FROM alumnos WHERE id = ?', [req.params.id])
  if (!exists) return res.status(404).json({ error: 'No encontrado' })
  await db.run(
    'UPDATE alumnos SET nombre=?, apellido=?, dni=?, curso=?, grupo=?, turno=? WHERE id=?',
    [nombre, apellido, dni, curso || null, grupo || null, turno || 'Mañana', req.params.id]
  )
  res.json({ ok: true })
})

router.delete('/:id', requirePermiso('alumnos_editar'), async (req, res) => {
  const db = await getDB()
  const alumno = await db.get('SELECT id FROM alumnos WHERE id = ?', [req.params.id])
  if (!alumno) return res.status(404).json({ error: 'No encontrado' })
  // prestamos.persona_id no tiene clave foránea: si se borra el alumno, los
  // préstamos sin devolver quedan apuntando a una fila inexistente.
  const abiertos = await db.get(
    "SELECT COUNT(*) as n FROM prestamos WHERE persona_tipo = 'alumno' AND persona_id = ? AND estado = 'prestado'",
    [req.params.id]
  )
  if (abiertos.n > 0) {
    return res.status(400).json({ error: `No se puede eliminar: el alumno tiene ${abiertos.n} préstamo(s) sin devolver` })
  }
  await db.run('DELETE FROM alumnos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
