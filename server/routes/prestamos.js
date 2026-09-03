import { Router } from 'express'
import { getDB } from '../database.js'
import { requirePermiso } from '../middleware/auth.js'
import { checkStockAlertas } from '../alertas.js'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const router = Router()
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

router.get('/', async (req, res) => {
  const db = await getDB()
  const { persona_tipo, persona_id, estado } = req.query
  let sql = `
    SELECT p.*,
      COALESCE(p.nombre_manual, CASE p.tipo_item
        WHEN 'herramienta' THEN (SELECT nombre FROM herramientas WHERE id = p.item_id)
        WHEN 'insumo' THEN (SELECT nombre FROM insumos WHERE id = p.item_id)
      END) as item_nombre,
      CASE p.tipo_item
        WHEN 'insumo' THEN (SELECT unidad FROM insumos WHERE id = p.item_id)
      END as item_unidad,
      CASE 
        WHEN p.persona_tipo = 'alumno' THEN (SELECT apellido || ', ' || nombre FROM alumnos WHERE id = p.persona_id)
        WHEN p.persona_tipo = 'docente' THEN (SELECT apellido || ', ' || nombre FROM docentes WHERE id = p.persona_id)
      END as persona_nombre,
      COALESCE(doc_asignado.apellido || ', ' || doc_asignado.nombre, u.nombre) as responsable_nombre
    FROM prestamos p
    JOIN usuarios u ON p.responsable_id = u.id
    LEFT JOIN alumnos a ON p.persona_tipo = 'alumno' AND p.persona_id = a.id
    LEFT JOIN docente_horarios dh ON 
      p.persona_tipo = 'alumno' AND 
      dh.curso = a.curso AND 
      dh.grupo = a.grupo AND 
      dh.turno = CASE 
        WHEN cast(strftime('%H', datetime(p.fecha_inicio, 'localtime')) as integer) < 13 THEN 'Mañana'
        WHEN cast(strftime('%H', datetime(p.fecha_inicio, 'localtime')) as integer) < 19 THEN 'Tarde'
        ELSE 'Vespertino'
      END AND
      dh.dia = CASE cast(strftime('%w', datetime(p.fecha_inicio, 'localtime')) as integer)
                  WHEN 0 THEN 'Domingo'
                  WHEN 1 THEN 'Lunes'
                  WHEN 2 THEN 'Martes'
                  WHEN 3 THEN 'Miércoles'
                  WHEN 4 THEN 'Jueves'
                  WHEN 5 THEN 'Viernes'
                  WHEN 6 THEN 'Sábado'
                END
    LEFT JOIN docentes doc_asignado ON dh.docente_id = doc_asignado.id
    WHERE 1=1
  `
  const params = []
  if (persona_tipo) { sql += ' AND p.persona_tipo = ?'; params.push(persona_tipo) }
  if (persona_id) { sql += ' AND p.persona_id = ?'; params.push(persona_id) }
  if (estado) { sql += ' AND p.estado = ?'; params.push(estado) }
  sql += ' ORDER BY p.fecha_inicio DESC LIMIT 200'
  res.json(await db.all(sql, params))
})

router.post('/', requirePermiso('prestamos_editar'), async (req, res) => {
  const db = await getDB()
  const { persona_tipo, persona_id, tipo_item, item_id, nombre_manual, cantidad = 1, observaciones } = req.body
  if (!persona_tipo || !persona_id || !tipo_item || item_id === undefined)
    return res.status(400).json({ error: 'Datos incompletos' })

  if (item_id !== -1) {
    const table = tipo_item === 'herramienta' ? 'herramientas' : 'insumos'
    const item = await db.get(`SELECT * FROM ${table} WHERE id = ?`, [item_id])
    if (!item) return res.status(404).json({ error: 'Item no encontrado' })

    if (tipo_item === 'insumo') {
      const nuevoStock = item.stock_actual - Number(cantidad)
      if (nuevoStock < 0) return res.status(400).json({ error: 'Stock insuficiente' })
    } else {
      if (item.estado === 'en_reparacion' || item.estado === 'baja') {
        return res.status(400).json({ error: `La herramienta no está disponible (${item.estado})` })
      }
      const inUseRow = await db.get("SELECT COALESCE(SUM(cantidad), 0) as used FROM prestamos WHERE item_id = ? AND tipo_item = 'herramienta' AND estado = 'prestado'", [item_id]);
      const available = item.stock_actual - inUseRow.used;
      if (available < Number(cantidad)) {
        return res.status(400).json({ error: `La herramienta no está disponible (en uso)` })
      }
    }
  }

  await db.run('BEGIN')
  try {
    if (item_id !== -1) {
      if (tipo_item === 'insumo') {
        await db.run(`UPDATE insumos SET stock_actual = stock_actual - ? WHERE id = ?`, [Number(cantidad), item_id])
      } else {
        const item = await db.get(`SELECT stock_actual FROM herramientas WHERE id = ?`, [item_id])
        const inUseRow = await db.get("SELECT COALESCE(SUM(cantidad), 0) as used FROM prestamos WHERE item_id = ? AND tipo_item = 'herramienta' AND estado = 'prestado'", [item_id]);
        const willBeAvailable = item.stock_actual - (inUseRow.used + Number(cantidad));
        if (willBeAvailable <= 0) {
          await db.run(`UPDATE herramientas SET estado = 'en_uso' WHERE id = ?`, [item_id])
        }
      }
    }
    const result = await db.run(
      'INSERT INTO prestamos (persona_tipo, persona_id, tipo_item, item_id, nombre_manual, cantidad, responsable_id, observaciones) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [persona_tipo, persona_id, tipo_item, item_id, nombre_manual || null, cantidad, req.user.id, observaciones || null]
    )
    await db.run('COMMIT')
    if (item_id !== -1) await checkStockAlertas(tipo_item, item_id)
    res.status(201).json({ id: result.lastID })
  } catch (err) {
    await db.run('ROLLBACK')
    throw err
  }
})

router.post('/:id/devolver', requirePermiso('prestamos_editar'), async (req, res) => {
  const db = await getDB()
  const { consumido = false } = req.body
  const prestamo = await db.get('SELECT * FROM prestamos WHERE id = ?', [req.params.id])
  if (!prestamo) return res.status(404).json({ error: 'No encontrado' })
  if (prestamo.estado === 'devuelto') return res.status(400).json({ error: 'Ya fue devuelto' })

  await db.run('BEGIN')
  try {
    await db.run(
      "UPDATE prestamos SET estado='devuelto', fecha_fin=datetime('now') WHERE id=?",
      [req.params.id]
    )
    // Solo sumar stock si NO fue consumido (para insumos) o restaurar estado (para herramientas)
    if (!consumido && prestamo.item_id !== -1) {
      if (prestamo.tipo_item === 'insumo') {
        await db.run(`UPDATE insumos SET stock_actual = stock_actual + ? WHERE id = ?`, [prestamo.cantidad, prestamo.item_id])
      } else {
        await db.run(`UPDATE herramientas SET estado = 'disponible' WHERE id = ?`, [prestamo.item_id])
      }
    } else if (consumido && prestamo.item_id !== -1 && prestamo.tipo_item === 'herramienta') {
        await db.run(`UPDATE herramientas SET estado = 'disponible' WHERE id = ?`, [prestamo.item_id])
    }
    await db.run('COMMIT')
    res.json({ ok: true })
  } catch (err) {
    await db.run('ROLLBACK')
    throw err
  }
})

router.delete('/:id', requirePermiso('prestamos_editar'), async (req, res) => {
  const db = await getDB()
  await db.run('DELETE FROM prestamos WHERE id = ?', [req.params.id])
  res.json({ ok: true })
})

router.get('/export-returned', requirePermiso('prestamos_editar'), async (req, res) => {
    try {
        const rootDir = path.resolve(__dirname, '../../');
        const templatePath = path.resolve(rootDir, 'planilla despachos.xltx');
        
        if (!fs.existsSync(templatePath)) {
            return res.status(404).json({ error: "Plantilla no encontrada" });
        }

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(templatePath);
        const worksheet = workbook.worksheets[0];
        
        const db = await getDB();
        const sql = `
            SELECT 
                prestamos.fecha_inicio,
                prestamos.fecha_fin,
                prestamos.cantidad,
                prestamos.persona_tipo,
                CASE 
                  WHEN prestamos.persona_tipo = 'alumno' THEN alumnos.apellido || ', ' || alumnos.nombre
                  ELSE docentes.apellido || ', ' || docentes.nombre
                END as persona,
                alumnos.curso,
                alumnos.grupo,
                COALESCE(prestamos.nombre_manual, CASE 
                  WHEN prestamos.tipo_item = 'herramienta' THEN herramientas.nombre
                  ELSE insumos.nombre
                END) as item,
                prestamos.tipo_item as tipo,
                doc_asignado.apellido || ', ' || doc_asignado.nombre as docente_asignado
            FROM prestamos
            LEFT JOIN alumnos ON prestamos.persona_tipo = 'alumno' AND prestamos.persona_id = alumnos.id
            LEFT JOIN docentes ON prestamos.persona_tipo = 'docente' AND prestamos.persona_id = docentes.id
            LEFT JOIN herramientas ON prestamos.tipo_item = 'herramienta' AND prestamos.item_id = herramientas.id
            LEFT JOIN insumos ON prestamos.tipo_item = 'insumo' AND prestamos.item_id = insumos.id
            LEFT JOIN docente_horarios dh ON 
              prestamos.persona_tipo = 'alumno' AND 
              dh.curso = alumnos.curso AND 
              dh.grupo = alumnos.grupo AND 
              dh.turno = CASE 
                WHEN cast(strftime('%H', datetime(prestamos.fecha_inicio, 'localtime')) as integer) < 13 THEN 'Mañana'
                WHEN cast(strftime('%H', datetime(prestamos.fecha_inicio, 'localtime')) as integer) < 19 THEN 'Tarde'
                ELSE 'Vespertino'
              END AND
              dh.dia = CASE cast(strftime('%w', datetime(prestamos.fecha_inicio, 'localtime')) as integer)
                          WHEN 0 THEN 'Domingo'
                          WHEN 1 THEN 'Lunes'
                          WHEN 2 THEN 'Martes'
                          WHEN 3 THEN 'Miércoles'
                          WHEN 4 THEN 'Jueves'
                          WHEN 5 THEN 'Viernes'
                          WHEN 6 THEN 'Sábado'
                        END
            LEFT JOIN docentes doc_asignado ON dh.docente_id = doc_asignado.id
            WHERE prestamos.estado = 'devuelto'
            ORDER BY prestamos.fecha_fin DESC
        `;

        const rows = await db.all(sql);
            
        const userName = req.user?.nombre || 'SISTEMA';
        const hour = new Date().getHours();
        let turnName = 'Tarde';
        
        if (hour >= 7 && hour <= 13) {
            worksheet.getCell('H3').value = userName;
            turnName = 'Manana';
        } else if (hour > 13 && hour <= 19) {
            worksheet.getCell('H5').value = userName;
            turnName = 'Tarde';
        }

        let currentRow = 9;
        rows.forEach(row => {
            let profesor = '';
            let alumno = '';
            if (row.persona_tipo === 'docente') {
                profesor = row.persona || '';
            } else {
                alumno = row.persona || '';
                if (row.docente_asignado) {
                    profesor = row.docente_asignado;
                }
            }

            const sheetRow = worksheet.getRow(currentRow);
            sheetRow.getCell(3).value = profesor;
            sheetRow.getCell(4).value = alumno;
            sheetRow.getCell(5).value = String(`${row.curso || ''} ${row.grupo || ''}`).trim();
            sheetRow.getCell(6).value = String(row.item || '');
            sheetRow.getCell(9).value = String(new Date(row.fecha_inicio).toLocaleString());
            sheetRow.getCell(10).value = Number(row.cantidad);
            sheetRow.getCell(11).value = String(row.tipo === 'insumo' ? 'I' : 'H');
            sheetRow.getCell(12).value = String(row.fecha_fin ? new Date(row.fecha_fin).toLocaleString() : '');
            sheetRow.commit();
            currentRow++;
        });

        const now = new Date();
        const year = now.getFullYear().toString();
        const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
        const monthName = meses[now.getMonth()];
        const dateStr = now.toISOString().split('T')[0];
        const fileName = `${dateStr}-${turnName}.xlsx`;

        const reportsDir = path.resolve(rootDir, 'REPORTES_GUARDADOS', year, monthName);
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }
        const localPath = path.join(reportsDir, fileName);
        await workbook.xlsx.writeFile(localPath);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);
        await workbook.xlsx.write(res);
        
        await db.run("DELETE FROM prestamos WHERE estado = 'devuelto'");
        res.end();
    } catch (err) {
        console.error("Export Failed:", err);
        res.status(500).json({ error: "Error al generar el reporte: " + err.message });
    }
});

export default router
