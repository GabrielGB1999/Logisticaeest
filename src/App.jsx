import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth.js'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import HerramientasView from './pages/HerramientasView.jsx'
import InsumosView from './pages/InsumosView.jsx'
import MovimientosView from './pages/MovimientosView.jsx'
import AlertasView from './pages/AlertasView.jsx'
import AdminView from './pages/AdminView.jsx'
import AlumnosView from './pages/AlumnosView.jsx'
import DocentesView from './pages/DocentesView.jsx'
import PrestamosView from './pages/PrestamosView.jsx'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import { useEffect, useState } from 'react'
import api from './services/api.js'

function ProtectedLayout({ user, logout, can }) {
  const [alertCount, setAlertCount] = useState(0)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  useEffect(() => {
    function fetchCount() {
      api.get('/alertas/count').then(r => setAlertCount(r.data.total)).catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="layout">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>}
      <Sidebar user={user} logout={logout} can={can} isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <div className="main-wrapper">
        <Header alertCount={alertCount} onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="main-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard can={can} />} />
            <Route path="/herramientas" element={can('herramientas_ver') ? <HerramientasView can={can} user={user} /> : <Navigate to="/dashboard" />} />
            <Route path="/insumos" element={can('insumos_ver') ? <InsumosView can={can} user={user} /> : <Navigate to="/dashboard" />} />
            <Route path="/movimientos" element={can('movimientos_ver') ? <MovimientosView can={can} user={user} /> : <Navigate to="/dashboard" />} />
            <Route path="/alertas" element={can('alertas_ver') ? <AlertasView can={can} /> : <Navigate to="/dashboard" />} />
            <Route path="/admin" element={can('admin_ver') ? <AdminView /> : <Navigate to="/dashboard" />} />
            <Route path="/prestamos" element={can('prestamos_ver') ? <PrestamosView can={can} user={user} /> : <Navigate to="/dashboard" />} />
            <Route path="/alumnos" element={can('alumnos_ver') ? <AlumnosView can={can} /> : <Navigate to="/dashboard" />} />
            <Route path="/docentes" element={can('docentes_ver') ? <DocentesView can={can} /> : <Navigate to="/dashboard" />} />
            <Route path="*" element={<Navigate to="/dashboard" />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  const { user, login, logout, can } = useAuth()

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login onLogin={login} />} />
        <Route path="/*" element={user ? <ProtectedLayout user={user} logout={logout} can={can} /> : <Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  )
}
