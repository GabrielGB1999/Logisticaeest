import { getDB } from './database.js'

export async function checkStockAlertas(tipo_item, item_id) {
  if (tipo_item !== 'herramienta' && tipo_item !== 'insumo') return

  const db = await getDB()

  // Las herramientas tienen estado; los insumos no. Se normaliza con NULL para
  // poder tratar ambos casos con el mismo código más abajo.
  const item = await db.get(
    tipo_item === 'herramienta'
      ? 'SELECT nombre, stock_actual, stock_minimo, estado FROM herramientas WHERE id = ?'
      : 'SELECT nombre, stock_actual, stock_minimo, NULL AS estado FROM insumos WHERE id = ?',
    [item_id]
  )

  if (!item || item.stock_minimo <= 0) return
  // Una herramienta dada de baja ya no forma parte del inventario útil.
  if (item.estado === 'baja') return
  if (item.stock_actual > item.stock_minimo) return

  // Evitar duplicar una alerta que todavía no fue leída para el mismo item.
  const existing = await db.get(
    'SELECT id FROM alertas WHERE tipo_item = ? AND item_id = ? AND leida = 0',
    [tipo_item, item_id]
  )
  if (existing) return

  await db.run(
    'INSERT INTO alertas (tipo_item, item_id, mensaje, leida) VALUES (?, ?, ?, 0)',
    [tipo_item, item_id, `Stock bajo: ${item.nombre} (Quedan ${item.stock_actual})`]
  )
}
