import { useLocation, useNavigate } from 'react-router-dom'
import { Search, Bell, Wrench, Package, GraduationCap, Users, X, Menu } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import api from '../services/api.js'

const PAGE_NAMES = {
  '/dashboard': 'DASHBOARD',
  '/herramientas': 'HERRAMIENTAS',
  '/insumos': 'INSUMOS',
  '/prestamos': 'PRÉSTAMOS',
  '/movimientos': 'MOVIMIENTOS',
  '/alumnos': 'ALUMNOS',
  '/docentes': 'DOCENTES',
  '/alertas': 'ALERTAS',
  '/admin': 'ADMINISTRACIÓN',
}

const TYPE_ICON = {
  herramienta: Wrench,
  insumo: Package,
  alumno: GraduationCap,
  docente: Users,
}

const TYPE_LABEL = {
  herramienta: 'Herramienta',
  insumo: 'Insumo',
  alumno: 'Alumno',
  docente: 'Docente',
}

export default function Header({ alertCount = 0, onMenuClick }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const pageName = PAGE_NAMES[pathname] ?? 'DASHBOARD'

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)
  const wrapRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    clearTimeout(timerRef.current)
    if (query.length < 2) { setResults([]); setOpen(false); return }
    setLoading(true)
    timerRef.current = setTimeout(() => {
      api.get(`/search?q=${encodeURIComponent(query)}`)
        .then(r => { setResults(r.data.results); setOpen(true); setActive(-1) })
        .catch(() => setResults([]))
        .finally(() => setLoading(false))
    }, 260)
    return () => clearTimeout(timerRef.current)
  }, [query])

  useEffect(() => {
    function onClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function handleSelect(item) {
    navigate(item.path)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(a + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, 0)) }
    if (e.key === 'Enter' && active >= 0) handleSelect(results[active])
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <header className="app-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="mobile-menu-btn" onClick={onMenuClick}>
          <Menu size={22} />
        </button>
        <span className="header-breadcrumb">
          EESTN4 · LOGÍSTICA · <strong>{pageName}</strong>
        </span>
      </div>

      <div className="header-search-wrap" ref={wrapRef}>
        <label className="header-search">
          <Search size={15} />
          <input
            placeholder="Buscar en todo el sistema..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => results.length > 0 && setOpen(true)}
            onKeyDown={handleKeyDown}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setOpen(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}
            >
              <X size={13} />
            </button>
          )}
        </label>

        {open && (
          <div className="search-dropdown">
            {loading && (
              <div className="search-empty">Buscando…</div>
            )}
            {!loading && results.length === 0 && (
              <div className="search-empty">Sin resultados para "{query}"</div>
            )}
            {!loading && results.map((item, i) => {
              const Icon = TYPE_ICON[item.tipo] ?? Wrench
              return (
                <button
                  key={`${item.tipo}-${item.id}`}
                  className={`search-result ${i === active ? 'search-result-active' : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setActive(i)}
                >
                  <div className="search-result-icon">
                    <Icon size={14} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="search-result-title">{item.titulo}</div>
                    {item.sub && <div className="search-result-sub">{item.sub}</div>}
                  </div>
                  <span className="search-result-tag">{TYPE_LABEL[item.tipo]}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div className="header-bell">
        <Bell size={17} />
        {alertCount > 0 && <span className="header-bell-badge" />}
      </div>
    </header>
  )
}
