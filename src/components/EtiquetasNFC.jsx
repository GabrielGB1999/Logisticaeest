import React, { useState, useEffect, useRef } from 'react'
import { Printer, Nfc, Search, Settings2, LayoutTemplate } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import Barcode from 'react-barcode'
import api from '../services/api.js'

export default function EtiquetasNFC() {
  const [items, setItems] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [seleccionados, setSeleccionados] = useState([])

  // Configuraciones de etiqueta
  const [formato, setFormato] = useState('qr') // 'qr' o 'barcode'
  const [copias, setCopias] = useState(1)
  const [size, setSize] = useState(100) // tamaño del código
  const [mostrarTexto, setMostrarTexto] = useState(true)

  const [loading, setLoading] = useState(false)
  const [nfcStatus, setNfcStatus] = useState('')

  useEffect(() => {
    async function fetchData() {
      try {
        const [herrRes, insuRes] = await Promise.all([
          api.get('/herramientas'),
          api.get('/insumos')
        ])
        const processItems = (arr, tipo) => arr.filter(i => i.codigo).map(i => ({ ...i, tipo }))
        setItems([
          ...processItems(herrRes.data, 'Herramienta'),
          ...processItems(insuRes.data, 'Insumo')
        ])
      } catch (err) {
        console.error('Error cargando datos para etiquetas', err)
      }
    }
    fetchData()
  }, [])

  const filteredItems = items.filter(item => 
    item.nombre.toLowerCase().includes(busqueda.toLowerCase()) || 
    item.codigo.toLowerCase().includes(busqueda.toLowerCase())
  )

  const toggleSeleccion = (id, tipo) => {
    const key = `${tipo}-${id}`
    setSeleccionados(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const toggleAll = () => {
    if (seleccionados.length === filteredItems.length && filteredItems.length > 0) {
      setSeleccionados([]) // Deseleccionar todos
    } else {
      setSeleccionados(filteredItems.map(i => `${i.tipo}-${i.id}`)) // Seleccionar todos filtrados
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleGrabarNFC = async () => {
    if (seleccionados.length !== 1) {
      alert("Por favor, seleccione exactamente UN ítem para grabar en el chip NFC.")
      return
    }

    const key = seleccionados[0]
    const itemToRecord = items.find(i => `${i.tipo}-${i.id}` === key)

    if (!itemToRecord || !itemToRecord.codigo) return

    if (!('NDEFReader' in window)) {
      alert("Su navegador o dispositivo no soporta la API Web NFC. Pruebe usando Chrome en un dispositivo Android.")
      return
    }

    setLoading(true)
    setNfcStatus('Acerca la etiqueta NFC al dispositivo ahora...')

    try {
      const ndef = new window.NDEFReader()
      await ndef.write(itemToRecord.codigo)
      setNfcStatus('¡Grabación NFC exitosa!')
      setTimeout(() => setNfcStatus(''), 3000)
    } catch (error) {
      console.error(error)
      setNfcStatus(`Error al grabar: ${error.message || 'Desconocido'}`)
      setTimeout(() => setNfcStatus(''), 5000)
    } finally {
      setLoading(false)
    }
  }

  // Preparar el array final de elementos a imprimir multiplicados por las copias
  const elementsToPrint = []
  seleccionados.forEach(key => {
    const item = items.find(i => `${i.tipo}-${i.id}` === key)
    if (item) {
      for (let i = 0; i < copias; i++) {
        elementsToPrint.push(item)
      }
    }
  })

  return (
    <div className="etiquetas-container" style={{ display: 'flex', gap: 24, height: '100%', alignItems: 'stretch' }}>
      {/* Panel Izquierdo: Controles (oculto en impresión) */}
      <div className="no-print" style={{ flex: '0 0 320px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Panel de Configuración */}
        <div className="glass-card" style={{ padding: 16 }}>
          <h3 style={{ fontSize: 16, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings2 size={18} /> Configuración
          </h3>
          
          <div className="form-group">
            <label>Formato</label>
            <select className="glass-input" value={formato} onChange={e => setFormato(e.target.value)}>
              <option value="qr">Código QR</option>
              <option value="barcode">Código de Barras (CODE128)</option>
            </select>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label>Copias x ítem</label>
              <input type="number" className="glass-input" min={1} value={copias} onChange={e => setCopias(Number(e.target.value))} />
            </div>
            <div className="form-group">
              <label>Tamaño</label>
              <input type="number" className="glass-input" min={50} max={300} step={10} value={size} onChange={e => setSize(Number(e.target.value))} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
            <input type="checkbox" id="showText" checked={mostrarTexto} onChange={e => setMostrarTexto(e.target.checked)} />
            <label htmlFor="showText" style={{ cursor: 'pointer', margin: 0, fontSize: 14 }}>Mostrar nombre y código</label>
          </div>
        </div>

        {/* Panel de Selección */}
        <div className="glass-card" style={{ padding: 16, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Seleccionar Ítems</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{seleccionados.length} seleccionados</span>
          </div>

          <div style={{ position: 'relative', marginBottom: 12 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="glass-input" 
              placeholder="Buscar..." 
              value={busqueda} 
              onChange={e => setBusqueda(e.target.value)}
              style={{ paddingLeft: 30 }}
            />
          </div>

          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={filteredItems.length > 0 && seleccionados.length === filteredItems.length}
              onChange={toggleAll}
            />
            <span>Seleccionar todos</span>
          </label>

          <div style={{ flex: 1, overflowY: 'auto', marginTop: 8 }}>
            {filteredItems.map(item => {
              const key = `${item.tipo}-${item.id}`
              const isChecked = seleccionados.includes(key)
              return (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 6px', cursor: 'pointer', borderRadius: 6, background: isChecked ? 'rgba(0,242,254,0.1)' : 'transparent' }}>
                  <input type="checkbox" checked={isChecked} onChange={() => toggleSeleccion(item.id, item.tipo)} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.codigo} ({item.tipo})</div>
                  </div>
                </label>
              )
            })}
            {filteredItems.length === 0 && <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 20 }}>No se encontraron elementos con código predefinido.</p>}
          </div>
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={handleGrabarNFC} disabled={loading || seleccionados.length !== 1}>
            <Nfc size={16} /> Grabar NFC
          </button>
          <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={handlePrint} disabled={seleccionados.length === 0}>
            <Printer size={16} /> Imprimir Hoja
          </button>
        </div>
        {nfcStatus && <div style={{ fontSize: 13, padding: 8, background: 'var(--glass)', borderRadius: 8, border: '1px solid var(--glass-border)', textAlign: 'center' }}>{nfcStatus}</div>}
      </div>

      {/* Panel Derecho: Previsualización de la Hoja */}
      <div className="preview-panel" style={{ flex: 1, overflowY: 'auto', background: '#e0e0e0', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
        <div className="print-page" style={{ background: '#fff', width: '210mm', minHeight: '297mm', padding: '15mm', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', color: '#000' }}>
          {elementsToPrint.length === 0 ? (
            <div className="no-print" style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
              <LayoutTemplate size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p>Seleccione uno o más ítems para previsualizar la impresión.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5mm', justifyContent: 'flex-start', alignContent: 'flex-start' }}>
              {elementsToPrint.map((item, index) => (
                <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', pageBreakInside: 'avoid', maxWidth: '30mm', overflow: 'visible' }}>
                  {formato === 'qr' ? (
                    <QRCodeSVG value={item.codigo} size={size} level="L" />
                  ) : (
                    <div>
                      <Barcode value={item.codigo} format="CODE128" displayValue={false} background="transparent" lineColor="#000" width={1.5 * (size / 100)} height={40 * (size / 100)} margin={0} />
                    </div>
                  )}
                  {mostrarTexto && (
                    <div style={{ marginTop: 2, textAlign: 'center', lineHeight: '1.1' }}>
                      <div style={{ fontSize: 9, fontWeight: 'bold' }}>{item.nombre.length > 40 ? item.nombre.substring(0,40) + '...' : item.nombre}</div>
                      <div style={{ fontSize: 9 }}>{item.codigo}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
