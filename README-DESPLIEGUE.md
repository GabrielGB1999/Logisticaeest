# Logística EESTN4 — Guía de despliegue

Sistema de gestión de pañol de la Escuela Técnica N°4. Se despliega con Docker.

---

## 1. Requisitos

- **Docker** y **Docker Compose** en el servidor
  ([instrucciones oficiales](https://docs.docker.com/engine/install/))
- Un puerto libre (por defecto el **5000**)

Para verificar que están instalados:

```bash
docker --version
docker compose version
```

---

## 2. Primer arranque

```bash
# 1. Traer el proyecto
git clone https://github.com/GabrielGB1999/Logisticaeest.git
cd Logisticaeest

# 2. Crear el archivo de configuración
cp .env.example .env

# 3. Generar una clave de sesión y ponerla en el .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
#    (o, sin Node instalado:)
openssl rand -hex 48
```

Editar `.env` y completar como mínimo:

```env
JWT_SECRET=<la cadena larga que generaste>
ADMIN_USER=admin
ADMIN_PASSWORD=<una contraseña propia>
```

Levantar la aplicación:

```bash
docker compose up -d --build
```

Verificar que quedó andando:

```bash
docker compose ps          # STATUS debe decir "healthy"
docker compose logs -f     # Ctrl+C para salir
```

Entrar desde cualquier PC de la red: `http://<ip-del-servidor>:5000`

> **La contraseña de administrador sólo se toma del `.env` cuando la base de
> datos está vacía**, es decir en este primer arranque. A partir de ahí la
> cuenta se administra desde **Administración → Usuarios** y lo que se cambie
> ahí se conserva aunque el contenedor se reinicie.

---

## 3. Dónde quedan los datos

Todo lo que hay que respaldar vive en la carpeta **`data/`** al lado del
`docker-compose.yml`, montada dentro del contenedor como `/data`:

```
data/
├── logistica.sqlite            ← base de datos
├── logistica.sqlite-wal        ← journal (parte de la base, ver punto 6)
├── logistica.sqlite-shm        ← journal (parte de la base, ver punto 6)
├── alumnos.xlsx                ← planilla a importar (la ponés vos)
└── REPORTES_GUARDADOS/
    └── 2026/Septiembre/2026-09-03-Manana.xlsx
```

La carpeta se crea sola en el primer arranque.

### Mover algo a otro lado

En el `.env` se puede cambiar la ubicación de cada cosa por separado — por
ejemplo la base en un disco dedicado y las planillas en una carpeta de red:

| Variable      | Qué controla                              | Por defecto                   |
|---------------|-------------------------------------------|-------------------------------|
| `DATA_DIR`    | Carpeta base de la que cuelgan las demás   | `/data`                       |
| `DB_FILE`     | Archivo de la base (ruta completa)         | `$DATA_DIR/logistica.sqlite`  |
| `EXCEL_DIR`   | Carpeta de las planillas a importar        | `$DATA_DIR`                   |
| `REPORTS_DIR` | Carpeta de los reportes generados          | `$DATA_DIR/REPORTES_GUARDADOS`|

> Son rutas **dentro del contenedor**. Para apuntar a una carpeta del servidor
> hay que montarla primero en `docker-compose.yml`, en la sección `volumes`
> (hay un ejemplo comentado ahí mismo).

---

## 4. Formato de la planilla de alumnos

La importación se dispara desde **Alumnos → Importar Excel**. Lee el archivo
**`alumnos.xlsx`** de la carpeta de planillas (`data/` por defecto). El nombre
tiene que ser exactamente ese.

### Estructura

- Se **ignoran las 2 primeras filas** (título y encabezados). Los datos
  arrancan en la **fila 3**.
- Se leen **todas las hojas** del archivo, así que se pueden separar los turnos
  o los cursos en hojas distintas.
- Las columnas se identifican por **posición**, no por el nombre del encabezado:

| Columna | Contenido            | Obligatorio | Ejemplo              |
|---------|----------------------|-------------|----------------------|
| **A**   | DNI                  | Sí          | `45111222`           |
| **B**   | `Apellido, Nombre`   | Sí          | `Perez, Juan Carlos` |
| **C**   | Curso                | No          | `3°`                 |
| **D**   | Grupo                | No          | `A`                  |

- De la **columna E en adelante se ignora todo**. En particular **el turno no
  se importa**: los alumnos nuevos quedan en "Mañana" y hay que ajustarlo desde
  la aplicación.

### Ejemplo

|   | A          | B                      | C     | D      |
|---|------------|------------------------|-------|--------|
| 1 | ESCUELA TÉCNICA N°4 — LISTADO |     |       |        |
| 2 | DNI        | APELLIDO, NOMBRE       | CURSO | GRUPO  |
| 3 | 45111222   | Perez, Juan Carlos     | 3°    | A      |
| 4 | 45333444   | Gomez, Ana             | 4°    | B      |

### La coma de la columna B es obligatoria

El apellido y el nombre se separan por la **primera coma**:

| En la planilla              | Apellido      | Nombre        |
|-----------------------------|---------------|---------------|
| `Perez, Juan Carlos`        | `Perez`       | `Juan Carlos` |
| `De la Torre, Maria, Luz`   | `De la Torre` | `Maria, Luz`  |
| `Gomez Ana`  ← **sin coma** | `Gomez Ana`   | *(vacío)*     |

Si falta la coma, el alumno se importa igual pero **con el nombre vacío**. No
da error, así que conviene revisarlo antes de importar.

### Qué pasa al reimportar

La importación identifica a cada alumno **por su DNI**:

- **DNI nuevo** → se crea el alumno.
- **DNI que ya existe** → se actualizan apellido, nombre, curso y grupo. Se
  conservan su turno y todo su historial de préstamos.
- **Fila sin DNI, o sin nombre** → se saltea, sin cortar la importación.
- Los espacios de más se recortan solos.

Se puede reimportar la planilla todas las veces que haga falta: no se duplican
alumnos ni se pierde el historial.

---

## 5. Operación diaria

```bash
docker compose ps            # estado
docker compose logs -f       # ver los logs en vivo
docker compose restart       # reiniciar
docker compose down          # detener
docker compose up -d         # volver a levantar
```

---

## 6. Respaldo

**Importante:** SQLite guarda las operaciones recientes en los archivos
`-wal` y `-shm`. Copiar solamente `logistica.sqlite` **no es un respaldo
completo**: puede estar casi vacío mientras los datos del día están en el
`-wal`.

Hay dos formas correctas:

**A. Con la aplicación detenida** (la más simple):

```bash
docker compose down
cp -r data respaldo-$(date +%F)
docker compose up -d
```

**B. Sin detenerla**, dejando primero todo en el archivo principal:

```bash
docker compose exec logistica node -e "const s=require('sqlite3');const d=new s.Database(process.env.DB_FILE||'/data/logistica.sqlite');d.run('PRAGMA wal_checkpoint(TRUNCATE)',e=>{if(e)throw e;d.close(()=>console.log('listo'))})"
cp -r data respaldo-$(date +%F)
```

Para restaurar: detener la aplicación, reemplazar la carpeta `data/` por la del
respaldo y volver a levantar.

---

## 7. Actualizar a una versión nueva

```bash
docker compose down
git pull
docker compose up -d --build
```

La base de datos **no se toca**: está en `data/`, fuera de la imagen. Las
migraciones necesarias se aplican solas al arrancar. Conviene hacer un respaldo
(punto 6) antes de actualizar.

---

## 8. Problemas frecuentes

**`docker compose ps` muestra el contenedor caído o reiniciándose**

```bash
docker compose logs --tail 30
```

**"No se puede escribir en la carpeta de datos"**

La carpeta `data/` pertenece a otro usuario. Dentro del contenedor la
aplicación corre sin privilegios (uid 1000):

```bash
sudo chown -R 1000:1000 ./data
docker compose restart
```

**"Falta JWT_SECRET"** — el `.env` no existe o está vacío. Ver el punto 2.

**Perdí la contraseña de administrador**

En el `.env`, poner la contraseña nueva y activar el flag de recuperación:

```env
ADMIN_PASSWORD=<la nueva>
ADMIN_PASSWORD_RESET=true
```

```bash
docker compose up -d
```

Entrar con esa contraseña y **volver a dejar `ADMIN_PASSWORD_RESET=false`**,
seguido de `docker compose up -d`. Si queda en `true`, la contraseña se
restablece en cada arranque y no se puede cambiar desde la aplicación.

**No se llega desde otras PC** — abrir el puerto en el firewall del servidor:

```bash
sudo ufw allow 5000/tcp
```

**Cambiar el puerto** — editar `HOST_PORT` en el `.env` y `docker compose up -d`.

---

## 9. Desarrollo local (sin Docker)

```bash
npm install
cp .env.example .env     # completar JWT_SECRET
npm run dev:server       # API en el puerto 5000
npm run dev:client       # interfaz en el puerto 5173
```

Sin `DATA_DIR` definido, la base y las planillas quedan en la raíz del
proyecto.
