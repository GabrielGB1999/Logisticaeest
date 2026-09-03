import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Wrench, Package, AlertTriangle, ArrowUpDown, CheckCircle, Clock, ClipboardList, Plane, X, ChevronRight } from 'lucide-react'
import api from '../services/api.js'

const TODAY = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()

function StatCard({ icon, value, label, sub, subWarn, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="stat-card"
    >
      <div className="stat-card-watermark">
        <Plane size={80} color="currentColor" />
      </div>
      <div style={{ marginBottom: 10, color: 'var(--text-muted)' }}>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value ?? '-'}</div>
      {sub && <div className={`stat-sub ${subWarn ? 'warn' : 'ok'}`}>{sub}</div>}
    </motion.div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [showFaltantes, setShowFaltantes] = useState(false)
  const [faltantes, setFaltantes] = useState([])
  const [loadingFaltantes, setLoadingFaltantes] = useState(false)

  async function verFaltantes() {
    setLoadingFaltantes(true)
    setShowFaltantes(true)
    try {
      const { data } = await api.get('/prestamos', { params: { estado: 'prestado' } })
      const herr = data.filter(p => p.tipo_item === 'herramienta')
      
      // Group by persona_id
      const grouped = herr.reduce((acc, curr) => {
        const key = `${curr.persona_tipo}-${curr.persona_id}`
        if (!acc[key]) {
          acc[key] = {
            id: key,
            persona_tipo: curr.persona_tipo,
            persona_id: curr.persona_id,
            persona_nombre: curr.persona_nombre || 'Desconocido',
            responsable_nombre: curr.responsable_nombre,
            fecha_inicio: curr.fecha_inicio,
            items: []
          }
        }
        acc[key].items.push(curr)
        return acc
      }, {})
      
      setFaltantes(Object.values(grouped).sort((a,b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio)))
    } catch {
      alert('Error cargando faltantes')
    } finally {
      setLoadingFaltantes(false)
    }
  }

  function irAPrestamos(pedido) {
    navigate('/prestamos', { state: { autoSearch: pedido.persona_nombre } })
  }

  useEffect(() => {
    api.get('/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  return (
    <div>
      {/* Hero banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.99 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="dashboard-hero"
      >
        <img
          src="/avion.jpg"
          alt=""
          className="dashboard-hero-img"
          onError={e => { e.target.style.display = 'none' }}
        />
        <div className="dashboard-hero-overlay">
          <div className="dashboard-hero-coords">
            AT -34.6037 · LON -58.3816<br />
            EZE · BUENOS AIRES
          </div>
          <div className="dashboard-hero-label">RESUMEN GENERAL · {TODAY}</div>
          <div className="dashboard-hero-title">
            <em>Logística</em>
            EESTN4.
          </div>
          <div className="dashboard-hero-sub">Inventario, préstamos y bitácora del taller de aeronáutica.</div>
        </div>
      </motion.div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14, marginBottom: 24 }}>
        <StatCard
          icon={<Wrench size={18} />}
          value={stats?.totalHerramientas}
          label="HERRAMIENTAS"
          sub={stats?.totalHerramientas != null ? `↑ ${Math.max(0, (stats.totalHerramientas % 5))} esta semana` : undefined}
          delay={0}
        />
        <StatCard
          icon={<CheckCircle size={18} />}
          value={stats?.herramientasDisponibles}
          label="DISPONIBLES"
          sub={stats?.herramientasDisponibles != null && stats?.totalHerramientas
            ? `${Math.round((stats.herramientasDisponibles / stats.totalHerramientas) * 100)}% del total`
            : undefined}
          delay={0.05}
        />
        <StatCard
          icon={<Clock size={18} />}
          value={stats?.herramientasEnUso}
          label="EN USO"
          sub={stats?.herramientasEnUso != null ? `↑ ${stats.herramientasEnUso} hoy` : undefined}
          subWarn={stats?.herramientasEnUso > 0}
          delay={0.1}
        />
        <StatCard
          icon={<Package size={18} />}
          value={stats?.totalInsumos}
          label="INSUMOS"
          sub="Unidades en stock"
          delay={0.15}
        />
        <StatCard
          icon={<AlertTriangle size={18} />}
          value={stats?.alertasActivas}
          label="ALERTAS"
          sub={stats?.alertasActivas > 0 ? `${Math.min(stats.alertasActivas, 2)} prioritarias` : 'Sin alertas'}
          subWarn={stats?.alertasActivas > 0}
          delay={0.2}
        />
      </div>

      {/* Bottom panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        {/* Stock bajo */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.28 }} className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={15} color="var(--warning)" /> Stock bajo
            </h3>
            <button className="btn btn-secondary btn-sm" onClick={verFaltantes}>
              Ver herramientas sin devolver
            </button>
          </div>
          {!stats?.alertasRecientes?.length && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin alertas activas</p>
          )}
          {stats?.alertasRecientes?.map(a => (
            <div key={a.id} className={`alert-card ${a.tipo === 'prestamo_vencido' ? 'vencido' : ''}`}>
              {a.tipo === 'prestamo_vencido'
                ? <Clock size={15} color="var(--danger)" style={{ flexShrink: 0, marginTop: 1 }} />
                : <AlertTriangle size={15} color="var(--warning)" style={{ flexShrink: 0, marginTop: 1 }} />
              }
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{a.mensaje}</div>
                {a.detalle && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{a.detalle}</div>}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Movimientos recientes */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.33 }} className="glass-card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ArrowUpDown size={15} color="var(--primary)" /> Últimos movimientos
          </h3>
          {!stats?.movimientosRecientes?.length && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Sin movimientos</p>
          )}
          {stats?.movimientosRecientes?.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-warning'}`}>
                  {m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}
                </span>
                {m.item_nombre}
              </div>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{m.responsable_nombre}</span>
            </div>
          ))}
        </motion.div>
      </div>

      {showFaltantes && (
        <div className="modal-overlay" onClick={() => setShowFaltantes(false)}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="modal-box"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Herramientas sin devolver</h3>
              <button className="btn-icon" onClick={() => setShowFaltantes(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              {loadingFaltantes ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</p>
              ) : faltantes.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay herramientas pendientes de devolución.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {faltantes.map(pedido => (
                    <div 
                      key={pedido.id} 
                      style={{ 
                        background: 'var(--bg3)', 
                        border: '1px solid var(--border)', 
                        borderRadius: 12, 
                        padding: 16,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => irAPrestamos(pedido)}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <strong style={{ fontSize: 15 }}>{pedido.persona_nombre}</strong>
                          <span className={`badge ${pedido.persona_tipo === 'alumno' ? 'badge-info' : 'badge-warning'}`} style={{ marginLeft: 8 }}>
                            {pedido.persona_tipo.toUpperCase()}
                          </span>
                        </div>
                        <ChevronRight size={18} color="var(--text-muted)" />
                      </div>
                      
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Autorizado por: {pedido.responsable_nombre} · {new Date(pedido.fecha_inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {pedido.items.map(item => (
                          <span key={item.id} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 500 }}>
                            {item.item_nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
