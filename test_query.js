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
  const row = await db.get("SELECT * FROM alumnos WHERE apellido='JOSÉ' OR nombre='Logan' LIMIT 1");
  console.log('Alumno:', row);
  if (row) {
    const horarios = await db.all("SELECT * FROM docente_horarios WHERE curso = ? AND grupo = ?", [row.curso, row.grupo]);
    console.log('Horarios docente:', horarios);
  }
}
run();
