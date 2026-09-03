import { Router } from 'express'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'

const router = Router()

router.get('/', async (req, res) => {
  const db = await getDB()
  const { solo_no_leidas } = req.query
  let sql = `SELECT a.*,
    CASE a.tipo_item
      WHEN 'herramienta' THEN (SELECT nombre FROM herramientas WHERE id = a.item_id)
      WHEN 'insumo' THEN (SELECT nombre FROM insumos WHERE id = a.item_id)
    END as item_nombre
    FROM alertas a WHERE 1=1`
  if (solo_no_leidas === '1') sql += ' AND a.leida = 0'
  sql += ' ORDER BY a.creada_el DESC LIMIT 100'
  res.json(await db.all(sql))
})

router.get('/count', async (req, res) => {
  const db = await getDB()
  const row = await db.get('SELECT COUNT(*) as total FROM alertas WHERE leida = 0')
  res.json(row)
})

router.put('/leer-todas', requirePermiso('alertas_gestionar'), async (req, res) => {
  const db = await getDB()
  await db.run('UPDATE alertas SET leida = 1 WHERE leida = 0')
  res.json({ ok: true })
})

router.put('/:id/leer', requirePermiso('alertas_ver'), async (req, res) => {
  const db = await getDB()
  await db.run('UPDATE alertas SET leida = 1 WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

router.delete('/:id', requirePermiso('alertas_gestionar'), async (req, res) => {
  const db = await getDB()
  await db.run('DELETE FROM alertas WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
