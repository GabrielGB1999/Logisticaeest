import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, CalendarDays, Users } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal.jsx'

const EMPTY = { nombre: '', apellido: '', dni: '', especialidad: '' }
const EMPTY_H = { curso: '', grupo: '', turno: 'Mañana', dia: 'Lunes' }
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const TURNOS = ['Mañana', 'Tarde', 'Noche']

export default function DocentesView({ can }) {
  const [docentes, setDocentes] = useState([])
  const [modal, setModal] = useState(false)
  const [modalHorarios, setModalHorarios] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [selDocente, setSelDocente] = useState(null)
  const [horarios, setHorarios] = useState([])
  const [hForm, setHForm] = useState(EMPTY_H)
  const [saving, setSaving] = useState(false)

  function load() {
    api.get('/docentes').then(r => setDocentes(r.data)).catch(() => {})
  }

  useEffect(() => { load() }, [])

  function openNew() { setEditing(null); setForm(EMPTY); setModal(true) }
  function openEdit(d) { setEditing(d); setForm({ ...d }); setModal(true) }

  async function handleSave(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) await api.put(`/docentes/${editing.id}`, form)
      else await api.post('/docentes', form)
      setModal(false); load()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al guardar')
    } finally { setSaving(false) }
  }

  async function handleDelete(id) {
    if (!confirm('¿Eliminar este docente?')) return
    await api.delete(`/docentes/${id}`); load()
  }

  async function openHorarios(d) {
    setSelDocente(d)
    const r = await api.get(`/docentes/${d.id}/horarios`)
    setHorarios(r.data)
    setHForm(EMPTY_H)
    setModalHorarios(true)
  }

  async function addHorario(e) {
    e.preventDefault()
    await api.post(`/docentes/${selDocente.id}/horarios`, hForm)
    const r = await api.get(`/docentes/${selDocente.id}/horarios`)
    setHorarios(r.data)
    setHForm(EMPTY_H)
  }

  async function delHorario(horarioId) {
    if (!confirm('¿Eliminar esta asignación?')) return
    await api.delete(`/docentes/${selDocente.id}/horarios/${horarioId}`)
    const r = await api.get(`/docentes/${selDocente.id}/horarios`)
    setHorarios(r.data)
  }

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div><h1>Docentes</h1><p>Personal docente registrado</p></div>
        {can('docentes_editar') && (
          <button className="btn btn-primary" onClick={openNew}><Plus size={16} /> Nuevo</button>
        )}
      </div>

      <div className="glass-card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Apellido, Nombre</th>
                <th>DNI</th>
                <th>Especialidad</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {docentes.length === 0 && (
                <tr><td colSpan={4}><div className="empty-state"><Users size={40} /><p>Sin docentes registrados</p></div></td></tr>
              )}
              {docentes.map(d => (
                <motion.tr key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <td><strong>{d.apellido}, {d.nombre}</strong></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{d.dni}</td>
                  <td style={{ fontSize: 13 }}>{d.especialidad || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-icon" title="Horarios" onClick={() => openHorarios(d)}><CalendarDays size={14} color="var(--primary)" /></button>
                      {can('docentes_editar') && <button className="btn-icon" onClick={() => openEdit(d)}><Edit2 size={14} /></button>}
                      {can('docentes_editar') && <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(d.id)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal title={editing ? 'Editar docente' : 'Nuevo docente'} onClose={() => setModal(false)}>
          <form onSubmit={handleSave}>
            <div className="form-row">
              <div className="form-group"><label>Apellido *</label><input className="glass-input" value={form.apellido} onChange={e => setForm(p => ({ ...p, apellido: e.target.value }))} required /></div>
              <div className="form-group"><label>Nombre *</label><input className="glass-input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} required /></div>
            </div>
            <div className="form-group"><label>DNI *</label><input className="glass-input" value={form.dni} onChange={e => setForm(p => ({ ...p, dni: e.target.value }))} required /></div>
            <div className="form-group"><label>Especialidad / Materia</label><input className="glass-input" value={form.especialidad} onChange={e => setForm(p => ({ ...p, especialidad: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {modalHorarios && selDocente && (
        <Modal title={`Horarios: ${selDocente.apellido}, ${selDocente.nombre}`} onClose={() => setModalHorarios(false)}>
          {can('docentes_editar') && (
            <form onSubmit={addHorario} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--glass-border)' }}>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>Asignar nuevo turno</p>
              <div className="form-row">
                <div className="form-group"><label>Curso</label><input className="glass-input" value={hForm.curso} onChange={e => setHForm(p => ({ ...p, curso: e.target.value }))} placeholder="Ej: 2°" /></div>
                <div className="form-group"><label>Grupo</label><input className="glass-input" value={hForm.grupo} onChange={e => setHForm(p => ({ ...p, grupo: e.target.value }))} placeholder="Ej: A" /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Turno</label>
                  <select className="glass-input" value={hForm.turno} onChange={e => setHForm(p => ({ ...p, turno: e.target.value }))}>
                    {TURNOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Día</label>
                  <select className="glass-input" value={hForm.dia} onChange={e => setHForm(p => ({ ...p, dia: e.target.value }))}>
                    {DIAS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }}><Plus size={14} /> Asignar</button>
            </form>
          )}
          <div style={{ maxHeight: 280, overflowY: 'auto' }}>
            {horarios.length === 0 && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 16, fontSize: 13 }}>Sin horarios asignados</p>}
            {horarios.map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--glass)', borderRadius: 8, marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{h.curso} {h.grupo}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{h.dia} · {h.turno}</div>
                </div>
                {can('docentes_editar') && (
                  <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => delHorario(h.id)}><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
