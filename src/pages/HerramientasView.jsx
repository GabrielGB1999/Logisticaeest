import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Edit2, Trash2, ScanLine, Package, FileSpreadsheet } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal.jsx'
import ScannerModal from '../components/ScannerModal.jsx'

const ESTADOS = [
  { value: 'disponible', label: 'Disponible', cls: 'badge-success' },
  { value: 'en_uso', label: 'En uso', cls: 'badge-warning' },
  { value: 'en_reparacion', label: 'En reparación', cls: 'badge-danger' },
  { value: 'baja', label: 'Baja', cls: 'badge-muted' }
]

const EMPTY = { nombre: '', descripcion: '', categoria_id: '', codigo: '', estado: 'disponible', ubicacion: '', stock_actual: 1, stock_minimo: 1 }

export default function HerramientasView({ can }) {
  const [items, setItems] = useState([])
  const [categorias, setCategorias] = useState([])
  const [buscar, setBuscar] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modal, setModal] = useState(false)
  const [scanner, setScanner] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  function load() {
    const params = {}
    if (buscar) params.buscar = buscar
    if (filtroEstado) params.estado = filtroEstado
    api.get('/herramientas', { params }).then(r => setItems(r.data)).catch(() => {})
  }

  useEffect(() => {
    api.get('/admin/categorias').then(r => setCategorias(r.data.filter(c => c.tipo === 'herramienta'))).catch(() => {})
  }, [])

  useEffect(() => { load() }, [buscar, filtroEstado])

  function openNew() { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(item) { setEditing(item); setForm({ ...item, categoria_id: item.categoria_id || '' }); setModal(true) }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) await api.put(`/herramientas/${editing.id}`, form)
      else await api.post('/herramientas', form)
      setModal(false); load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar esta herramienta?')) return
    try {
      await api.delete(`/herramientas/${id}`)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  function onScan(codigo) {
    setScanner(false)
    setBuscar(codigo)
  }


  async function handleImport() {
    setImporting(true)
    try {
      const { data } = await api.post('/herramientas/import')
      // Los avisos explican filas omitidas, estados no reconocidos o filas sin
      // código, que si no pasarían desapercibidos.
      alert([data.message, ...(data.avisos || [])].join('\n\n'))
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  const estadoInfo = v => ESTADOS.find(e => e.value === v) || ESTADOS[0]

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Herramientas</h1><p>Gestión del inventario de herramientas</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('herramientas_editar') && (
            <button className="btn btn-secondary" onClick={handleImport} disabled={importing} title="Importar desde herramientas.xlsx">
              <FileSpreadsheet size={16} /> {importing ? 'Importando...' : 'Importar Excel'}
            </button>
          )}
          {can('herramientas_editar') && (
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nueva</button>
          )}
        </div>
      </div>

      <div className="search-bar">
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="glass-input" style={{ paddingLeft: 34, maxWidth: 240 }} placeholder="Buscar..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        </div>
        <select className="glass-input" style={{ maxWidth: 160 }} value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
        </select>
        <button className="btn btn-secondary" onClick={() => setScanner(true)}><ScanLine size={16} /> Escanear</button>
      </div>

      <div className="glass-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Código</th>
                <th>Estado</th>
                <th>Stock</th>
                <th>Ubicación</th>
                {can('herramientas_editar') && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7}>
                  <div className="empty-state"><Package size={40} /><p>Sin herramientas registradas</p></div>
                </td></tr>
              )}
              {items.map(item => (
                <motion.tr key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td><strong>{item.nombre}</strong>{item.descripcion && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.descripcion}</div>}</td>
                  <td>{item.categoria_nombre ? <span className="badge badge-info">{item.categoria_nombre}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td><code style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.codigo || '—'}</code></td>
                  <td><span className={`badge ${estadoInfo(item.estado).cls}`}>{estadoInfo(item.estado).label}</span></td>
                  <td>
                    <span>
                      {item.stock_disponible !== undefined && item.stock_disponible !== item.stock_actual ? 
                        `${item.stock_disponible} disp. / ${item.stock_actual} total` : 
                        item.stock_actual
                      }
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> / mín {item.stock_minimo}</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{item.ubicacion || '—'}</td>
                  {can('herramientas_editar') && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" onClick={() => openEdit(item)}><Edit2 size={14} /></button>
                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(item.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Editar herramienta' : 'Nueva herramienta'} onClose={() => setModal(false)}>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label>Nombre *</label>
                <input className="glass-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required />
              </div>
              <div className="form-group">
                <label>Código (barcode/NFC)</label>
                <input className="glass-input" value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value }))} placeholder="Ej: HT-001" />
              </div>
            </div>
            <div className="form-group">
              <label>Descripción</label>
              <input className="glass-input" value={form.descripcion} onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Categoría</label>
                <select className="glass-input" value={form.categoria_id} onChange={e => setForm(p => ({ ...p, categoria_id: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Estado</label>
                <select className="glass-input" value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value }))}>
                  {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Stock actual</label>
                <input type="number" min="0" className="glass-input" value={form.stock_actual} onChange={e => setForm(p => ({ ...p, stock_actual: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Stock mínimo</label>
                <input type="number" min="0" className="glass-input" value={form.stock_minimo} onChange={e => setForm(p => ({ ...p, stock_minimo: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="form-group">
              <label>Ubicación</label>
              <input className="glass-input" value={form.ubicacion} onChange={e => setForm(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ej: Taller A - Estante 3" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {scanner && <ScannerModal onScan={onScan} onClose={() => setScanner(false)} />}
    </div>
  )
}
