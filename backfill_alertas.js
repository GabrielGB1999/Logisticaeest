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
  
  // Herramientas bajo stock
  const herramientas = await db.all("SELECT id, nombre, stock_actual, stock_minimo FROM herramientas WHERE stock_actual <= stock_minimo AND stock_minimo > 0 AND estado != 'baja'");
  for (const h of herramientas) {
    const existing = await db.get("SELECT id FROM alertas WHERE tipo_item = 'herramienta' AND item_id = ? AND leida = 0", [h.id]);
    if (!existing) {
      await db.run("INSERT INTO alertas (tipo_item, item_id, mensaje, leida) VALUES (?, ?, ?, 0)", 
        ['herramienta', h.id, `Stock bajo: ${h.nombre} (Quedan ${h.stock_actual})`]);
    }
  }

  // Insumos bajo stock
  const insumos = await db.all("SELECT id, nombre, stock_actual, stock_minimo FROM insumos WHERE stock_actual <= stock_minimo AND stock_minimo > 0");
  for (const i of insumos) {
    const existing = await db.get("SELECT id FROM alertas WHERE tipo_item = 'insumo' AND item_id = ? AND leida = 0", [i.id]);
    if (!existing) {
      await db.run("INSERT INTO alertas (tipo_item, item_id, mensaje, leida) VALUES (?, ?, ?, 0)", 
        ['insumo', i.id, `Stock bajo: ${i.nombre} (Quedan ${i.stock_actual})`]);
    }
  }
  console.log('Alertas actualizadas con retroactividad.');
}
run();
