import { NavLink, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { LayoutDashboard, Wrench, Package, ArrowUpDown, Bell, Settings, LogOut, ClipboardList, GraduationCap, Users, Plane } from 'lucide-react'
import api from '../services/api.js'

const NAV = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permiso: 'dashboard' },
  { path: '/herramientas', label: 'Herramientas', icon: Wrench, permiso: 'herramientas_ver' },
  { path: '/insumos', label: 'Insumos', icon: Package, permiso: 'insumos_ver' },
  { path: '/prestamos', label: 'Préstamos', icon: ClipboardList, permiso: 'prestamos_ver' },
  { path: '/movimientos', label: 'Movimientos', icon: ArrowUpDown, permiso: 'movimientos_ver' },
  { path: '/alumnos', label: 'Alumnos', icon: GraduationCap, permiso: 'alumnos_ver' },
  { path: '/docentes', label: 'Docentes', icon: Users, permiso: 'docentes_ver' },
  { path: '/alertas', label: 'Alertas', icon: Bell, permiso: 'alertas_ver' },
  { path: '/admin', label: 'Administración', icon: Settings, permiso: 'admin_ver' }
]

function initials(nombre) {
  if (!nombre) return '?'
  return nombre.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function Sidebar({ user, logout, can, isOpen, onClose }) {
  const navigate = useNavigate()
  const [alertCount, setAlertCount] = useState(0)

  useEffect(() => {
    function fetchCount() {
      api.get('/alertas/count').then(r => setAlertCount(r.data.total)).catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      {/* Logo */}
      <div style={{ padding: '18px 16px 16px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: '#1A1612',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <Plane size={18} color="#EAE6DF" />
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.2, color: 'var(--text)' }}>EESTN4</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.3, letterSpacing: '0.06em' }}>LOGÍSTICA</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto' }}>
        {NAV.filter(item => can(item.permiso)).map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <item.icon size={17} />
            <span style={{ flex: 1 }}>{item.label}</span>
            {item.permiso === 'alertas_ver' && alertCount > 0 && (
              <span style={{
                background: 'var(--danger)', color: '#fff',
                fontSize: 11, fontWeight: 700,
                padding: '2px 7px', borderRadius: 10, minWidth: 20, textAlign: 'center'
              }}>
                {alertCount}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div style={{ padding: '14px 16px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            background: '#1A1612', color: '#EAE6DF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0, letterSpacing: '0.05em'
          }}>
            {initials(user?.nombre)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.nombre}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {user?.rol}
            </div>
          </div>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={handleLogout}
        >
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </aside>
  )
}
