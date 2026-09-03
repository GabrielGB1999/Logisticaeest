import { Router } from 'express'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'

const router = Router()

router.get('/', async (req, res) => {
  const db = await getDB()
  const { buscar } = req.query
  if (buscar) {
    const term = `%${buscar}%`
    return res.json(await db.all(
      'SELECT * FROM docentes WHERE apellido LIKE ? OR nombre LIKE ? OR dni LIKE ? ORDER BY apellido ASC',
      [term, term, term]
    ))
  }
  res.json(await db.all('SELECT * FROM docentes ORDER BY apellido ASC'))
})

router.get('/actual/find', async (req, res) => {
  const db = await getDB()
  const { curso, grupo } = req.query
  if (!curso) return res.json(null)

  const dayOfWeek = new Date().getDay()
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
  const dia = days[dayOfWeek]

  const hour = new Date().getHours()
  let turno = 'Vespertino'
  if (hour < 13) turno = 'Mañana'
  else if (hour < 19) turno = 'Tarde'

  let sql = `
    SELECT d.* 
    FROM docente_horarios dh
    JOIN docentes d ON dh.docente_id = d.id
    WHERE dh.curso = ? AND dh.dia = ? AND dh.turno = ?
  `
  const params = [curso, dia, turno]
  
  if (grupo) {
    sql += ` AND dh.grupo = ?`
    params.push(grupo)
  } else {
    sql += ` AND (dh.grupo IS NULL OR dh.grupo = '')`
  }

  const docente = await db.get(sql, params)
  res.json(docente || null)
})

router.get('/:id', async (req, res) => {
  const db = await getDB()
  const row = await db.get('SELECT * FROM docentes WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'No encontrado' })
  res.json(row)
})

router.post('/', requirePermiso('docentes_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, apellido, dni, especialidad } = req.body
  if (!nombre || !apellido || !dni) return res.status(400).json({ error: 'nombre, apellido y dni son requeridos' })
  const exists = await db.get('SELECT id FROM docentes WHERE dni = ?', [dni])
  if (exists) return res.status(400).json({ error: 'Ya existe un docente con ese DNI' })
  const result = await db.run(
    'INSERT INTO docentes (nombre, apellido, dni, especialidad) VALUES (?, ?, ?, ?)',
    [nombre, apellido, dni, especialidad || null]
  )
  res.status(201).json({ id: result.lastID })
})

router.put('/:id', requirePermiso('docentes_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, apellido, dni, especialidad } = req.body
  if (!nombre || !apellido || !dni) return res.status(400).json({ error: 'nombre, apellido y dni son requeridos' })
  const exists = await db.get('SELECT id FROM docentes WHERE id = ?', [req.params.id])
  if (!exists) return res.status(404).json({ error: 'No encontrado' })
  await db.run(
    'UPDATE docentes SET nombre=?, apellido=?, dni=?, especialidad=? WHERE id=?',
    [nombre, apellido, dni, especialidad || null, req.params.id]
  )
  res.json({ ok: true })
})

router.delete('/:id', requirePermiso('docentes_editar'), async (req, res) => {
  const db = await getDB()
  await db.run('DELETE FROM docentes WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

router.get('/:id/horarios', async (req, res) => {
  const db = await getDB()
  res.json(await db.all('SELECT * FROM docente_horarios WHERE docente_id = ? ORDER BY dia, turno', [req.params.id]))
})

router.post('/:id/horarios', requirePermiso('docentes_editar'), async (req, res) => {
  const db = await getDB()
  const { curso, grupo, turno, dia } = req.body
  const result = await db.run(
    'INSERT INTO docente_horarios (docente_id, curso, grupo, turno, dia) VALUES (?, ?, ?, ?, ?)',
    [req.params.id, curso || null, grupo || null, turno || null, dia || null]
  )
  res.status(201).json({ id: result.lastID })
})

router.delete('/:id/horarios/:horarioId', requirePermiso('docentes_editar'), async (req, res) => {
  const db = await getDB()
  await db.run('DELETE FROM docente_horarios WHERE id = ?', [req.params.horarioId])
  res.json({ ok: true })
})

export default router
