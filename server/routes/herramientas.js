import { Router } from 'express'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { checkStockAlertas } from '../alertas.js'

const router = Router()

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
