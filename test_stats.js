import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function run() {
  const db = await open({
    filename: join(__dirname, 'logistica.sqlite'),
    driver: sqlite3.Database
  });
  
  const prestamosActivos = await db.all("SELECT * FROM prestamos WHERE estado = 'prestado'");
  console.log('Prestamos activos:', prestamosActivos);

  const sumHerramientas = await db.get("SELECT COALESCE(SUM(cantidad), 0) as n FROM prestamos WHERE estado = 'prestado' AND tipo_item = 'herramienta'");
  console.log('Sum herramientas:', sumHerramientas);

  const stats = await Promise.all([
    db.get('SELECT COUNT(*) as n FROM herramientas WHERE estado != "baja"'),
    db.get('SELECT COUNT(*) as n FROM herramientas WHERE estado = "disponible"'),
    db.get('SELECT COALESCE(SUM(cantidad), 0) as n FROM prestamos WHERE estado = "prestado" AND tipo_item = "herramienta"'),
    db.get('SELECT COUNT(*) as n FROM insumos'),
    db.get('SELECT COUNT(*) as n FROM alertas WHERE leida = 0'),
    db.get('SELECT COUNT(*) as n FROM prestamos WHERE estado = "prestado"'),
    db.get('SELECT COUNT(*) as n FROM herramientas WHERE stock_actual <= stock_minimo AND stock_minimo > 0 AND estado != "baja"'),
    db.get('SELECT COUNT(*) as n FROM insumos WHERE stock_actual <= stock_minimo AND stock_minimo > 0')
  ]);
  console.log('Stats queries:', stats);
}
run();
