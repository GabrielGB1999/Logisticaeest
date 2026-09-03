import { Router } from 'express'
import { existsSync } from 'fs'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { checkStockAlertas } from '../alertas.js'
import { HERRAMIENTAS_XLSX, EXCEL_DIR } from '../paths.js'
import { leerPlanilla, texto, numero, resolverCategoria, estadoValido, ALIAS } from '../planillas.js'

const router = Router()

router.post('/import', requirePermiso('herramientas_editar'), async (req, res) => {
  if (!existsSync(HERRAMIENTAS_XLSX)) {
    return res.status(404).json({ error: `No se encontró herramientas.xlsx en la carpeta de planillas (${EXCEL_DIR}). Copiá la planilla ahí y volvé a intentar.` })
  }

  const db = await getDB()
  const resumen = { creados: 0, actualizados: 0, sinCodigo: 0, omitidos: 0, categoriasCreadas: [], avisos: [] }

  try {
    const filas = leerPlanilla(HERRAMIENTAS_XLSX)
    await db.run('BEGIN')

    for (const fila of filas) {
      const nombre = texto(fila, ALIAS.nombre)
      if (!nombre) { resumen.omitidos++; continue }

      const codigo = texto(fila, ALIAS.codigo)
      const categoriaNombre = texto(fila, ALIAS.categoria)
      const categoria_id = categoriaNombre ? await resolverCategoria(db, categoriaNombre, 'herramienta', resumen) : null

      // Sólo se tocan las columnas que la planilla realmente trae: así una
      // planilla con pocas columnas no borra los datos cargados a mano.
      const campos = { nombre }
      const descripcion = texto(fila, ALIAS.descripcion); if (descripcion) campos.descripcion = descripcion
      const ubicacion = texto(fila, ALIAS.ubicacion); if (ubicacion) campos.ubicacion = ubicacion
      if (categoria_id !== null) campos.categoria_id = categoria_id
      const estadoTexto = texto(fila, ALIAS.estado); if (estadoTexto) campos.estado = estadoValido(estadoTexto, resumen)
      const stockMinimo = numero(fila, ALIAS.stockMinimo); if (stockMinimo !== null) campos.stock_minimo = stockMinimo

      const existente = codigo ? await db.get('SELECT id FROM herramientas WHERE codigo = ?', [codigo]) : null

      if (existente) {
        // stock_actual queda afuera a propósito: es el dato vivo que mantienen
        // los movimientos y los préstamos, y la planilla suele estar atrasada.
        const cols = Object.keys(campos)
        await db.run(
          `UPDATE herramientas SET ${cols.map(c => `${c}=?`).join(', ')} WHERE id = ?`,
          [...cols.map(c => campos[c]), existente.id]
        )
        await checkStockAlertas('herramienta', existente.id)
        resumen.actualizados++
      } else {
        if (!codigo) resumen.sinCodigo++
        const stockActual = numero(fila, ALIAS.stockActual, 1)
        const r = await db.run(
          'INSERT INTO herramientas (nombre, descripcion, categoria_id, codigo, estado, ubicacion, stock_actual, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [nombre, campos.descripcion ?? null, campos.categoria_id ?? null, codigo || null,
           campos.estado ?? 'disponible', campos.ubicacion ?? null, stockActual, campos.stock_minimo ?? 1]
        )
        await checkStockAlertas('herramienta', r.lastID)
        resumen.creados++
      }
    }

    await db.run('COMMIT')
  } catch (err) {
    await db.run('ROLLBACK').catch(() => {})
    return res.status(400).json({ error: `No se pudo importar: ${err.message}` })
  }

  if (resumen.sinCodigo > 0) {
    resumen.avisos.push(`${resumen.sinCodigo} fila(s) sin código se agregaron como nuevas. Sin código no se pueden reconocer: si volvés a importar la misma planilla se van a duplicar.`)
  }
  const partes = [`${resumen.creados} creadas`, `${resumen.actualizados} actualizadas`]
  if (resumen.omitidos) partes.push(`${resumen.omitidos} omitidas (sin nombre)`)
  if (resumen.categoriasCreadas.length) partes.push(`categorías nuevas: ${resumen.categoriasCreadas.join(', ')}`)
  res.json({ message: `Importación terminada. ${partes.join(', ')}.`, ...resumen })
})


router.get('/', async (req, res) => {
  const db = await getDB()
  const { buscar, categoria, estado } = req.query
  let sql = `SELECT h.*, c.nombre as categoria_nombre, c.color as categoria_color,
    (h.stock_actual - COALESCE((SELECT SUM(cantidad) FROM prestamos p WHERE p.item_id = h.id AND p.tipo_item = 'herramienta' AND p.estado = 'prestado'), 0)) as stock_disponible
    FROM herramientas h LEFT JOIN categorias c ON h.categoria_id = c.id WHERE 1=1`
  const params = []
  if (buscar) { sql += ' AND (h.nombre LIKE ? OR h.codigo LIKE ?)'; params.push(`%${buscar}%`, `%${buscar}%`) }
  if (categoria) { sql += ' AND h.categoria_id = ?'; params.push(categoria) }
  if (estado) { sql += ' AND h.estado = ?'; params.push(estado) }
  sql += ' ORDER BY h.nombre ASC'
  res.json(await db.all(sql, params))
})

router.get('/codigo/:codigo', async (req, res) => {
  const db = await getDB()
  const item = await db.get(
    `SELECT h.*, c.nombre as categoria_nombre,
     (h.stock_actual - COALESCE((SELECT SUM(cantidad) FROM prestamos p WHERE p.item_id = h.id AND p.tipo_item = 'herramienta' AND p.estado = 'prestado'), 0)) as stock_disponible
     FROM herramientas h LEFT JOIN categorias c ON h.categoria_id = c.id WHERE h.codigo = ?`,
    [req.params.codigo]
  )
  if (!item) return res.status(404).json({ error: 'No encontrado' })
  res.json(item)
})

router.get('/:id', async (req, res) => {
  const db = await getDB()
  const item = await db.get(
    `SELECT h.*, c.nombre as categoria_nombre,
     (h.stock_actual - COALESCE((SELECT SUM(cantidad) FROM prestamos p WHERE p.item_id = h.id AND p.tipo_item = 'herramienta' AND p.estado = 'prestado'), 0)) as stock_disponible
     FROM herramientas h LEFT JOIN categorias c ON h.categoria_id = c.id WHERE h.id = ?`,
    [req.params.id]
  )
  if (!item) return res.status(404).json({ error: 'No encontrado' })
  res.json(item)
})

router.post('/', requirePermiso('herramientas_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, descripcion, categoria_id, codigo, estado, ubicacion, stock_actual, stock_minimo } = req.body
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' })
  // codigo es UNIQUE: sin este control el INSERT rompe con SQLITE_CONSTRAINT y
  // el usuario recibe un 500 sin explicación.
  if (codigo) {
    const dup = await db.get('SELECT id FROM herramientas WHERE codigo = ?', [codigo])
    if (dup) return res.status(400).json({ error: `Ya existe una herramienta con el código ${codigo}` })
  }
  const result = await db.run(
    'INSERT INTO herramientas (nombre, descripcion, categoria_id, codigo, estado, ubicacion, stock_actual, stock_minimo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [nombre, descripcion || null, categoria_id || null, codigo || null, estado || 'disponible', ubicacion || null, stock_actual ?? 1, stock_minimo ?? 1]
  )
  await checkStockAlertas('herramienta', result.lastID)
  res.status(201).json({ id: result.lastID })
})

router.put('/:id', requirePermiso('herramientas_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, descripcion, categoria_id, codigo, estado, ubicacion, stock_actual, stock_minimo } = req.body
  const exists = await db.get('SELECT id FROM herramientas WHERE id = ?', [req.params.id])
  if (!exists) return res.status(404).json({ error: 'No encontrado' })
  if (codigo) {
    const dup = await db.get('SELECT id FROM herramientas WHERE codigo = ? AND id != ?', [codigo, req.params.id])
    if (dup) return res.status(400).json({ error: `Ya existe una herramienta con el código ${codigo}` })
  }
  await db.run(
    'UPDATE herramientas SET nombre=?, descripcion=?, categoria_id=?, codigo=?, estado=?, ubicacion=?, stock_actual=?, stock_minimo=? WHERE id=?',
    [nombre, descripcion || null, categoria_id || null, codigo || null, estado, ubicacion || null, stock_actual, stock_minimo, req.params.id]
  )
  await checkStockAlertas('herramienta', req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', requirePermiso('herramientas_editar'), async (req, res) => {
  const db = await getDB()
  const exists = await db.get('SELECT id FROM herramientas WHERE id = ?', [req.params.id])
  if (!exists) return res.status(404).json({ error: 'No encontrado' })
  const abiertos = await db.get(
    "SELECT COUNT(*) as n FROM prestamos WHERE tipo_item = 'herramienta' AND item_id = ? AND estado = 'prestado'",
    [req.params.id]
  )
  if (abiertos.n > 0) {
    return res.status(400).json({ error: `No se puede eliminar: hay ${abiertos.n} préstamo(s) sin devolver de esta herramienta` })
  }
  await db.run('DELETE FROM herramientas WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
