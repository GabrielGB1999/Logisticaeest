import XLSX from 'xlsx'

// Normaliza un encabezado o un valor para poder compararlo sin depender de
// mayúsculas, acentos ni separadores: "Stock Mínimo", "stock_minimo" y
// "STOCK MINIMO" quedan todos como "stockminimo".
export function normalizar(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

// Lee todas las hojas del archivo y devuelve las filas con los encabezados ya
// normalizados. La primera fila de cada hoja son los nombres de las columnas.
export function leerPlanilla(rutaArchivo) {
  const libro = XLSX.readFile(rutaArchivo)
  const filas = []
  for (const nombreHoja of libro.SheetNames) {
    const datos = XLSX.utils.sheet_to_json(libro.Sheets[nombreHoja], { defval: '' })
    for (const cruda of datos) {
      const fila = {}
      for (const [clave, valor] of Object.entries(cruda)) {
        const k = normalizar(clave)
        // Si dos columnas normalizan igual, gana la primera que traiga dato.
        if (k && (fila[k] === undefined || String(fila[k]).trim() === '')) fila[k] = valor
      }
      filas.push(fila)
    }
  }
  return filas
}

// Devuelve el valor de la primera columna cuyo encabezado coincida con alguno
// de los alias. Así la planilla puede tener las columnas en cualquier orden y
// con distintos nombres habituales.
export function texto(fila, alias) {
  for (const a of alias) {
    const v = fila[normalizar(a)]
    if (v !== undefined && String(v).trim() !== '') return String(v).trim()
  }
  return ''
}

// Números tolerantes al formato español: "1.234,5" -> 1234.5. Si el valor trae
// coma se interpreta como separador decimal y el punto como de miles; si no,
// se lee tal cual (así "1.5" sigue siendo 1.5).
export function numero(fila, alias, porDefecto = null) {
  const v = texto(fila, alias)
  if (v === '') return porDefecto
  const limpio = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v
  const n = Number(limpio)
  return Number.isFinite(n) ? n : porDefecto
}

// Busca una categoría por nombre dentro del tipo indicado y, si no existe, la
// crea. categorias.nombre es UNIQUE para toda la tabla, así que si el nombre ya
// está usado por el otro tipo no se puede crear: en ese caso se avisa y el item
// queda sin categoría, en lugar de cortar la importación con un error de base.
export async function resolverCategoria(db, nombreCategoria, tipo, resumen) {
  if (!nombreCategoria) return null

  const existentes = await db.all('SELECT id, nombre, tipo FROM categorias')
  const buscado = normalizar(nombreCategoria)

  const delTipo = existentes.find(c => normalizar(c.nombre) === buscado && c.tipo === tipo)
  if (delTipo) return delTipo.id

  const deOtroTipo = existentes.find(c => normalizar(c.nombre) === buscado)
  if (deOtroTipo) {
    resumen.avisos.push(`La categoría "${nombreCategoria}" ya existe como ${deOtroTipo.tipo}; los items quedaron sin categoría.`)
    return null
  }

  const r = await db.run('INSERT INTO categorias (nombre, tipo, color) VALUES (?, ?, ?)', [nombreCategoria, tipo, '#00f2fe'])
  resumen.categoriasCreadas.push(nombreCategoria)
  return r.lastID
}

// Alias de columnas aceptados, compartidos por herramientas e insumos.
export const ALIAS = {
  codigo:       ['codigo', 'cod', 'code', 'codigo de barras', 'codigobarras', 'nro', 'numero'],
  nombre:       ['nombre', 'herramienta', 'insumo', 'articulo', 'item', 'producto', 'denominacion'],
  descripcion:  ['descripcion', 'detalle', 'observaciones', 'observacion', 'notas'],
  categoria:    ['categoria', 'rubro', 'familia', 'grupo'],
  ubicacion:    ['ubicacion', 'lugar', 'deposito', 'armario', 'tablero', 'estante', 'sector'],
  estado:       ['estado', 'condicion'],
  stockActual:  ['stock actual', 'stockactual', 'stock', 'cantidad', 'existencia', 'existencias'],
  stockMinimo:  ['stock minimo', 'stockminimo', 'minimo', 'min', 'stock critico'],
  unidad:       ['unidad', 'unidad de medida', 'um', 'medida'],
  proveedor:    ['proveedor', 'vendedor', 'fabricante', 'marca']
}

// Los estados válidos son los del CHECK de la tabla herramientas. Se aceptan
// las formas en que suelen escribirse a mano.
const ESTADOS = {
  disponible: 'disponible',
  enuso: 'en_uso', uso: 'en_uso', prestado: 'en_uso', prestada: 'en_uso',
  enreparacion: 'en_reparacion', reparacion: 'en_reparacion', reparando: 'en_reparacion',
  baja: 'baja', debaja: 'baja', dadadebaja: 'baja', fueradeservicio: 'baja'
}

export function estadoValido(valor, resumen) {
  if (!valor) return 'disponible'
  const e = ESTADOS[normalizar(valor)]
  if (e) return e
  resumen.avisos.push(`Estado "${valor}" no reconocido; se usó "disponible".`)
  return 'disponible'
}
