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
  
  const res = await db.all("SELECT id, nombre, stock_actual, estado FROM herramientas WHERE stock_actual > 1 LIMIT 10");
  console.log(res);
}
run();
