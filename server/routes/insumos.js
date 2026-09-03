import { Router } from 'express'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { checkStockAlertas } from '../alertas.js'

const router = Router()

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
  await db.run('DELETE FROM insumos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
