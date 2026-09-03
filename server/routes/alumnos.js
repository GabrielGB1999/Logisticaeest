import { Router } from 'express'
import XLSX from 'xlsx'
import { existsSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

router.post('/import', requirePermiso('alumnos_editar'), async (req, res) => {
    // __dirname is /server/routes, so we go two levels up to the root
    let filePath = resolve(__dirname, '../../alumnos.xlsx');
    
    // Fallback if someone placed it in /server
    if (!existsSync(filePath)) {
        filePath = resolve(__dirname, '../alumnos.xlsx');
    }

    if (!existsSync(filePath)) {
        return res.status(404).json({ error: `Archivo alumnos.xlsx no encontrado en ${filePath}` });
    }

    let db;
    try {
        db = await getDB();
        const workbook = XLSX.readFile(filePath);
        let totalProcessed = 0;

        await db.run("BEGIN TRANSACTION");
        const stmt = await db.prepare("INSERT OR REPLACE INTO alumnos (dni, apellido, nombre, curso, grupo) VALUES (?, ?, ?, ?, ?)");
        
        for (const sheetName of workbook.SheetNames) {
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet, { header: 'A', range: 2 });

            for (const row of data) {
                const dni = String(row.A || '').trim();
                const full_name = String(row.B || '').trim();
                const curso = String(row.C || '').trim();
                const grupo = String(row.D || '').trim();

                if (dni && full_name) {
                    const parts = full_name.split(',');
                    const apellido = (parts[0] || '').trim();
                    const nombre = (parts[1] || '').trim();
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
  await db.run('DELETE FROM alumnos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

export default router
