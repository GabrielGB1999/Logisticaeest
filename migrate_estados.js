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
  
  // 1. All tools should have stock_actual = 1, as they are single items.
  await db.run("UPDATE herramientas SET stock_actual = 1 WHERE stock_actual <= 0");

  // 2. Any tool currently in an active loan should be marked as 'en_uso'
  const prestamosActivos = await db.all("SELECT item_id FROM prestamos WHERE estado = 'prestado' AND tipo_item = 'herramienta' AND item_id != -1");
  for (const p of prestamosActivos) {
    await db.run("UPDATE herramientas SET estado = 'en_uso' WHERE id = ?", [p.item_id]);
  }

  // 3. Any tool NOT in an active loan, but marked as 'en_uso', should be restored to 'disponible'
  // (Just in case)
  await db.run(`
    UPDATE herramientas 
    SET estado = 'disponible' 
    WHERE estado = 'en_uso' 
    AND id NOT IN (SELECT item_id FROM prestamos WHERE estado = 'prestado' AND tipo_item = 'herramienta' AND item_id != -1)
  `);

  // 4. Delete the "low stock" alerts for herramientas that were created incorrectly!
  // Wait, I created alerts for all tools with stock = 0 earlier today! I must delete those!
  await db.run("DELETE FROM alertas WHERE tipo_item = 'herramienta' AND leida = 0 AND mensaje LIKE 'Stock bajo:%'");

  console.log('Base de datos migrada a la nueva logica de estados.');
}
run();
