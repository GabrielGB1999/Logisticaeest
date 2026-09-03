import { getDB } from './database.js'

export async function checkStockAlertas(tipo_item, item_id) {
  if (tipo_item === 'herramienta') return

  const db = await getDB()
  const table = 'insumos'
  const item = await db.get(`SELECT nombre, stock_actual, stock_minimo FROM ${table} WHERE id = ?`, [item_id])
  
  if (!item || item.stock_minimo <= 0) return

  if (item.stock_actual <= item.stock_minimo) {
    // Check if an unread alert already exists for this item
    const existing = await db.get(
      'SELECT id FROM alertas WHERE tipo_item = ? AND item_id = ? AND leida = 0',
      [tipo_item, item_id]
    )
    
    if (!existing) {
      const msg = `Stock bajo: ${item.nombre} (Quedan ${item.stock_actual})`
      await db.run(
        'INSERT INTO alertas (tipo_item, item_id, mensaje, leida) VALUES (?, ?, ?, 0)',
        [tipo_item, item_id, msg]
      )
    }
  }
}
