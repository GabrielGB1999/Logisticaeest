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

Revisar también la zona horaria, que ya viene puesta para Argentina:

```env
TZ=America/Argentina/Buenos_Aires
```

> La aplicación usa la **hora local** para decidir el turno de cada préstamo
> (Mañana / Tarde / Vespertino) y el día de la semana con el que busca al
> docente a cargo. Los contenedores arrancan en UTC, y si esto queda mal un
> préstamo de las 11:00 se registra como "Tarde" y uno de las 21:00 se atribuye
> al día siguiente, con lo cual no se le asigna el docente correcto.
>
> Al arrancar, el servidor imprime la hora y la zona que está usando. Conviene
> mirarlo la primera vez:
>
> ```
> docker compose logs | grep Hora
>    Hora:    3/9/2026, 10:46:34  (zona: America/Buenos_Aires)
> ```

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

## 4. Formato de las planillas

### 4.1 Alumnos (`alumnos.xlsx`)

La importación se dispara desde **Alumnos → Importar Excel**. Lee el archivo
**`alumnos.xlsx`** de la carpeta de planillas (`data/` por defecto).

Igual que las otras dos planillas, las columnas se reconocen **por el nombre
del encabezado**: pueden estar en cualquier orden, pueden sobrar columnas y no
importan mayúsculas ni acentos. Si arriba de los encabezados hay un título o
filas en blanco, se saltean solas. Se leen **todas las hojas** del archivo, así
que se pueden separar turnos o cursos en hojas distintas.

| Columna | ¿Obligatoria? | También se acepta escribir | Ejemplo |
|---|---|---|---|
| `dni` | **Sí** | documento, doc, matricula | `45111222` |
| `apellido` | **Sí** (o la columna combinada) | apellidos | `Perez` |
| `nombre` | No | nombres | `Juan Carlos` |
| `curso` | No | año, grado | `3°` |
| `grupo` | No | division, comision, seccion | `A` |
| `turno` | No | jornada | `Mañana` |

#### Ejemplo

| DNI | Apellido | Nombre | Curso | División | Turno |
|---|---|---|---|---|---|
| 45111222 | Perez | Juan Carlos | 3° | A | Mañana |
| 45333444 | Gomez | Ana | 4° | B | Tarde |

#### Apellido y nombre en una sola columna

Si la planilla los trae juntos, alcanza con una columna llamada **`Apellido y
Nombre`** (o `Apellido, Nombre`, `Nombre completo`, `Alumno`). Se parten por la
**primera coma**:

| En la planilla | Apellido | Nombre |
|---|---|---|
| `Perez, Juan Carlos` | `Perez` | `Juan Carlos` |
| `De la Torre, Maria, Luz` | `De la Torre` | `Maria, Luz` |
| `Gomez Ana`  ← sin coma | `Gomez Ana` | *(vacío)* |

Sin la coma el alumno se importa igual, pero con el nombre vacío. No da error,
así que conviene revisarlo antes.

#### Las planillas viejas siguen funcionando

Si el archivo **no tiene encabezados reconocibles**, se lee con el formato
anterior: se saltean las 2 primeras filas y las columnas se toman por posición
(**A** = DNI, **B** = `Apellido, Nombre`, **C** = curso, **D** = grupo). El
resumen avisa cuando pasa esto.

No hace falta rehacer nada para seguir usándolo, pero poniéndole encabezados a
la planilla el orden de las columnas deja de importar y se puede además cargar
el **turno**, que con el formato viejo no se importa.

#### Qué pasa al reimportar

Cada alumno se identifica **por su DNI**:

- **DNI nuevo** → se crea el alumno.
- **DNI que ya existe** → se actualizan sólo las columnas que trae la planilla.
  La fila conserva su id, y con él todo su historial de préstamos.
- **Columna que la planilla no trae** → se deja como está. Por ejemplo, si no
  hay columna `turno`, se conserva el que esté cargado a mano.
- **Fila sin DNI o sin apellido** → se saltea, sin cortar la importación.

Se puede reimportar todas las veces que haga falta: no se duplican alumnos ni
se pierde el historial.

---

### 4.2 Herramientas (`herramientas.xlsx`) e insumos (`insumos.xlsx`)

Estas dos planillas se leen **por nombre de columna**, no por posición: las
columnas pueden estar en cualquier orden, pueden sobrar columnas (se ignoran) y
no importan mayúsculas ni acentos. La **primera fila** tiene que ser la de los
encabezados.

| Columna | ¿Obligatoria? | También se acepta escribir | Para qué sirve |
|---|---|---|---|
| `nombre` | **Sí** | herramienta, insumo, articulo, item, producto, denominacion | Nombre del item. Sin esto la fila se saltea. |
| `codigo` | Muy recomendable | cod, code, codigo de barras, nro, numero | Es la clave con la que se reconoce un item ya cargado. |
| `categoria` | No | rubro, familia, grupo | Si no existe, se crea sola. |
| `ubicacion` | No | lugar, deposito, armario, tablero, estante, sector | Dónde está guardado. |
| `descripcion` | No | detalle, observaciones, notas | Texto libre. |
| `stock actual` | No | stock, cantidad, existencia | **Sólo se usa al crear el item** (ver más abajo). |
| `stock minimo` | No | minimo, min, stock critico | Debajo de este valor se genera una alerta. |
| `estado` | No (sólo herramientas) | condicion | disponible, en uso, en reparación, baja. |
| `unidad` | No (sólo insumos) | um, medida | unidad, caja, metro, litro… |
| `proveedor` | No (sólo insumos) | vendedor, fabricante, marca | Texto libre. |

#### Ejemplo (`herramientas.xlsx`)

| Código | Nombre | Categoría | Ubicación | Stock Actual | Stock Mínimo | Estado |
|---|---|---|---|---|---|---|
| IT-0402 | Pinza de frenado | Herramientas manuales | armario 1 | 4 | 1 | Disponible |
| IT-0713 | Pinza pico pato | Herramientas manuales | tablero B3 | 2 | 1 | En reparación |

#### Ejemplo (`insumos.xlsx`)

| Código | Insumo | Rubro | Unidad | Stock | Mínimo | Proveedor |
|---|---|---|---|---|---|---|
| INS-1 | Silicona neutra | Consumibles de taller | unidad | 12 | 5 | Ferretería Sur |
| INS-2 | Guantes de látex | Consumibles de taller | caja | 8 | 2 | |

#### El stock nunca se pisa al reimportar

Al **crear** un item se toma el stock de la planilla. Al **reimportar**, si el
código ya existe se actualizan nombre, descripción, categoría, ubicación, stock
mínimo, estado, unidad y proveedor — pero **`stock actual` se deja como está**.

El stock del sistema es el que llevan los movimientos y los préstamos del día a
día, y la planilla casi siempre está más atrasada. Si se sobrescribiera, cada
importación borraría todo lo registrado desde la última vez que se exportó.

> Para corregir el stock de un item, hacelo desde la pantalla de Herramientas o
> Insumos, o cargá un movimiento de entrada/salida.

#### Las filas sin código se duplican

Una fila sin `codigo` no se puede reconocer, así que **se agrega como nueva cada
vez que importás**. El resumen al terminar avisa cuántas filas están en esa
situación. Conviene ponerle código a todo lo que vayas a reimportar.

#### Qué informa al terminar

Un resumen del estilo:

```
Importación terminada. 4 creadas, 12 actualizadas, 1 omitidas (sin nombre),
categorías nuevas: Instrumentos de medición.
```

Y avisos aparte si hubo filas sin código, estados que no se entendieron, o una
categoría cuyo nombre ya estaba usado por el otro tipo (un mismo nombre no puede
ser categoría de herramienta y de insumo a la vez).

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
