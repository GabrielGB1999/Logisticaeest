import { fileURLToPath } from 'url'
import { dirname, join, resolve, isAbsolute } from 'path'
import { mkdirSync, accessSync, constants } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Raíz de la aplicación: el código y los archivos que vienen con la imagen.
export const APP_ROOT = resolve(__dirname, '..')

// Una ruta relativa en el .env se interpreta desde la raíz del proyecto, para
// que "./datos" signifique lo mismo se ejecute desde donde se ejecute.
function desdeEnv(valor, porDefecto) {
  const v = valor?.trim()
  if (!v) return porDefecto
  return isAbsolute(v) ? v : resolve(APP_ROOT, v)
}

// DATA_DIR es la carpeta base de todo lo que debe sobrevivir a una
// actualización. Las tres rutas de abajo se pueden mover por separado si hace
// falta (por ejemplo, la base en un disco y las planillas en una carpeta de
// red); si no se definen, cuelgan de DATA_DIR.
export const DATA_DIR = desdeEnv(process.env.DATA_DIR, APP_ROOT)

// Archivo de la base de datos (ruta completa, incluido el nombre del archivo).
export const DB_FILE = desdeEnv(process.env.DB_FILE, join(DATA_DIR, 'logistica.sqlite'))

// Carpeta donde se dejan las planillas para importar (alumnos.xlsx).
export const EXCEL_DIR = desdeEnv(process.env.EXCEL_DIR, DATA_DIR)
export const ALUMNOS_XLSX = join(EXCEL_DIR, 'alumnos.xlsx')

// Carpeta donde se guardan los reportes de despacho generados.
export const REPORTES_DIR = desdeEnv(process.env.REPORTS_DIR, join(DATA_DIR, 'REPORTES_GUARDADOS'))

// La plantilla de despachos es de sólo lectura y viaja con el código.
export const PLANTILLA_DESPACHOS = join(APP_ROOT, 'planilla despachos.xltx')

function verificarEscritura(dir, etiqueta) {
  try {
    mkdirSync(dir, { recursive: true })
    // No alcanza con que exista: con un volumen de Docker montado con otro
    // dueño la carpeta está pero no se puede escribir, y el error que
    // aparecería más adelante no explicaría el motivo.
    accessSync(dir, constants.W_OK)
  } catch (err) {
    console.error(`No se puede escribir en ${etiqueta}: ${dir}`)
    console.error(`(${err.code || err.message})`)
    console.error('En Docker suele ser un problema de permisos del volumen. Probá:')
    console.error('  sudo chown -R 1000:1000 ./data')
    process.exit(1)
  }
}

export function ensureDataDir() {
  verificarEscritura(dirname(DB_FILE), 'la carpeta de la base de datos')
  verificarEscritura(EXCEL_DIR, 'la carpeta de planillas')
  verificarEscritura(REPORTES_DIR, 'la carpeta de reportes')
}
