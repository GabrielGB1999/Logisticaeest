import { Router } from 'express'
import { getDB } from '../database.js'

const router = Router()

router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim()
  if (q.length < 2) return res.json({ results: [] })

  const db = await getDB()
  const like = `%${q}%`

  const [herramientas, insumos, alumnos, docentes] = await Promise.all([
    db.all(
      `SELECT id, nombre, codigo, estado FROM herramientas
       WHERE (nombre LIKE ? OR codigo LIKE ?) AND estado != 'baja' LIMIT 4`,
      [like, like]
    ),
    db.all(
      `SELECT id, nombre, codigo, stock_actual, unidad FROM insumos
       WHERE nombre LIKE ? OR codigo LIKE ? LIMIT 4`,
      [like, like]
    ),
    db.all(
      `SELECT id, nombre, apellido, dni, curso FROM alumnos
       WHERE nombre LIKE ? OR apellido LIKE ? OR dni LIKE ? LIMIT 4`,
      [like, like, like]
    ),
    db.all(
      `SELECT id, nombre, apellido, especialidad FROM docentes
       WHERE nombre LIKE ? OR apellido LIKE ? LIMIT 3`,
      [like, like]
    ),
  ])

  const results = [
    ...herramientas.map(h => ({
      tipo: 'herramienta', id: h.id,
      titulo: h.nombre,
      sub: h.codigo ? `Código: ${h.codigo}` : h.estado,
      path: '/herramientas'
    })),
    ...insumos.map(i => ({
      tipo: 'insumo', id: i.id,
      titulo: i.nombre,
      sub: `Stock: ${i.stock_actual} ${i.unidad}`,
      path: '/insumos'
    })),
    ...alumnos.map(a => ({
      tipo: 'alumno', id: a.id,
      titulo: `${a.nombre} ${a.apellido}`,
      sub: [a.curso, a.dni].filter(Boolean).join(' · '),
      path: '/alumnos'
    })),
    ...docentes.map(d => ({
      tipo: 'docente', id: d.id,
      titulo: `${d.nombre} ${d.apellido}`,
      sub: d.especialidad || 'Docente',
      path: '/docentes'
    })),
  ]

  res.json({ results })
})

export default router
