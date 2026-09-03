import { useEffect, useRef, useState } from 'react'
import { X, ScanLine, Nfc, Keyboard } from 'lucide-react'

// Barcode scanner usando html5-qrcode (cámara)
// NFC scanner usando Web NFC API (Chrome en Android)

export default function ScannerModal({ onScan, onClose }) {
  const [modo, setModo] = useState('camara') // 'camara' | 'nfc' | 'manual'
  const [manual, setManual] = useState('')
  const [error, setError] = useState('')
  const [nfcStatus, setNfcStatus] = useState('idle') // 'idle' | 'leyendo' | 'error'
  const scannerRef = useRef(null)
  const html5QrRef = useRef(null)
  const nfcAbort = useRef(null)

  // Cámara / barcode
  useEffect(() => {
    if (modo !== 'camara') return

    let isMounted = true
    let scanner = null

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!isMounted) return
      scanner = new Html5Qrcode('qr-reader')
      html5QrRef.current = scanner
      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        decoded => { 
          try { scanner.stop().catch(()=>{}) } catch(e) {}
          onScan(decoded) 
        },
        () => {}
      ).catch(err => {
        if(isMounted) setError('Error al acceder a la cámara. Revise los permisos.')
      })
    })

    return () => {
      isMounted = false
      if (scanner) {
        try { scanner.stop().catch(()=>{}) } catch(e) {}
      }
    }
  }, [modo])

  // NFC
  useEffect(() => {
    if (modo !== 'nfc') return

    if (!('NDEFReader' in window)) {
      setError('NFC no disponible en este dispositivo o navegador. Usá Chrome en Android.')
      return
    }

    const controller = new AbortController()
    nfcAbort.current = controller
    setNfcStatus('leyendo')
    setError('')

    async function startNFC() {
      try {
        const ndef = new window.NDEFReader()
        await ndef.scan({ signal: controller.signal })
        ndef.onreading = ({ message }) => {
          for (const record of message.records) {
            if (record.recordType === 'text') {
              const decoder = new TextDecoder(record.encoding || 'utf-8')
              const text = decoder.decode(record.data)
              controller.abort()
              onScan(text)
              return
            }
            if (record.recordType === 'url') {
              const decoder = new TextDecoder()
              onScan(decoder.decode(record.data))
              controller.abort()
              return
            }
          }
        }
        ndef.onreadingerror = () => setError('Error al leer etiqueta NFC')
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('NFC: ' + err.message)
          setNfcStatus('error')
        }
      }
    }

    startNFC()
    return () => controller.abort()
  }, [modo])

  function handleManual(e) {
    e.preventDefault()
    if (manual.trim()) onScan(manual.trim())
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-box" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h2>Escanear código</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* Selector de modo */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'camara', icon: <ScanLine size={14} />, label: 'Barcode / QR' },
            { key: 'nfc', icon: <Nfc size={14} />, label: 'NFC' },
            { key: 'manual', icon: <Keyboard size={14} />, label: 'Manual' }
          ].map(m => (
            <button
              key={m.key}
              className={`btn ${modo === m.key ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => { setError(''); setModo(m.key) }}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>

        {/* Cámara */}
        {modo === 'camara' && (
          <div>
            <div id="qr-reader" ref={scannerRef} style={{ width: '100%', borderRadius: 12, overflow: 'hidden', background: '#000', minHeight: 200 }} />
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
              Apuntá la cámara al código de barras o QR
            </p>
          </div>
        )}

        {/* NFC */}
        {modo === 'nfc' && (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 16px',
              background: nfcStatus === 'leyendo' ? 'rgba(0,242,254,0.1)' : 'var(--glass)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: nfcStatus === 'leyendo' ? 'pulse 1.5s infinite' : 'none',
              border: '2px solid var(--primary)'
            }}>
              <Nfc size={36} color="var(--primary)" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 500 }}>
              {nfcStatus === 'leyendo' ? 'Acercá la etiqueta NFC...' : 'Preparando NFC'}
            </p>
            <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
          </div>
        )}

        {/* Manual */}
        {modo === 'manual' && (
          <form onSubmit={handleManual}>
            <div className="form-group">
              <label>Código del item</label>
              <input
                className="glass-input"
                value={manual}
                onChange={e => setManual(e.target.value)}
                placeholder="Ingresá el código manualmente"
                autoFocus
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
              Buscar
            </button>
          </form>
        )}

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>
        )}
      </div>
    </div>
  )
}
