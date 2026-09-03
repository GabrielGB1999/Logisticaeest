import { Router } from 'express'
import { existsSync } from 'fs'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { checkStockAlertas } from '../alertas.js'
import { INSUMOS_XLSX, EXCEL_DIR } from '../paths.js'
import { leerPlanilla, texto, numero, resolverCategoria, ALIAS } from '../planillas.js'

const router = Router()

router.post('/import', requirePermiso('insumos_editar'), async (req, res) => {
  if (!existsSync(INSUMOS_XLSX)) {
    return res.status(404).json({ error: `No se encontró insumos.xlsx en la carpeta de planillas (${EXCEL_DIR}). Copiá la planilla ahí y volvé a intentar.` })
  }

  const db = await getDB()
  const resumen = { creados: 0, actualizados: 0, sinCodigo: 0, omitidos: 0, categoriasCreadas: [], avisos: [] }

  try {
    const filas = leerPlanilla(INSUMOS_XLSX)
    await db.run('BEGIN')

    for (const fila of filas) {
      const nombre = texto(fila, ALIAS.nombre)
      if (!nombre) { resumen.omitidos++; continue }

      const codigo = texto(fila, ALIAS.codigo)
      const categoriaNombre = texto(fila, ALIAS.categoria)
      const categoria_id = categoriaNombre ? await resolverCategoria(db, categoriaNombre, 'insumo', resumen) : null

      // Sólo se tocan las columnas que la planilla realmente trae.
      const campos = { nombre }
      const descripcion = texto(fila, ALIAS.descripcion); if (descripcion) campos.descripcion = descripcion
      const ubicacion = texto(fila, ALIAS.ubicacion); if (ubicacion) campos.ubicacion = ubicacion
      const unidad = texto(fila, ALIAS.unidad); if (unidad) campos.unidad = unidad
      const proveedor = texto(fila, ALIAS.proveedor); if (proveedor) campos.proveedor = proveedor
      if (categoria_id !== null) campos.categoria_id = categoria_id
      const stockMinimo = numero(fila, ALIAS.stockMinimo); if (stockMinimo !== null) campos.stock_minimo = stockMinimo

      const existente = codigo ? await db.get('SELECT id FROM insumos WHERE codigo = ?', [codigo]) : null

      if (existente) {
        // stock_actual queda afuera a propósito: lo mantienen los movimientos y
        // los préstamos, y la planilla suele estar atrasada.
        const cols = Object.keys(campos)
        await db.run(
          `UPDATE insumos SET ${cols.map(c => `${c}=?`).join(', ')} WHERE id = ?`,
          [...cols.map(c => campos[c]), existente.id]
        )
        await checkStockAlertas('insumo', existente.id)
        resumen.actualizados++
      } else {
        if (!codigo) resumen.sinCodigo++
        const stockActual = numero(fila, ALIAS.stockActual, 0)
        const r = await db.run(
          'INSERT INTO insumos (nombre, descripcion, categoria_id, codigo, unidad, stock_actual, stock_minimo, ubicacion, proveedor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [nombre, campos.descripcion ?? null, campos.categoria_id ?? null, codigo || null,
           campos.unidad ?? 'unidad', stockActual, campos.stock_minimo ?? 0,
           campos.ubicacion ?? null, campos.proveedor ?? null]
        )
        await checkStockAlertas('insumo', r.lastID)
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
  const partes = [`${resumen.creados} creados`, `${resumen.actualizados} actualizados`]
  if (resumen.omitidos) partes.push(`${resumen.omitidos} omitidos (sin nombre)`)
  if (resumen.categoriasCreadas.length) partes.push(`categorías nuevas: ${resumen.categoriasCreadas.join(', ')}`)
  res.json({ message: `Importación terminada. ${partes.join(', ')}.`, ...resumen })
})


router.get('/', async (req, res) => {
  const db = await getDB()
  const { buscar, categoria } = req.query
  let sql = 'SELECT i.*, c.nombre as categoria_nombre, c.color as categoria_color FROM insumos i LEFT JOIN categorias c ON i.categoria_id = c.id WHERE 1=1'
  const params = []
  if (buscar) { sql += ' AND (i.nombre LIKE ? OR i.codigo LIKE ?)'; params.push(`%${buscar}%`, `%${buscar}%`) }
  if (categoria) { sql += ' AND i.categoria_id = ?'; params.push(categoria) }
  sql += ' ORDER BY i.nombre ASC'
  res.json(await db.all(sql, params))
})

router.get('/codigo/:codigo', async (req, res) => {
  const db = await getDB()
  const item = await db.get(
    'SELECT i.*, c.nombre as categoria_nombre FROM insumos i LEFT JOIN categorias c ON i.categoria_id = c.id WHERE i.codigo = ?',
    [req.params.codigo]
  )
  if (!item) return res.status(404).json({ error: 'No encontrado' })
  res.json(item)
})

router.get('/:id', async (req, res) => {
  const db = await getDB()
  const item = await db.get(
    'SELECT i.*, c.nombre as categoria_nombre FROM insumos i LEFT JOIN categorias c ON i.categoria_id = c.id WHERE i.id = ?',
    [req.params.id]
  )
  if (!item) return res.status(404).json({ error: 'No encontrado' })
  res.json(item)
})

router.post('/', requirePermiso('insumos_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, descripcion, categoria_id, codigo, unidad, stock_actual, stock_minimo, ubicacion, proveedor } = req.body
  if (!nombre) return res.status(400).json({ error: 'Nombre requerido' })
  // codigo es UNIQUE: sin este control el INSERT rompe con SQLITE_CONSTRAINT y
  // el usuario recibe un 500 sin explicación.
  if (codigo) {
    const dup = await db.get('SELECT id FROM insumos WHERE codigo = ?', [codigo])
    if (dup) return res.status(400).json({ error: `Ya existe un insumo con el código ${codigo}` })
  }
  const result = await db.run(
    'INSERT INTO insumos (nombre, descripcion, categoria_id, codigo, unidad, stock_actual, stock_minimo, ubicacion, proveedor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [nombre, descripcion || null, categoria_id || null, codigo || null, unidad || 'unidad', stock_actual ?? 0, stock_minimo ?? 0, ubicacion || null, proveedor || null]
  )
  await checkStockAlertas('insumo', result.lastID)
  res.status(201).json({ id: result.lastID })
})

router.put('/:id', requirePermiso('insumos_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, descripcion, categoria_id, codigo, unidad, stock_actual, stock_minimo, ubicacion, proveedor } = req.body
  const exists = await db.get('SELECT id FROM insumos WHERE id = ?', [req.params.id])
  if (!exists) return res.status(404).json({ error: 'No encontrado' })
  if (codigo) {
    const dup = await db.get('SELECT id FROM insumos WHERE codigo = ? AND id != ?', [codigo, req.params.id])
    if (dup) return res.status(400).json({ error: `Ya existe un insumo con el código ${codigo}` })
  }
  await db.run(
    'UPDATE insumos SET nombre=?, descripcion=?, categoria_id=?, codigo=?, unidad=?, stock_actual=?, stock_minimo=?, ubicacion=?, proveedor=? WHERE id=?',
    [nombre, descripcion || null, categoria_id || null, codigo || null, unidad, stock_actual, stock_minimo, ubicacion || null, proveedor || null, req.params.id]
  )
  await checkStockAlertas('insumo', req.params.id)
  res.json({ ok: true })
})

router.delete('/:id', requirePermiso('insumos_editar'), async (req, res) => {
  const db = await getDB()
  const exists = await db.get('SELECT id FROM insumos WHERE id = ?', [req.params.id])
  if (!exists) return res.status(404).json({ error: 'No encontrado' })
  const abiertos = await db.get(
    "SELECT COUNT(*) as n FROM prestamos WHERE tipo_item = 'insumo' AND item_id = ? AND estado = 'prestado'",
    [req.params.id]
  )
  if (abiertos.n > 0) {
    return res.status(400).json({ error: `No se puede eliminar: hay ${abiertos.n} préstamo(s) sin devolver de este insumo` })
  }
  await db.run('DELETE FROM insumos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
