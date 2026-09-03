import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Edit2, Trash2, Users, Tag, Printer } from 'lucide-react'
import api from '../services/api.js'
import Modal from '../components/Modal.jsx'
import EtiquetasNFC from '../components/EtiquetasNFC.jsx'

const EMPTY_USER = { usuario: '', password: '', nombre: '', email: '', role_id: '' }
const EMPTY_CAT = { nombre: '', tipo: 'herramienta', color: '#00f2fe' }

export default function AdminView() {
  const [tab, setTab] = useState('usuarios')
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [categorias, setCategorias] = useState([])
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [formUser, setFormUser] = useState(EMPTY_USER)
  const [formCat, setFormCat] = useState(EMPTY_CAT)
  const [saving, setSaving] = useState(false)

  function loadUsuarios() { api.get('/admin/usuarios').then(r => setUsuarios(r.data)).catch(() => {}) }
  function loadCategorias() { api.get('/admin/categorias').then(r => setCategorias(r.data)).catch(() => {}) }

  useEffect(() => {
    api.get('/admin/roles').then(r => setRoles(r.data)).catch(() => {})
    loadUsuarios()
    loadCategorias()
  }, [])

  // Usuarios
  async function saveUser(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) await api.put(`/admin/usuarios/${editing.id}`, formUser)
      else await api.post('/admin/usuarios', formUser)
      setModal(false); loadUsuarios()
    } catch (err) { alert(err.response?.data?.error || 'Error') } finally { setSaving(false) }
  }

  async function deleteUser(id) {
    if (!confirm('¿Eliminar usuario?')) return
    try {
      await api.delete(`/admin/usuarios/${id}`); loadUsuarios()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  // Categorías
  async function saveCat(e) {
    e.preventDefault(); setSaving(true)
    try {
      if (editing) await api.put(`/admin/categorias/${editing.id}`, formCat)
      else await api.post('/admin/categorias', formCat)
      setModal(false); loadCategorias()
    } catch (err) { alert(err.response?.data?.error || 'Error') } finally { setSaving(false) }
  }

  async function deleteCat(id) {
    if (!confirm('¿Eliminar categoría?')) return
    try {
      await api.delete(`/admin/categorias/${id}`); loadCategorias()
    } catch (err) {
      alert(err.response?.data?.error || 'Error al eliminar')
    }
  }

  const tabStyle = active => ({
    padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 14, fontWeight: 500, transition: 'all 0.2s',
    background: active ? 'rgba(0,242,254,0.1)' : 'transparent',
    color: active ? 'var(--primary)' : 'var(--text-muted)'
  })

  return (
    <div>
      <div className="page-header"><h1>Administración</h1><p>Usuarios y configuración del sistema</p></div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--glass)', borderRadius: 12, padding: 4, width: 'fit-content', border: '1px solid var(--glass-border)' }}>
        <button style={tabStyle(tab === 'usuarios')} onClick={() => setTab('usuarios')}><Users size={14} style={{ marginRight: 6 }} />Usuarios</button>
        <button style={tabStyle(tab === 'categorias')} onClick={() => setTab('categorias')}><Tag size={14} style={{ marginRight: 6 }} />Categorías</button>
        <button style={tabStyle(tab === 'etiquetas')} onClick={() => setTab('etiquetas')}><Printer size={14} style={{ marginRight: 6 }} />Etiquetas y NFC</button>
      </div>

      {tab === 'usuarios' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setFormUser(EMPTY_USER); setModal('user') }}>
              <Plus size={14} /> Nuevo usuario
            </button>
          </div>
          <div className="glass-card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Usuario</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {usuarios.map(u => (
                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td><strong>{u.nombre}</strong></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.usuario}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{u.email || '—'}</td>
                      <td><span className="badge badge-info">{u.rol_nombre}</span></td>
                      <td><span className={`badge ${u.activo ? 'badge-success' : 'badge-muted'}`}>{u.activo ? 'Activo' : 'Inactivo'}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-icon" onClick={() => { setEditing(u); setFormUser({ ...u, password: '' }); setModal('user') }}><Edit2 size={14} /></button>
                          <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => deleteUser(u.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'categorias' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button className="btn btn-primary btn-sm" onClick={() => { setEditing(null); setFormCat(EMPTY_CAT); setModal('cat') }}>
              <Plus size={14} /> Nueva categoría
            </button>
          </div>
          <div className="glass-card">
            <div className="table-wrap">
              <table>
                <thead><tr><th>Nombre</th><th>Tipo</th><th>Color</th><th></th></tr></thead>
                <tbody>
                  {categorias.map(c => (
                    <motion.tr key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <td><strong>{c.nombre}</strong></td>
                      <td><span className="badge badge-muted">{c.tipo}</span></td>
                      <td><div style={{ width: 24, height: 24, borderRadius: 6, background: c.color }} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn-icon" onClick={() => { setEditing(c); setFormCat({ nombre: c.nombre, tipo: c.tipo, color: c.color }); setModal('cat') }}><Edit2 size={14} /></button>
                          <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => deleteCat(c.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 'etiquetas' && (
        <div style={{ height: 'calc(100vh - 220px)', minHeight: 500 }}>
          <EtiquetasNFC />
        </div>
      )}

      {modal === 'user' && (
        <Modal title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setModal(false)}>
          <form onSubmit={saveUser}>
            <div className="form-row">
              <div className="form-group"><label>Nombre completo *</label><input className="glass-input" value={formUser.nombre} onChange={e => setFormUser(p => ({ ...p, nombre: e.target.value }))} required /></div>
              <div className="form-group"><label>Usuario *</label><input className="glass-input" value={formUser.usuario} onChange={e => setFormUser(p => ({ ...p, usuario: e.target.value }))} required disabled={!!editing} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>{editing ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label><input type="password" className="glass-input" value={formUser.password} onChange={e => setFormUser(p => ({ ...p, password: e.target.value }))} required={!editing} /></div>
              <div className="form-group"><label>Email</label><input type="email" className="glass-input" value={formUser.email} onChange={e => setFormUser(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Rol *</label>
                <select className="glass-input" value={formUser.role_id} onChange={e => setFormUser(p => ({ ...p, role_id: e.target.value }))} required>
                  <option value="">Seleccionar rol</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              {editing && <div className="form-group"><label>Estado</label>
                <select className="glass-input" value={formUser.activo} onChange={e => setFormUser(p => ({ ...p, activo: Number(e.target.value) }))}>
                  <option value={1}>Activo</option><option value={0}>Inactivo</option>
                </select>
              </div>}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {modal === 'cat' && (
        <Modal title={editing ? 'Editar categoría' : 'Nueva categoría'} onClose={() => setModal(false)}>
          <form onSubmit={saveCat}>
            <div className="form-group"><label>Nombre *</label><input className="glass-input" value={formCat.nombre} onChange={e => setFormCat(p => ({ ...p, nombre: e.target.value }))} required /></div>
            <div className="form-row">
              <div className="form-group"><label>Tipo</label>
                <select className="glass-input" value={formCat.tipo} onChange={e => setFormCat(p => ({ ...p, tipo: e.target.value }))} disabled={!!editing}>
                  <option value="herramienta">Herramienta</option><option value="insumo">Insumo</option>
                </select>
              </div>
              <div className="form-group"><label>Color</label><input type="color" className="glass-input" value={formCat.color} onChange={e => setFormCat(p => ({ ...p, color: e.target.value }))} style={{ height: 42, padding: 4 }} /></div>
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
