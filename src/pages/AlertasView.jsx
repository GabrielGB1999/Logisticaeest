import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, CheckCheck, Trash2, Bell } from 'lucide-react'
import api from '../services/api.js'

export default function AlertasView({ can }) {
  const [alertas, setAlertas] = useState([])
  const [soloNoLeidas, setSoloNoLeidas] = useState(true)

  function load() {
    api.get('/alertas', { params: { solo_no_leidas: soloNoLeidas ? '1' : '0' } })
      .then(r => setAlertas(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [soloNoLeidas])

  async function marcarLeida(id) {
    await api.put(`/alertas/${id}/leer`)
    load()
  }

  async function marcarTodas() {
    await api.put('/alertas/leer-todas')
    load()
  }

  async function eliminar(id) {
    await api.delete(`/alertas/${id}`)
    load()
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Alertas</h1><p>Notificaciones de stock bajo</p></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer' }}>
            <input type="checkbox" checked={soloNoLeidas} onChange={e => setSoloNoLeidas(e.target.checked)} />
            Solo no leídas
          </label>
          {can('alertas_gestionar') && alertas.some(a => !a.leida) && (
            <button className="btn btn-secondary btn-sm" onClick={marcarTodas}>
              <CheckCheck size={14} /> Marcar todas como leídas
            </button>
          )}
        </div>
      </div>

      {alertas.length === 0 && (
        <div className="glass-card">
          <div className="empty-state">
            <Bell size={48} />
            <p style={{ marginTop: 8 }}>{soloNoLeidas ? 'No hay alertas pendientes' : 'No hay alertas registradas'}</p>
          </div>
        </div>
      )}

      <div>
        {alertas.map(a => (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className={`alert-card ${a.leida ? 'leida' : ''}`}
          >
            <AlertTriangle size={18} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 14 }}>{a.mensaje}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {new Date(a.creada_el).toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' })}
                {a.leida && <span style={{ marginLeft: 8 }}>· Leída</span>}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {!a.leida && (
                <button className="btn-icon" title="Marcar como leída" onClick={() => marcarLeida(a.id)}>
                  <CheckCheck size={14} />
                </button>
              )}
              {can('alertas_gestionar') && (
                <button className="btn-icon" style={{ color: 'var(--danger)' }} title="Eliminar" onClick={() => eliminar(a.id)}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
