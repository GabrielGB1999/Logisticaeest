import { Router } from 'express'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { checkStockAlertas } from '../alertas.js'

const router = Router()

router.get('/', async (req, res) => {
  const db = await getDB()
  const { tipo_item, item_id, tipo, desde, hasta, limit = 50 } = req.query
  let sql = `SELECT m.*, u.nombre as responsable_nombre,
    CASE m.tipo_item
      WHEN 'herramienta' THEN (SELECT nombre FROM herramientas WHERE id = m.item_id)
      WHEN 'insumo' THEN (SELECT nombre FROM insumos WHERE id = m.item_id)
    END as item_nombre
    FROM movimientos m JOIN usuarios u ON m.responsable_id = u.id WHERE 1=1`
  const params = []
  if (tipo_item) { sql += ' AND m.tipo_item = ?'; params.push(tipo_item) }
  if (item_id) { sql += ' AND m.item_id = ?'; params.push(item_id) }
  if (tipo) { sql += ' AND m.tipo = ?'; params.push(tipo) }
  if (desde) { sql += ' AND m.fecha >= ?'; params.push(desde) }
  if (hasta) { sql += ' AND m.fecha <= ?'; params.push(hasta) }
  sql += ' ORDER BY m.fecha DESC LIMIT ?'
  params.push(Number(limit))
  res.json(await db.all(sql, params))
})

router.post('/', requirePermiso('movimientos_editar'), async (req, res) => {
  const db = await getDB()
  const { tipo_item, item_id, tipo, cantidad, motivo, destinatario, observaciones } = req.body
  if (!tipo_item || !item_id || !tipo || !cantidad)
    return res.status(400).json({ error: 'Datos incompletos' })

  const table = tipo_item === 'herramienta' ? 'herramientas' : 'insumos'
  const item = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [item_id])
  if (!item) return res.status(404).json({ error: 'Item no encontrado' })

  const nuevoStock = tipo === 'entrada'
    ? item.stock_actual + Number(cantidad)
    : item.stock_actual - Number(cantidad)
  if (nuevoStock < 0) return res.status(400).json({ error: 'Stock insuficiente' })

  await db.run('BEGIN')
  try {
    await db.run(`UPDATE ${table} SET stock_actual = ? WHERE id = ?`, [nuevoStock, item_id])
    const result = await db.run(
      'INSERT INTO movimientos (tipo_item, item_id, tipo, cantidad, motivo, responsable_id, destinatario, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [tipo_item, item_id, tipo, cantidad, motivo || null, req.user.id, destinatario || null, observaciones || null]
    )
    await db.run('COMMIT')
    await checkStockAlertas(tipo_item, item_id)
    res.status(201).json({ id: result.lastID })
  } catch (err) {
    await db.run('ROLLBACK')
    throw err
  }
})

router.delete('/:id', requirePermiso('movimientos_editar'), async (req, res) => {
  const db = await getDB()
  const movimiento = await db.get('SELECT * FROM movimientos WHERE id = ?', [req.params.id])
  if (!movimiento) return res.status(404).json({ error: 'Movimiento no encontrado' })

  const table = movimiento.tipo_item === 'herramienta' ? 'herramientas' : 'insumos'
  const item = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [movimiento.item_id])
  if (!item) return res.status(404).json({ error: 'Item asociado no encontrado' })

  const nuevoStock = movimiento.tipo === 'entrada'
    ? item.stock_actual - movimiento.cantidad
    : item.stock_actual + movimiento.cantidad

  if (nuevoStock < 0) return res.status(400).json({ error: `La eliminación dejaría el stock en negativo (${nuevoStock})` })

  await db.run('BEGIN')
  try {
    await db.run(`UPDATE ${table} SET stock_actual = ? WHERE id = ?`, [nuevoStock, item.id])
    await db.run('DELETE FROM movimientos WHERE id = ?', [req.params.id])
    await db.run('COMMIT')
    await checkStockAlertas(movimiento.tipo_item, item.id)
    res.json({ success: true })
  } catch (err) {
    await db.run('ROLLBACK')
    throw err
  }
})

router.put('/:id', requirePermiso('movimientos_editar'), async (req, res) => {
  const db = await getDB()
  const { tipo, cantidad, motivo, destinatario, observaciones } = req.body
  if (!tipo || !cantidad) return res.status(400).json({ error: 'Datos incompletos' })

  const movimiento = await db.get('SELECT * FROM movimientos WHERE id = ?', [req.params.id])
  if (!movimiento) return res.status(404).json({ error: 'Movimiento no encontrado' })

  const table = movimiento.tipo_item === 'herramienta' ? 'herramientas' : 'insumos'
  const item = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [movimiento.item_id])
  if (!item) return res.status(404).json({ error: 'Item asociado no encontrado' })

  // Revertir y aplicar
  let stockRevertido = movimiento.tipo === 'entrada'
    ? item.stock_actual - movimiento.cantidad
    : item.stock_actual + movimiento.cantidad
    
  let nuevoStock = tipo === 'entrada'
    ? stockRevertido + Number(cantidad)
    : stockRevertido - Number(cantidad)

  if (nuevoStock < 0) return res.status(400).json({ error: `La modificación dejaría el stock en negativo (${nuevoStock})` })

  await db.run('BEGIN')
  try {
    await db.run(`UPDATE ${table} SET stock_actual = ? WHERE id = ?`, [nuevoStock, item.id])
    await db.run(
      'UPDATE movimientos SET tipo = ?, cantidad = ?, motivo = ?, destinatario = ?, observaciones = ? WHERE id = ?',
      [tipo, Number(cantidad), motivo || null, destinatario || null, observaciones || null, req.params.id]
    )
    await db.run('COMMIT')
    await checkStockAlertas(movimiento.tipo_item, item.id)
    res.json({ success: true })
  } catch (err) {
    await db.run('ROLLBACK')
    throw err
  }
})

export default router
