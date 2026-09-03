import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, Search, FileSpreadsheet, GraduationCap } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal.jsx'

const EMPTY = { nombre: '', apellido: '', dni: '', curso: '', grupo: '', turno: 'Mañana' }
const TURNOS = ['Mañana', 'Tarde', 'Noche']

export default function AlumnosView({ can }) {
  const [alumnos, setAlumnos] = useState([])
  const [total, setTotal] = useState(0)
  const [buscar, setBuscar] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  function load() {
    const params = { limit: 200 }
    if (buscar) params.buscar = buscar
    api.get('/alumnos', { params }).then(r => { setAlumnos(r.data.data); setTotal(r.data.total) }).catch(() => {})
  }

  useEffect(() => { load() }, [buscar])

  function openNew() { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(a) { setEditing(a); setForm({ ...a }); setModal(true) }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) await api.put(`/alumnos/${editing.id}`, form)
      else await api.post('/alumnos', form)
      setModal(false); load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este alumno?')) return
    try {
      await api.delete(`/alumnos/${id}`); load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  async function handleImport() {
    setImporting(true)
    try {
      const { data } = await api.post('/alumnos/import')
      // Los avisos explican, por ejemplo, que la planilla se leyó con el
      // formato viejo o cuántas filas se saltearon: sin esto pasarían
      // desapercibidos.
      alert([data.message, ...(data.avisos || [])].join('\n\n'))
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al importar')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Alumnos</h1><p>{total} alumnos registrados</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {can('alumnos_editar') && (
            <button className="btn btn-secondary" onClick={handleImport} disabled={importing} title="Importar desde alumnos.xlsx">
              <FileSpreadsheet size={16} /> {importing ? 'Importando...' : 'Importar Excel'}
            </button>
          )}
          {can('alumnos_editar') && (
            <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nuevo</button>
          )}
        </div>
      </div>

      <div className="search-bar">
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input className="glass-input" style={{ paddingLeft: 34, maxWidth: 280 }} placeholder="Buscar por apellido, nombre o DNI..." value={buscar} onChange={e => setBuscar(e.target.value)} />
        </div>
      </div>

      <div className="glass-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Apellido, Nombre</th>
                <th>DNI</th>
                <th>Curso / Grupo</th>
                <th>Turno</th>
                {can('alumnos_editar') && <th></th>}
              </tr>
            </thead>
            <tbody>
              {alumnos.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state"><GraduationCap size={40} /><p>Sin alumnos registrados</p></div></td></tr>
              )}
              {alumnos.map(a => (
                <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td><strong>{a.apellido}, {a.nombre}</strong></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{a.dni}</td>
                  <td style={{ fontSize: 13 }}>{[a.curso, a.grupo].filter(Boolean).join(' ') || '—'}</td>
                  <td><span className="badge badge-muted">{a.turno || '—'}</span></td>
                  {can('alumnos_editar') && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn-icon" onClick={() => openEdit(a)}><Edit2 size={14} /></button>
                        <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(a.id)}><Trash2 size={14} /></button>
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
        <Modal title={editing ? 'Editar alumno' : 'Nuevo alumno'} onClose={() => setModal(false)}>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group"><label>Apellido *</label><input className="glass-input" value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} required /></div>
              <div className="form-group"><label>Nombre *</label><input className="glass-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required /></div>
            </div>
            <div className="form-group"><label>DNI *</label><input className="glass-input" value={form.dni} onChange={e => setForm(p => ({ ...p, dni: e.target.value }))} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Curso</label><input className="glass-input" value={form.curso} onChange={e => setForm(p => ({ ...p, curso: e.target.value }))} placeholder="Ej: 1°" /></div>
              <div className="form-group"><label>Grupo</label><input className="glass-input" value={form.grupo} onChange={e => setForm(p => ({ ...p, grupo: e.target.value }))} placeholder="Ej: A, 1" /></div>
            </div>
            <div className="form-group">
              <label>Turno</label>
              <select className="glass-input" value={form.turno} onChange={e => setForm(p => ({ ...p, turno: e.target.value }))}>
                {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
