import { getDB } from './server/database.js'

async function check() {
  const db = await getDB()
  const sql = `
    SELECT p.id, p.fecha_inicio,
      CASE cast(strftime('%w', datetime(p.fecha_inicio, 'localtime')) as integer)
                  WHEN 0 THEN 'Domingo'
                  WHEN 1 THEN 'Lunes'
                  WHEN 2 THEN 'Martes'
                  WHEN 3 THEN 'Miércoles'
                  WHEN 4 THEN 'Jueves'
                  WHEN 5 THEN 'Viernes'
                  WHEN 6 THEN 'Sábado'
                END as dia_calculado,
      COALESCE(doc_asignado.apellido || ', ' || doc_asignado.nombre, u.nombre) as responsable_nombre
    FROM prestamos p
    LEFT JOIN alumnos a ON p.persona_tipo = 'alumno' AND p.persona_id = a.id
    LEFT JOIN docente_horarios dh ON 
      p.persona_tipo = 'alumno' AND 
      dh.curso = a.curso AND 
      dh.grupo = a.grupo AND 
      dh.turno = a.turno AND 
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
    JOIN usuarios u ON p.responsable_id = u.id
    LIMIT 10
  `
  const rows = await db.all(sql)
  console.log(rows)
}

check()
