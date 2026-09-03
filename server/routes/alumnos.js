import { Router } from 'express'
import XLSX from 'xlsx'
import { existsSync } from 'fs'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { ALUMNOS_XLSX, DATA_DIR } from '../paths.js'

const router = Router()

router.post('/import', requirePermiso('alumnos_editar'), async (req, res) => {
    const filePath = ALUMNOS_XLSX;

    if (!existsSync(filePath)) {
        return res.status(404).json({ error: `No se encontró alumnos.xlsx en la carpeta de datos (${DATA_DIR}). Copiá la planilla ahí y volvé a intentar.` });
    }

    let db;
    try {
        db = await getDB();
        const workbook = XLSX.readFile(filePath);
        let totalProcessed = 0;

        await db.run("BEGIN TRANSACTION");
        // INSERT OR REPLACE borraba la fila y la volvía a insertar con un id nuevo,
        // dejando huérfanos los préstamos que apuntaban al alumno (prestamos.persona_id
        // no tiene clave foránea) y pisando el turno cargado a mano. El upsert por DNI
        // conserva el id y sólo toca las columnas que trae la planilla.
        const stmt = await db.prepare(`
            INSERT INTO alumnos (dni, apellido, nombre, curso, grupo) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(dni) DO UPDATE SET
                apellido = excluded.apellido,
                nombre   = excluded.nombre,
                curso    = excluded.curso,
                grupo    = excluded.grupo
        `);
        
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 'A', range: 2 });

            for (const row of data) {
                const dni = String(row.A || '').trim();
                const full_name = String(row.B || '').trim();
                const curso = String(row.C || '').trim();
                const grupo = String(row.D || '').trim();

                if (dni && full_name) {
                    // Se corta en la PRIMERA coma: todo lo que sigue es el
                    // nombre. Con split(',')[1] un "Perez, Maria, Luz" perdía
                    // "Luz" sin avisar.
                    const coma = full_name.indexOf(',');
                    const apellido = (coma === -1 ? full_name : full_name.slice(0, coma)).trim();
                    const nombre = (coma === -1 ? '' : full_name.slice(coma + 1)).trim();
                    await stmt.run(dni, apellido, nombre, curso, grupo);
                    totalProcessed++;
                }
            }
        }

        await stmt.finalize();
        await db.run("COMMIT");
        
        res.json({ message: `Importación exitosa. ${totalProcessed} alumnos procesados.` });
    } catch (err) {
        if (db) await db.run("ROLLBACK").catch(() => {});
        res.status(500).json({ error: err.message });
    }
});

router.get('/', async (req, res) => {
  const db = await getDB()
  const { buscar, page = 1, limit = 100 } = req.query
  const offset = (Number(page) - 1) * Number(limit)
  const term = `%${buscar || ''}%`
  const [rows, countRow] = await Promise.all([
    db.all(
      'SELECT * FROM alumnos WHERE apellido LIKE ? OR nombre LIKE ? OR dni LIKE ? ORDER BY apellido ASC LIMIT ? OFFSET ?',
      [term, term, term, Number(limit), offset]
    ),
    db.get(
      'SELECT COUNT(*) as total FROM alumnos WHERE apellido LIKE ? OR nombre LIKE ? OR dni LIKE ?',
      [term, term, term]
    )
  ])
  res.json({ data: rows, total: countRow.total, page: Number(page) })
})

router.get('/:id', async (req, res) => {
  const db = await getDB()
  const row = await db.get('SELECT * FROM alumnos WHERE id = ?', [req.params.id])
  if (!row) return res.status(404).json({ error: 'No encontrado' })
  res.json(row)
})

router.post('/', requirePermiso('alumnos_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, apellido, dni, curso, grupo, turno } = req.body
  if (!nombre || !apellido || !dni) return res.status(400).json({ error: 'nombre, apellido y dni son requeridos' })
  const exists = await db.get('SELECT id FROM alumnos WHERE dni = ?', [dni])
  if (exists) return res.status(400).json({ error: 'Ya existe un alumno con ese DNI' })
  const result = await db.run(
    'INSERT INTO alumnos (nombre, apellido, dni, curso, grupo, turno) VALUES (?, ?, ?, ?, ?, ?)',
    [nombre, apellido, dni, curso || null, grupo || null, turno || 'Mañana']
  )
  res.status(201).json({ id: result.lastID })
})

router.put('/:id', requirePermiso('alumnos_editar'), async (req, res) => {
  const db = await getDB()
  const { nombre, apellido, dni, curso, grupo, turno } = req.body
  if (!nombre || !apellido || !dni) return res.status(400).json({ error: 'nombre, apellido y dni son requeridos' })
  const exists = await db.get('SELECT id FROM alumnos WHERE id = ?', [req.params.id])
  if (!exists) return res.status(404).json({ error: 'No encontrado' })
  await db.run(
    'UPDATE alumnos SET nombre=?, apellido=?, dni=?, curso=?, grupo=?, turno=? WHERE id=?',
    [nombre, apellido, dni, curso || null, grupo || null, turno || 'Mañana', req.params.id]
  )
  res.json({ ok: true })
})

router.delete('/:id', requirePermiso('alumnos_editar'), async (req, res) => {
  const db = await getDB()
  const alumno = await db.get('SELECT id FROM alumnos WHERE id = ?', [req.params.id])
  if (!alumno) return res.status(404).json({ error: 'No encontrado' })
  // prestamos.persona_id no tiene clave foránea: si se borra el alumno, los
  // préstamos sin devolver quedan apuntando a una fila inexistente.
  const abiertos = await db.get(
    "SELECT COUNT(*) as n FROM prestamos WHERE persona_tipo = 'alumno' AND persona_id = ? AND estado = 'prestado'",
    [req.params.id]
  )
  if (abiertos.n > 0) {
    return res.status(400).json({ error: `No se puede eliminar: el alumno tiene ${abiertos.n} préstamo(s) sin devolver` })
  }
  await db.run('DELETE FROM alumnos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
