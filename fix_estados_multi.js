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
  
  const herramientas = await db.all("SELECT id, stock_actual, estado FROM herramientas");
  
  for (const h of herramientas) {
    const inUseRow = await db.get("SELECT COALESCE(SUM(cantidad), 0) as used FROM prestamos WHERE item_id = ? AND tipo_item = 'herramienta' AND estado = 'prestado'", [h.id]);
    const available = h.stock_actual - inUseRow.used;
    
    if (available > 0 && h.estado === 'en_uso') {
      await db.run("UPDATE herramientas SET estado = 'disponible' WHERE id = ?", [h.id]);
      console.log(`Corregido estado a disponible para herramienta ID ${h.id} (Disponibles: ${available})`);
    } else if (available <= 0 && h.estado === 'disponible') {
      await db.run("UPDATE herramientas SET estado = 'en_uso' WHERE id = ?", [h.id]);
      console.log(`Corregido estado a en_uso para herramienta ID ${h.id}`);
    }
  }
  
  console.log('Corrección de estados completada.');
}
run();
