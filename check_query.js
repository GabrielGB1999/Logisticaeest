import { getDB } from './server/database.js'

async function check() {
  const db = await getDB()
  const sql = `
    SELECT 
      prestamos.fecha_inicio,
      alumnos.curso, alumnos.grupo, alumnos.turno,
      CASE cast(strftime('%w', prestamos.fecha_inicio) as integer)
        WHEN 0 THEN 'Domingo'
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miércoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sábado'
      END as dia_prestamo,
      doc_asignado.apellido || ', ' || doc_asignado.nombre as docente_asignado
    FROM prestamos
    LEFT JOIN alumnos ON prestamos.persona_tipo = 'alumno' AND prestamos.persona_id = alumnos.id
    LEFT JOIN docente_horarios dh ON 
      prestamos.persona_tipo = 'alumno' AND 
      dh.curso = alumnos.curso AND 
      dh.grupo = alumnos.grupo AND 
      dh.turno = alumnos.turno AND 
      dh.dia = CASE cast(strftime('%w', prestamos.fecha_inicio) as integer)
                  WHEN 0 THEN 'Domingo'
                  WHEN 1 THEN 'Lunes'
                  WHEN 2 THEN 'Martes'
                  WHEN 3 THEN 'Miércoles'
                  WHEN 4 THEN 'Jueves'
                  WHEN 5 THEN 'Viernes'
                  WHEN 6 THEN 'Sábado'
                END
    LEFT JOIN docentes doc_asignado ON dh.docente_id = doc_asignado.id
    LIMIT 10
  `
  const rows = await db.all(sql)
  console.log(rows)
}

check()
