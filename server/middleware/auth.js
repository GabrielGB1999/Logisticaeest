import jwt from 'jsonwebtoken'
import { getDB } from '../database.js'

export async function verifyToken(req, res, next) {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })

  let payload
  try {
    payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }

  // Los permisos se leen de la base en cada pedido, no del token. El token dura
  // 8 h: si se tomaran de ahí, dar de baja a un usuario, cambiarle el rol o
  // ajustar los permisos de un rol no tendría efecto hasta que venciera.
  const db = await getDB()
  const user = await db.get(
    `SELECT u.id, u.usuario, u.nombre, u.activo, r.nombre AS rol, r.permisos
     FROM usuarios u JOIN roles r ON u.role_id = r.id
     WHERE u.id = ?`,
    [payload.id]
  )
  if (!user || !user.activo) return res.status(401).json({ error: 'Usuario inactivo o inexistente' })

  let permisos = []
  try {
    const parsed = JSON.parse(user.permisos)
    if (Array.isArray(parsed)) permisos = parsed
  } catch {}

  req.user = { id: user.id, usuario: user.usuario, nombre: user.nombre, rol: user.rol, permisos }
  next()
}

export function requirePermiso(permiso) {
  return (req, res, next) => {
    const permisos = req.user?.permisos || []
    if (!permisos.includes(permiso)) {
      return res.status(403).json({ error: 'Sin permisos suficientes' })
    }
    next()
  }
}
