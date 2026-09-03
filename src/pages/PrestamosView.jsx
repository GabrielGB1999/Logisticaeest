import { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { Search, ScanLine, Plus, Trash2, CheckCircle, RotateCcw, ClipboardList } from 'lucide-react'
import api from '../services/api.js'
import ScannerModal from '../components/ScannerModal.jsx'

export default function PrestamosView({ can, user }) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [persona, setPersona] = useState(null)
  const [docenteActual, setDocenteActual] = useState(null)
  const [prestamos, setPrestamos] = useState([])
  const [pendientes, setPendientes] = useState([])
  const [itemQuery, setItemQuery] = useState('')
  const [scannerPersona, setScannerPersona] = useState(false)
  const [scannerItem, setScannerItem] = useState(false)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const itemInputRef = useRef(null)
  const location = useLocation()

  useEffect(() => {
    if (location.state?.autoSearch) {
      const searchStr = location.state.autoSearch
      setQuery(searchStr)
      buscarPersona(searchStr)
      
      // Clean up state so it doesn't trigger again on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location.state])

  async function buscarPersona(q) {
    if (!q.trim()) return
    setLoading(true)
    try {
      const { data } = await api.get(`/persona/lookup/${encodeURIComponent(q.trim())}`)
      if (data.length === 1) seleccionarPersona(data[0])
      else { setResultados(data); setPersona(null) }
    } catch { alert('No encontrado') } finally { setLoading(false) }
  }

  function seleccionarPersona(p) {
    setPersona(p)
    setResultados([])
    setQuery('')
    setPendientes([])
    cargarPrestamos(p)
    if (p.tipo === 'alumno' && p.curso) {
      cargarDocenteActual(p.curso, p.grupo)
    } else {
      setDocenteActual(null)
    }
  }

  async function cargarDocenteActual(curso, grupo) {
    try {
      const { data } = await api.get('/docentes/actual/find', { params: { curso, grupo } })
      setDocenteActual(data)
    } catch { setDocenteActual(null) }
  }

  async function cargarPrestamos(p) {
    const { data } = await api.get('/prestamos', {
      params: { persona_tipo: p.tipo, persona_id: p.id }
    })
    setPrestamos(data)
  }

  async function buscarItem(codigo) {
    const qStr = codigo.trim()
    if (!qStr) return
    try {
      let item = null
      try {
        const r = await api.get(`/herramientas/codigo/${encodeURIComponent(qStr)}`)
        item = { ...r.data, tipo_item: 'herramienta' }
      } catch {
        try {
          const r = await api.get(`/insumos/codigo/${encodeURIComponent(qStr)}`)
          item = { ...r.data, tipo_item: 'insumo' }
        } catch { }
      }

      if (!item) {
        const [resH, resI] = await Promise.all([
          api.get('/herramientas', { params: { buscar: qStr } }),
          api.get('/insumos', { params: { buscar: qStr } })
        ])
        const candidatos = [
          ...resH.data.map(h => ({ ...h, tipo_item: 'herramienta' })),
          ...resI.data.map(i => ({ ...i, tipo_item: 'insumo' }))
        ]
        
        const exactMatch = candidatos.find(c => c.nombre.toLowerCase() === qStr.toLowerCase())
        if (exactMatch) {
          item = exactMatch
        } else if (candidatos.length > 0) {
          if (window.confirm(`No se encontró un código exacto. ¿Quisiste decir "${candidatos[0].nombre}"?`)) {
            item = candidatos[0]
          } else {
            // Lo agregamos manual sin DB
            item = { id: -(Date.now() + Math.random()), nombre_manual: qStr, nombre: qStr, tipo_item: 'herramienta', stock_actual: '—' }
          }
        } else {
          // Lo agregamos manual sin DB ni preguntar
          item = { id: -(Date.now() + Math.random()), nombre_manual: qStr, nombre: qStr, tipo_item: 'herramienta', stock_actual: '—' }
        }
      }

      if (item) {
        const maxStock = item.stock_disponible !== undefined && item.stock_disponible !== '—' ? item.stock_disponible : item.stock_actual;
        if (maxStock !== '—' && !isNaN(maxStock) && maxStock <= 0) {
          alert(`El ítem "${item.nombre}" no tiene stock disponible en este momento.`);
        } else if (!pendientes.find(x => x.id === item.id && x.tipo_item === item.tipo_item)) {
          setPendientes(p => [...p, { ...item, cantidad_solicitada: 1 }])
        }
        setItemQuery('')
      }
    } catch { 
      alert(`Error procesando el ítem.`) 
    }
  }

  async function confirmarPrestamo() {
    if (!persona || pendientes.length === 0) return
    try {
      for (const item of pendientes) {
        await api.post('/prestamos', {
          persona_tipo: persona.tipo,
          persona_id: persona.id,
          tipo_item: item.tipo_item,
          item_id: item.id < 0 ? -1 : item.id,
          nombre_manual: item.id < 0 ? item.nombre_manual : null,
          cantidad: item.cantidad_solicitada || 1
        })
      }
      setPendientes([])
      cargarPrestamos(persona)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al registrar préstamo')
    }
  }

  async function devolver(prestamo) {
    let consumido = false
    if (prestamo.tipo_item === 'insumo') {
      consumido = confirm(
        `¿El insumo "${prestamo.item_nombre}" fue consumido?\n\n[Aceptar] = se descuenta del stock\n[Cancelar] = vuelve al inventario`
      )
    }
    try {
      await api.post(`/prestamos/${prestamo.id}/devolver`, { consumido })
      cargarPrestamos(persona)
    } catch (err) {
      alert(err.response?.data?.error || 'Error al devolver')
    }
  }

  async function eliminarPrestamo(id) {
    if (!confirm('¿Eliminar este registro de préstamo?')) return
    await api.delete(`/prestamos/${id}`)
    cargarPrestamos(persona)
  }

  async function handleCierreTurno() {
    if (!confirm('¿Generar reporte de cierre de turno? Esto exportará a Excel y limpiará el historial de préstamos devueltos.')) return
    setExporting(true)
    try {
      const response = await api.get('/prestamos/export-returned', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      let fileName = 'CierreTurno.xlsx'
      const disposition = response.headers['content-disposition']
      if (disposition && disposition.includes('filename=')) {
        fileName = disposition.split('filename=')[1].replace(/"/g, '')
      }
      link.setAttribute('download', fileName)
      document.body.appendChild(link)
      link.click()
      link.remove()
      
      if (persona) cargarPrestamos(persona)
    } catch (err) {
      alert('Error al exportar cierre de turno')
    } finally {
      setExporting(false)
    }
  }

  const prestadosActivos = prestamos.filter(p => p.estado === 'prestado')
  const historial = prestamos.filter(p => p.estado === 'devuelto')

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Préstamos</h1>
          <p>Gestión de herramientas e insumos prestados</p>
        </div>
        {can('prestamos_editar') && (
          <button className="btn btn-secondary" onClick={handleCierreTurno} disabled={exporting}>
            <ClipboardList size={16} /> {exporting ? 'Generando...' : 'Cierre de Turno'}
          </button>
        )}
      </div>

      {/* Búsqueda de persona */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Buscar alumno o docente</p>
        <form onSubmit={e => { e.preventDefault(); buscarPersona(query) }} style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="glass-input"
              style={{ paddingLeft: 34 }}
              placeholder="DNI, apellido o nombre..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '...' : <Search size={16} />}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setScannerPersona(true)}>
            <ScanLine size={16} /> Escanear
          </button>
        </form>

        {/* Resultados de búsqueda */}
        {resultados.map(p => (
          <motion.div
            key={`${p.tipo}-${p.id}`}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => seleccionarPersona(p)}
            style={{ padding: '12px 14px', marginTop: 8, background: 'var(--glass)', borderRadius: 10, cursor: 'pointer', border: '1px solid var(--glass-border)' }}
          >
            <strong>{p.apellido}, {p.nombre}</strong>
            <span className={`badge ${p.tipo === 'alumno' ? 'badge-info' : 'badge-warning'}`} style={{ marginLeft: 10 }}>{p.tipo}</span>
            {p.curso && <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>{p.curso} {p.grupo}</span>}
            <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>DNI: {p.dni}</span>
          </motion.div>
        ))}

        {/* Persona seleccionada */}
        {persona && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: 14, padding: '14px 16px', border: '2px solid var(--primary)', borderRadius: 12, background: 'rgba(0,242,254,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{persona.apellido}, {persona.nombre}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  <span className={`badge ${persona.tipo === 'alumno' ? 'badge-info' : 'badge-warning'}`} style={{ marginRight: 8 }}>{persona.tipo.toUpperCase()}</span>
                  {persona.curso && `${persona.curso} ${persona.grupo || ''} · `}DNI: {persona.dni}
                </div>
                {docenteActual && (
                  <div style={{ fontSize: 13, color: 'var(--primary)', marginTop: 8, fontWeight: 600 }}>
                    <ClipboardList size={14} style={{ verticalAlign: 'text-bottom', marginRight: 4 }}/>
                    A cargo de: Prof. {docenteActual.apellido}, {docenteActual.nombre}
                  </div>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => { setPersona(null); setDocenteActual(null); setPrestamos([]); setPendientes([]) }}>Cambiar</button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Área de préstamo (cuando hay persona seleccionada) */}
      {persona && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 20 }}>
          <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Agregar items al préstamo</p>

          {can('prestamos_editar') && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <input
                  ref={itemInputRef}
                  className="glass-input"
                  style={{ flex: 1 }}
                  placeholder="Código o nombre (Enter para agregar/buscar)..."
                  value={itemQuery}
                  onChange={e => setItemQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarItem(itemQuery) } }}
                />
                <button type="button" className="btn btn-secondary" onClick={() => setScannerItem(true)}>
                  <ScanLine size={16} /> Escanear
                </button>
              </div>

              {pendientes.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {pendientes.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,242,254,0.05)', borderRadius: 8, marginBottom: 6, border: '1px solid rgba(0,242,254,0.15)' }}>
                      <div>
                        <strong style={{ fontSize: 14 }}>{item.nombre}</strong>
                        <span className="badge badge-muted" style={{ marginLeft: 8 }}>{item.tipo_item}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 8 }}>
                          Stock: {item.stock_disponible !== undefined ? item.stock_disponible : item.stock_actual}
                          {item.stock_disponible !== undefined && item.stock_disponible !== item.stock_actual ? ` (Total: ${item.stock_actual})` : ''}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input 
                          type="number" 
                          min="1" 
                          className="glass-input" 
                          style={{ width: 60, padding: '4px 8px', textAlign: 'center', height: '32px' }}
                          value={item.cantidad_solicitada || 1}
                          onChange={(e) => {
                            let val = parseInt(e.target.value) || 1;
                            if (val < 1) val = 1;
                            const maxStock = item.stock_disponible !== undefined && item.stock_disponible !== '—' ? item.stock_disponible : item.stock_actual;
                            if (maxStock !== '—' && !isNaN(maxStock) && val > maxStock) {
                                val = maxStock;
                            }
                            setPendientes(p => {
                                const next = [...p];
                                next[idx].cantidad_solicitada = val;
                                return next;
                            });
                          }}
                          title="Cantidad"
                        />
                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => setPendientes(p => p.filter((_, i) => i !== idx))}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 8 }} onClick={confirmarPrestamo}>
                    <CheckCircle size={16} /> Confirmar préstamo ({pendientes.length} item{pendientes.length !== 1 ? 's' : ''})
                  </button>
                </div>
              )}
            </>
          )}

          {/* Préstamos activos */}
          {prestadosActivos.length > 0 && (
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--warning)', marginBottom: 8, marginTop: can('prestamos_editar') ? 16 : 0 }}>
                Items en préstamo activo ({prestadosActivos.length})
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Item</th><th>Tipo</th><th>Desde</th><th>Responsable</th>{can('prestamos_editar') && <th></th>}</tr>
                  </thead>
                  <tbody>
                    {prestadosActivos.map(p => (
                      <tr key={p.id}>
                        <td><strong>{p.cantidad > 1 ? `${p.cantidad}x ` : ''}{p.item_nombre}</strong></td>
                        <td><span className="badge badge-muted">{p.tipo_item}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(p.fecha_inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td style={{ fontSize: 13 }}>{p.responsable_nombre}</td>
                        {can('prestamos_editar') && (
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => devolver(p)}>
                                <RotateCcw size={13} /> Devolver
                              </button>
                              <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => eliminarPrestamo(p.id)}>
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {prestadosActivos.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>Sin préstamos activos para esta persona.</p>
          )}

          {/* Historial */}
          {historial.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>Historial de devoluciones ({historial.length})</p>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Item</th><th>Prestado</th><th>Devuelto</th></tr></thead>
                  <tbody>
                    {historial.map(p => (
                      <tr key={p.id} style={{ opacity: 0.6 }}>
                        <td>{p.cantidad > 1 ? `${p.cantidad}x ` : ''}{p.item_nombre}</td>
                        <td style={{ fontSize: 12 }}>{new Date(p.fecha_inicio).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td style={{ fontSize: 12 }}>{p.fecha_fin ? new Date(p.fecha_fin).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!persona && prestamos.length === 0 && (
        <div className="glass-card">
          <div className="empty-state">
            <ClipboardList size={48} />
            <p style={{ marginTop: 8 }}>Buscá un alumno o docente para gestionar sus préstamos</p>
          </div>
        </div>
      )}

      {scannerPersona && (
        <ScannerModal
          onScan={codigo => { setScannerPersona(false); buscarPersona(codigo) }}
          onClose={() => setScannerPersona(false)}
        />
      )}
      {scannerItem && (
        <ScannerModal
          onScan={codigo => { setScannerItem(false); buscarItem(codigo) }}
          onClose={() => setScannerItem(false)}
        />
      )}
    </div>
  )
}
