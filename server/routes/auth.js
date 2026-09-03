import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { getDB } from '../database.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { usuario, password } = req.body
  if (!usuario || !password) return res.status(400).json({ error: 'Datos incompletos' })

  const db = await getDB()
  const user = await db.get(`
    SELECT u.*, r.nombre as rol_nombre, r.permisos
    FROM usuarios u JOIN roles r ON u.role_id = r.id
    WHERE u.usuario = ? AND u.activo = 1
  `, [usuario])

  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' })

  const permisos = JSON.parse(user.permisos)
  const token = jwt.sign(
    { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol_nombre, permisos },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  )
  res.json({ token, user: { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol_nombre, permisos } })
})

export default router
