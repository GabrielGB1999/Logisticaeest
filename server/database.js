import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

let db

export async function getDB() {
  if (db) return db
  db = await open({
    filename: join(__dirname, '..', 'logistica.sqlite'),
    driver: sqlite3.Database
  })
  await db.run('PRAGMA journal_mode = WAL')
  await db.run('PRAGMA foreign_keys = ON')
  await initDB()
  return db
}

async function initDB() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      permisos TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      nombre TEXT NOT NULL,
      email TEXT,
      role_id INTEGER NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_el TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (role_id) REFERENCES roles(id)
    );
    CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      tipo TEXT NOT NULL CHECK(tipo IN ('herramienta', 'insumo')),
      color TEXT NOT NULL DEFAULT '#00f2fe'
    );
    CREATE TABLE IF NOT EXISTS herramientas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria_id INTEGER,
      codigo TEXT UNIQUE,
      estado TEXT NOT NULL DEFAULT 'disponible' CHECK(estado IN ('disponible', 'en_uso', 'en_reparacion', 'baja')),
      ubicacion TEXT,
      stock_actual INTEGER NOT NULL DEFAULT 1,
      stock_minimo INTEGER NOT NULL DEFAULT 1,
      creado_el TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );
    CREATE TABLE IF NOT EXISTS insumos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria_id INTEGER,
      codigo TEXT UNIQUE,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      stock_actual REAL NOT NULL DEFAULT 0,
      stock_minimo REAL NOT NULL DEFAULT 0,
      ubicacion TEXT,
      proveedor TEXT,
      creado_el TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    );
    CREATE TABLE IF NOT EXISTS movimientos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_item TEXT NOT NULL CHECK(tipo_item IN ('herramienta', 'insumo')),
      item_id INTEGER NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('entrada', 'salida')),
      cantidad REAL NOT NULL,
      motivo TEXT,
      responsable_id INTEGER NOT NULL,
      destinatario TEXT,
      observaciones TEXT,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
    );
    CREATE TABLE IF NOT EXISTS alertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo_item TEXT NOT NULL CHECK(tipo_item IN ('herramienta', 'insumo')),
      item_id INTEGER NOT NULL,
      mensaje TEXT NOT NULL,
      leida INTEGER NOT NULL DEFAULT 0,
      creada_el TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS alumnos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL,
      curso TEXT,
      grupo TEXT,
      turno TEXT DEFAULT 'Mañana',
      creado_el TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS docentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT NOT NULL,
      dni TEXT UNIQUE NOT NULL,
      especialidad TEXT,
      creado_el TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS docente_horarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      docente_id INTEGER NOT NULL,
      curso TEXT,
      grupo TEXT,
      turno TEXT,
      dia TEXT,
      FOREIGN KEY (docente_id) REFERENCES docentes(id)
    );
    CREATE TABLE IF NOT EXISTS prestamos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      persona_tipo TEXT NOT NULL CHECK(persona_tipo IN ('alumno', 'docente')),
      persona_id INTEGER NOT NULL,
      tipo_item TEXT NOT NULL CHECK(tipo_item IN ('herramienta', 'insumo')),
      item_id INTEGER NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      estado TEXT NOT NULL DEFAULT 'prestado' CHECK(estado IN ('prestado', 'devuelto')),
      responsable_id INTEGER NOT NULL,
      fecha_inicio TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_fin TEXT,
      observaciones TEXT,
      nombre_manual TEXT,
      FOREIGN KEY (responsable_id) REFERENCES usuarios(id)
    );
    CREATE INDEX IF NOT EXISTS idx_herramientas_codigo ON herramientas(codigo);
    CREATE INDEX IF NOT EXISTS idx_insumos_codigo ON insumos(codigo);
    CREATE INDEX IF NOT EXISTS idx_movimientos_item ON movimientos(tipo_item, item_id);
    CREATE INDEX IF NOT EXISTS idx_alertas_leida ON alertas(leida);
    CREATE INDEX IF NOT EXISTS idx_alumnos_dni ON alumnos(dni);
    CREATE INDEX IF NOT EXISTS idx_docentes_dni ON docentes(dni);
    CREATE INDEX IF NOT EXISTS idx_prestamos_persona ON prestamos(persona_tipo, persona_id);
    CREATE INDEX IF NOT EXISTS idx_prestamos_estado ON prestamos(estado);
  `)

  // Migración: bases creadas antes de que nombre_manual existiera en el esquema.
  // Idempotente: en una base nueva la columna ya viene del CREATE TABLE.
  const colsPrestamos = await db.all('PRAGMA table_info(prestamos)')
  if (!colsPrestamos.some(c => c.name === 'nombre_manual')) {
    await db.exec('ALTER TABLE prestamos ADD COLUMN nombre_manual TEXT')
  }

  const roles = [
    { nombre: 'Administrador', permisos: JSON.stringify(['dashboard','herramientas_ver','herramientas_editar','insumos_ver','insumos_editar','movimientos_ver','movimientos_editar','alertas_ver','alertas_gestionar','admin_ver','admin_editar','alumnos_ver','alumnos_editar','docentes_ver','docentes_editar','prestamos_ver','prestamos_editar']) },
    { nombre: 'Encargado', permisos: JSON.stringify(['dashboard','herramientas_ver','herramientas_editar','insumos_ver','insumos_editar','movimientos_ver','movimientos_editar','alertas_ver','alumnos_ver','alumnos_editar','docentes_ver','docentes_editar','prestamos_ver','prestamos_editar']) },
    { nombre: 'Docente', permisos: JSON.stringify(['dashboard','herramientas_ver','insumos_ver','movimientos_ver','alertas_ver','alumnos_ver','docentes_ver','prestamos_ver']) }
  ]
  for (const r of roles) {
    await db.run('INSERT OR IGNORE INTO roles (nombre, permisos) VALUES (?, ?)', [r.nombre, r.permisos])
  }
  // Agregar a los roles existentes los permisos de módulos nuevos, sin pisar los
  // que ya tengan: antes esto era un UPDATE que reescribía la lista completa en
  // cada arranque y borraba cualquier ajuste hecho sobre un rol.
  for (const r of roles) {
    const actual = await db.get('SELECT permisos FROM roles WHERE nombre = ?', [r.nombre])
    if (!actual) continue
    let permisos
    try {
      permisos = JSON.parse(actual.permisos)
      if (!Array.isArray(permisos)) permisos = []
    } catch {
      permisos = []
    }
    const faltantes = JSON.parse(r.permisos).filter(p => !permisos.includes(p))
    if (faltantes.length) {
      await db.run('UPDATE roles SET permisos = ? WHERE nombre = ?', [JSON.stringify([...permisos, ...faltantes]), r.nombre])
    }
  }

  const adminExists = await db.get('SELECT id FROM usuarios WHERE usuario = ?', ['admin'])
  if (!adminExists) {
    const adminRole = await db.get('SELECT id FROM roles WHERE nombre = ?', ['Administrador'])
    const inicial = process.env.ADMIN_PASSWORD || 'admin123'
    const hash = bcrypt.hashSync(inicial, 10)
    await db.run('INSERT INTO usuarios (usuario, password, nombre, role_id) VALUES (?, ?, ?, ?)', ['admin', hash, 'Administrador', adminRole.id])
    console.log(`Usuario admin creado: admin / ${inicial}`)
    if (!process.env.ADMIN_PASSWORD) {
      console.warn('ATENCION: se usó la contraseña por defecto, que es pública (está en el repositorio).')
      console.warn('Cambiala desde Administración -> Usuarios, o definí ADMIN_PASSWORD en .env antes del primer arranque.')
    }
  }

  const cats = [
    { nombre: 'Herramientas manuales', tipo: 'herramienta', color: '#f59e0b' },
    { nombre: 'Herramientas eléctricas', tipo: 'herramienta', color: '#ef4444' },
    { nombre: 'Instrumentos de medición', tipo: 'herramienta', color: '#8b5cf6' },
    { nombre: 'Materiales eléctricos', tipo: 'insumo', color: '#3b82f6' },
    { nombre: 'Materiales de construcción', tipo: 'insumo', color: '#10b981' },
    { nombre: 'Consumibles de taller', tipo: 'insumo', color: '#06b6d4' }
  ]
  for (const c of cats) {
    await db.run('INSERT OR IGNORE INTO categorias (nombre, tipo, color) VALUES (?, ?, ?)', [c.nombre, c.tipo, c.color])
  }

  // Rehash contraseñas planas
  const usuarios = await db.all('SELECT id, password FROM usuarios')
  for (const u of usuarios) {
    if (!u.password.startsWith('$2')) {
      await db.run('UPDATE usuarios SET password = ? WHERE id = ?', [bcrypt.hashSync(u.password, 10), u.id])
    }
  }
}
