import { useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, User, Wrench } from 'lucide-react'
import api from '../services/api.js'

export default function Login({ onLogin }) {
  const [form, setForm] = useState({ usuario: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', form)
      onLogin(data.token, data.user)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 30% 50%, rgba(0,242,254,0.06) 0%, transparent 60%), var(--bg)',
      padding: '16px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card"
        style={{ width: '100%', maxWidth: 400, padding: 36 }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Wrench size={28} color="#000" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Logística EESTN4</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Escuela Técnica N°4 — Gestión de Stock
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Usuario</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                className="glass-input"
                style={{ paddingLeft: 36 }}
                placeholder="Usuario"
                value={form.usuario}
                onChange={e => setForm(p => ({ ...p, usuario: e.target.value }))}
                autoComplete="username"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                className="glass-input"
                style={{ paddingLeft: 36 }}
                placeholder="Contraseña"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
