import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'

const router = Router()

router.get('/usuarios', requirePermiso('admin_ver'), async (req, res) => {
  const db = await getDB()
  res.json(await db.all(
    'SELECT u.id, u.usuario, u.nombre, u.email, u.activo, u.creado_el, r.nombre as rol_nombre, u.role_id FROM usuarios u JOIN roles r ON u.role_id = r.id ORDER BY u.nombre'
  ))
})

router.post('/usuarios', requirePermiso('admin_ver'), async (req, res) => {
  const db = await getDB()
  const { usuario, password, nombre, email, role_id } = req.body
  if (!usuario || !password || !nombre || !role_id) return res.status(400).json({ error: 'Datos incompletos' })
  const exists = await db.get('SELECT id FROM usuarios WHERE usuario = ?', [usuario])
  if (exists) return res.status(400).json({ error: 'Usuario ya existe' })
  const result = await db.run(
    'INSERT INTO usuarios (usuario, password, nombre, email, role_id) VALUES (?, ?, ?, ?, ?)',
    [usuario, bcrypt.hashSync(password, 10), nombre, email || null, role_id]
  )
  res.status(201).json({ id: result.lastID })
})

router.put('/usuarios/:id', requirePermiso('admin_ver'), async (req, res) => {
  const db = await getDB()
  const { nombre, email, role_id, activo, password } = req.body
  const user = await db.get('SELECT id FROM usuarios WHERE id = ?', [req.params.id])
  if (!user) return res.status(404).json({ error: 'No encontrado' })
  if (password) await db.run('UPDATE usuarios SET password = ? WHERE id = ?', [bcrypt.hashSync(password, 10), req.params.id])
  await db.run('UPDATE usuarios SET nombre=?, email=?, role_id=?, activo=? WHERE id=?', [nombre, email || null, role_id, activo ?? 1, req.params.id])
  res.json({ ok: true })
})

router.delete('/usuarios/:id', requirePermiso('admin_ver'), async (req, res) => {
  const db = await getDB()
  if (Number(req.params.id) === req.user.id) return res.status(400).json({ error: 'No podés eliminar tu propio usuario' })
  await db.run('DELETE FROM usuarios WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

router.get('/roles', async (req, res) => {
  const db = await getDB()
  res.json(await db.all('SELECT * FROM roles ORDER BY id'))
})

router.get('/categorias', async (req, res) => {
  const db = await getDB()
  res.json(await db.all('SELECT * FROM categorias ORDER BY tipo, nombre'))
})

router.post('/categorias', requirePermiso('admin_ver'), async (req, res) => {
  const db = await getDB()
  const { nombre, tipo, color } = req.body
  if (!nombre || !tipo) return res.status(400).json({ error: 'Datos incompletos' })
  const result = await db.run('INSERT INTO categorias (nombre, tipo, color) VALUES (?, ?, ?)', [nombre, tipo, color || '#00f2fe'])
  res.status(201).json({ id: result.lastID })
})

router.put('/categorias/:id', requirePermiso('admin_ver'), async (req, res) => {
  const db = await getDB()
  const { nombre, color } = req.body
  await db.run('UPDATE categorias SET nombre=?, color=? WHERE id=?', [nombre, color, req.params.id])
  res.json({ ok: true })
})

router.delete('/categorias/:id', requirePermiso('admin_ver'), async (req, res) => {
  const db = await getDB()
  await db.run('DELETE FROM categorias WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
