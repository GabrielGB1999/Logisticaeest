import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, ArrowUpDown, ScanLine, Edit2, Trash2, Undo2 } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal.jsx'
import ScannerModal from '../components/ScannerModal.jsx'

const EMPTY = { tipo_item: 'herramienta', item_id: '', nuevo_nombre: '', tipo: 'salida', cantidad: 1, motivo: '', destinatario: '', observaciones: '' }

export default function MovimientosView({ can, user }) {
  const [movimientos, setMovimientos] = useState([])
  const [herramientas, setHerramientas] = useState([])
  const [insumos, setInsumos] = useState([])
  const [modal, setModal] = useState(false)
  const [scanner, setScanner] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)

  function load() {
    api.get('/movimientos', { params: { limit: 100 } }).then(r => setMovimientos(r.data)).catch(() => {})
  }

  useEffect(() => {
    load()
    api.get('/herramientas').then(r => setHerramientas(r.data)).catch(() => {})
    api.get('/insumos').then(r => setInsumos(r.data)).catch(() => {})
  }, [])

  const itemsDisponibles = form.tipo_item === 'herramienta' ? herramientas : insumos

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    try {
      let finalItemId = form.item_id

      if (form.item_id === 'nuevo_manual') {
        const itemPayload = { 
          nombre: form.nuevo_nombre, 
          stock_actual: form.tipo === 'salida' ? form.cantidad : 0 
        }
        const createRes = await api.post(`/${form.tipo_item}s`, itemPayload)
        finalItemId = createRes.data.id
      }

      const payload = { ...form, item_id: finalItemId }

      if (editingId) {
        await api.put(`/movimientos/${editingId}`, payload)
      } else {
        await api.post('/movimientos', payload)
      }
      setModal(false)
      setForm(EMPTY)
      setEditingId(null)
      load()
      // Refrescar listas de stock
      api.get('/herramientas').then(r => setHerramientas(r.data)).catch(() => {})
      api.get('/insumos').then(r => setInsumos(r.data)).catch(() => {})
    } catch (err) {
      alert(err.response?.data?.error || 'Error al registrar movimiento')
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!window.confirm('¿Estás seguro de eliminar este movimiento? Se ajustará el inventario automáticamente.')) return
    try {
      await api.delete(`/movimientos/${id}`)
      load()
      api.get('/herramientas').then(r => setHerramientas(r.data)).catch(() => {})
      api.get('/insumos').then(r => setInsumos(r.data)).catch(() => {})
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  function handleEdit(m) {
    setForm({
      tipo_item: m.tipo_item,
      item_id: m.item_id,
      nuevo_nombre: '',
      tipo: m.tipo,
      cantidad: m.cantidad,
      motivo: m.motivo || '',
      destinatario: m.destinatario || '',
      observaciones: m.observaciones || ''
    })
    setEditingId(m.id)
    setModal(true)
  }

  function handleDevolver(m) {
    setForm({
      tipo_item: m.tipo_item,
      item_id: m.item_id,
      nuevo_nombre: '',
      tipo: 'entrada',
      cantidad: m.cantidad,
      motivo: 'Devolución',
      destinatario: m.destinatario || '',
      observaciones: ''
    })
    setEditingId(null)
    setModal(true)
  }

  function onScan(codigo) {
    setScanner(false)
    // Buscar item por código
    const h = herramientas.find(x => x.codigo === codigo)
    const i = insumos.find(x => x.codigo === codigo)
    if (h) { setForm(p => ({ ...p, tipo_item: 'herramienta', item_id: h.id })); setModal(true) }
    else if (i) { setForm(p => ({ ...p, tipo_item: 'insumo', item_id: i.id })); setModal(true) }
    else alert(`Código no encontrado: ${codigo}`)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Movimientos</h1><p>Entradas y salidas de stock</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={() => setScanner(true)}><ScanLine size={16} /> Escanear</button>
          {can('movimientos_editar') && (
            <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setEditingId(null); setModal(true) }}><Plus size={16} /> Registrar</button>
          )}
        </div>
      </div>

      <div className="glass-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Item</th>
                <th>Movimiento</th>
                <th>Cantidad</th>
                <th>Motivo</th>
                <th>Destinatario</th>
                <th>Responsable</th>
                <th>Fecha</th>
                {can('movimientos_editar') && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {movimientos.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state"><ArrowUpDown size={40} /><p>Sin movimientos registrados</p></div></td></tr>
              )}
              {movimientos.map(m => (
                <motion.tr key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td><span className="badge badge-muted">{m.tipo_item === 'herramienta' ? 'Herram.' : 'Insumo'}</span></td>
                  <td><strong>{m.item_nombre}</strong></td>
                  <td><span className={`badge ${m.tipo === 'entrada' ? 'badge-success' : 'badge-warning'}`}>{m.tipo === 'entrada' ? 'Entrada' : 'Salida'}</span></td>
                  <td style={{ fontWeight: 600 }}>{m.tipo === 'entrada' ? '+' : '-'}{m.cantidad}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.motivo || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{m.destinatario || '—'}</td>
                  <td style={{ fontSize: 13 }}>{m.responsable_nombre}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(m.fecha).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  {can('movimientos_editar') && (
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {m.tipo === 'salida' && (
                          <button className="btn-icon" title="Devolver" onClick={() => handleDevolver(m)}>
                            <Undo2 size={14} color="var(--success)" />
                          </button>
                        )}
                        <button className="btn-icon" title="Editar" onClick={() => handleEdit(m)}>
                          <Edit2 size={14} />
                        </button>
                        <button className="btn-icon" title="Eliminar" onClick={() => handleDelete(m.id)}>
                          <Trash2 size={14} color="var(--danger)" />
                        </button>
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
        <Modal title={editingId ? "Editar movimiento" : "Registrar movimiento"} onClose={() => { setModal(false); setEditingId(null) }}>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group">
                <label>Tipo de item</label>
                <select className="glass-input" value={form.tipo_item} disabled={!!editingId} onChange={e => setForm(p => ({ ...p, tipo_item: e.target.value, item_id: '' }))}>
                  <option value="herramienta">Herramienta</option>
                  <option value="insumo">Insumo</option>
                </select>
              </div>
              <div className="form-group">
                <label>Movimiento</label>
                <select className="glass-input" value={form.tipo} onChange={e => setForm(p => ({ ...p, tipo: e.target.value }))}>
                  <option value="salida">Salida</option>
                  <option value="entrada">Entrada</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Item *</label>
              <select className="glass-input" value={form.item_id} disabled={!!editingId} onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))} required>
                <option value="">Seleccionar...</option>
                {itemsDisponibles.map(i => <option key={i.id} value={i.id}>{i.nombre} (stock: {i.stock_actual})</option>)}
                <option value="nuevo_manual" style={{ fontWeight: 'bold' }}>➕ Ingresar manualmente (no está en la lista)</option>
              </select>
            </div>
            {form.item_id === 'nuevo_manual' && (
              <div className="form-group" style={{ marginTop: 8 }}>
                <label>Nombre del nuevo item *</label>
                <input className="glass-input" value={form.nuevo_nombre} onChange={e => setForm(p => ({ ...p, nuevo_nombre: e.target.value }))} placeholder="Ej: Mecha copa 20mm" required />
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label>Cantidad *</label>
                <input type="number" min="0.01" step="0.01" className="glass-input" value={form.cantidad} onChange={e => setForm(p => ({ ...p, cantidad: Number(e.target.value) }))} required />
              </div>
              <div className="form-group">
                <label>Destinatario</label>
                <input className="glass-input" value={form.destinatario} onChange={e => setForm(p => ({ ...p, destinatario: e.target.value }))} placeholder="Ej: Aula 3B / Juan Pérez" />
              </div>
            </div>
            <div className="form-group">
              <label>Motivo</label>
              <input className="glass-input" value={form.motivo} onChange={e => setForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ej: Préstamo clase, Reposición, Devolución..." />
            </div>
            <div className="form-group">
              <label>Observaciones</label>
              <input className="glass-input" value={form.observaciones} onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Registrar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {scanner && <ScannerModal onScan={onScan} onClose={() => setScanner(false)} />}
    </div>
  )
}
