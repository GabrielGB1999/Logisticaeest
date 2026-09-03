import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { networkInterfaces } from 'os'

const __dirname = dirname(fileURLToPath(import.meta.url))

try {
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf8')
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=')
    if (k?.trim() && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim()
  }
} catch {}

import { getDB } from './database.js'
import { verifyToken } from './middleware/auth.js'
import authRouter from './routes/auth.js'
import herramientasRouter from './routes/herramientas.js'
import insumosRouter from './routes/insumos.js'
import movimientosRouter from './routes/movimientos.js'
import alertasRouter from './routes/alertas.js'
import adminRouter from './routes/admin.js'
import statsRouter from './routes/stats.js'
import alumnosRouter from './routes/alumnos.js'
import docentesRouter from './routes/docentes.js'
import personaRouter from './routes/persona.js'
import prestamosRouter from './routes/prestamos.js'
import searchRouter from './routes/search.js'

const app = express()
const PORT = process.env.PORT || 5000

// Sin JWT_SECRET el login falla con un 500 poco claro en cada intento; es mejor
// no arrancar y decir exactamente qué falta.
if (!process.env.JWT_SECRET) {
  console.error('Falta JWT_SECRET. Definilo en el archivo .env antes de iniciar el servidor.')
  process.exit(1)
}

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors())
app.use(express.json({ limit: '2mb' }))

app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false }))
app.use(rateLimit({ windowMs: 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false }))

// Sin autenticación a propósito: la usa el healthcheck del contenedor.
app.get('/api/health', (req, res) => res.json({ ok: true }))

app.use('/api/auth', authRouter)
app.use('/api', verifyToken)
app.use('/api/herramientas', herramientasRouter)
app.use('/api/insumos', insumosRouter)
app.use('/api/movimientos', movimientosRouter)
app.use('/api/alertas', alertasRouter)
app.use('/api/admin', adminRouter)
app.use('/api/stats', statsRouter)
app.use('/api/alumnos', alumnosRouter)
app.use('/api/docentes', docentesRouter)
app.use('/api/persona', personaRouter)
app.use('/api/prestamos', prestamosRouter)
app.use('/api/search', searchRouter)

const distPath = join(__dirname, '..', 'dist')
app.use(express.static(distPath))
app.get('/{*path}', (req, res) => {
  if (!req.path.startsWith('/api')) res.sendFile(join(distPath, 'index.html'))
})

// Los errores no atendidos en una ruta /api deben volver como JSON. Express
// por defecto responde una página HTML con el stack trace, que el frontend no
// sabe interpretar y que además expone rutas internas del servidor.
app.use((err, req, res, next) => {
  console.error(err)
  if (res.headersSent) return next(err)
  if (!req.path.startsWith('/api')) return next(err)
  if (String(err?.code || '').startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: 'La operación viola una restricción de la base (dato duplicado o referencia inexistente)' })
  }
  res.status(500).json({ error: 'Error interno del servidor' })
})

function getLocalIPs() {
  const nets = networkInterfaces()
  return Object.values(nets).flat()
    .filter(n => n.family === 'IPv4' && !n.internal)
    .map(n => n.address)
}

// Inicializar BD antes de escuchar
getDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs()
    console.log('\n🚀 Logística EESTN4 iniciado')
    console.log(`   Local:   http://localhost:${PORT}`)
    for (const ip of ips) {
      console.log(`   Red:     http://${ip}:${PORT}`)
    }
    console.log('')
  })
}).catch(err => {
  console.error('Error iniciando BD:', err)
  process.exit(1)
})
