import { Router } from 'express'
import { getDB } from '../database.js'

const router = Router()

router.get('/', async (req, res) => {
  const db = await getDB()
  const [
    { n: totalHerramientas },
    { n: herramientasDisponibles },
    { n: herramientasEnUso },
    { n: totalInsumos },
    { n: alertasActivas },
    { n: prestamosActivos },
    { n: stockBajoHerramientas },
    { n: stockBajoInsumos },
    movimientosRecientes,
    alertasRecientes
  ] = await Promise.all([
    db.get('SELECT COUNT(*) as n FROM herramientas WHERE estado != "baja"'),
    db.get('SELECT COUNT(*) as n FROM herramientas WHERE estado = "disponible"'),
    db.get('SELECT COALESCE(SUM(cantidad), 0) as n FROM prestamos WHERE estado = "prestado" AND tipo_item = "herramienta"'),
    db.get('SELECT COUNT(*) as n FROM insumos'),
    db.get('SELECT COUNT(*) as n FROM alertas WHERE leida = 0'),
    db.get('SELECT COUNT(*) as n FROM prestamos WHERE estado = "prestado"'),
    db.get('SELECT COUNT(*) as n FROM herramientas WHERE stock_actual <= stock_minimo AND stock_minimo > 0 AND estado != "baja"'),
    db.get('SELECT COUNT(*) as n FROM insumos WHERE stock_actual <= stock_minimo AND stock_minimo > 0'),
    db.all(`
      SELECT m.*, u.nombre as responsable_nombre,
        CASE m.tipo_item
          WHEN 'herramienta' THEN (SELECT nombre FROM herramientas WHERE id = m.item_id)
          WHEN 'insumo' THEN (SELECT nombre FROM insumos WHERE id = m.item_id)
        END as item_nombre
      FROM movimientos m JOIN usuarios u ON m.responsable_id = u.id
      ORDER BY m.fecha DESC LIMIT 8
    `),
    db.all('SELECT * FROM alertas WHERE leida = 0 ORDER BY creada_el DESC LIMIT 5')
  ])

  res.json({
    totalHerramientas,
    herramientasDisponibles,
    herramientasEnUso,
    totalInsumos,
    alertasActivas,
    prestamosActivos,
    stockBajoHerramientas,
    stockBajoInsumos,
    movimientosRecientes,
    alertasRecientes
  })
})

export default router
