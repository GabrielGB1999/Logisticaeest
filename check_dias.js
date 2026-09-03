import { getDB } from './server/database.js'

async function check() {
  const db = await getDB()
  const rows = await db.all("SELECT DISTINCT dia FROM docente_horarios")
  console.log('Dias:', rows.map(r => r.dia))
}

check()
