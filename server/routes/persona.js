import { Router } from 'express'
import { getDB } from '../database.js'

const router = Router()

// Búsqueda unificada por DNI exacto o LIKE apellido/nombre
router.get('/lookup/:query', async (req, res) => {
  const db = await getDB()
  const q = req.params.query.trim()
  const term = `%${q}%`

  const [alumnos, docentes] = await Promise.all([
    db.all(
      'SELECT id, nombre, apellido, dni, curso, grupo, turno FROM alumnos WHERE dni = ? OR apellido LIKE ? OR nombre LIKE ? ORDER BY apellido LIMIT 10',
      [q, term, term]
    ),
    db.all(
      'SELECT id, nombre, apellido, dni, especialidad FROM docentes WHERE dni = ? OR apellido LIKE ? OR nombre LIKE ? ORDER BY apellido LIMIT 10',
      [q, term, term]
    )
  ])

  const resultado = [
    ...alumnos.map(a => ({ ...a, tipo: 'alumno' })),
    ...docentes.map(d => ({ ...d, tipo: 'docente' }))
  ]

  res.json(resultado)
})

export default router
