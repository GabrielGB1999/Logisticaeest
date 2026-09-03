import jwt from 'jsonwebtoken'

export function verifyToken(req, res, next) {
  const auth = req.headers['authorization']
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Token requerido' })

  try {
    req.user = jwt.verify(auth.slice(7), process.env.JWT_SECRET)
    next()
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' })
  }
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
