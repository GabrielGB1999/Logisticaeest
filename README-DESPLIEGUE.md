# Logística EESTN4 — Guía de despliegue en red local

## Requisitos

- **Node.js 18 o superior** — [nodejs.org](https://nodejs.org)
- La carpeta completa del proyecto (incluyendo `dist/`, `server/`, `node_modules/`)
- Puerto **5000** libre en el equipo servidor

---

## Opción A — Inicio rápido (Windows)

1. Copiar la carpeta del proyecto al equipo servidor
2. Doble clic en **`iniciar-servidor.bat`**
3. La consola mostrará la URL de red, por ejemplo:
   ```
   Red:     http://192.168.1.50:5000
   ```
4. Desde cualquier PC en la misma red, abrir esa URL en el navegador

---

## Opción B — Inicio manual

```bat
cd "Logistica EESTN4"
npm install          ← solo la primera vez
node server/index.js
```

---

## Opción C — Servicio persistente con PM2 (recomendado para uso continuo)

PM2 mantiene el servidor corriendo aunque se cierre la consola o reinicie Windows.

```bat
npm install -g pm2
pm2 start server/index.js --name logistica-eestn4
pm2 save
pm2 startup
```

Comandos útiles:
```bat
pm2 status              ← ver estado
pm2 logs logistica-eestn4  ← ver logs en vivo
pm2 restart logistica-eestn4
pm2 stop logistica-eestn4
```

---

## Configuración (.env)

El archivo `.env` en la raíz del proyecto controla las variables de entorno:

```env
JWT_SECRET=cambiar_por_clave_larga_y_segura
PORT=5000
```

**Importante:** cambiar `JWT_SECRET` por una cadena aleatoria larga antes de usar en producción.

Para cambiar el puerto editar `PORT=` y reiniciar el servidor.

---

## Abrir el firewall de Windows (si otras PCs no pueden conectarse)

Ejecutar en PowerShell como Administrador:

```powershell
New-NetFirewallRule -DisplayName "Logistica EESTN4" -Direction Inbound -Protocol TCP -LocalPort 5000 -Action Allow
```

O desde la interfaz gráfica:
**Panel de control → Firewall de Windows → Reglas de entrada → Nueva regla → Puerto → TCP 5000**

---

## Estructura de archivos necesarios para producción

```
Logistica EESTN4/
├── dist/               ← frontend compilado (generado con npm run build)
├── server/             ← backend Node.js
├── node_modules/       ← dependencias
├── .env                ← variables de entorno (NO compartir)
├── logistica.sqlite    ← base de datos (se crea automáticamente)
├── iniciar-servidor.bat
└── package.json
```

Si usás el hero banner, asegurate de que `public/avion.jpg` exista **antes** de correr `npm run build` — Vite la copia automáticamente a `dist/`. Si ya hiciste el build sin la imagen, simplemente copiá `avion.jpg` directo a la carpeta `dist/`.

---

## Regenerar el build (si se modifica el código)

```bat
npm run build
```

Esto actualiza la carpeta `dist/` con los últimos cambios del frontend.
El backend no necesita build — se ejecuta directamente con Node.

---

## Primer inicio de sesión

En una base de datos nueva el sistema crea automáticamente un único usuario
**Administrador** llamado `admin`. La contraseña se toma de `ADMIN_PASSWORD`
en el archivo `.env`, y se imprime en la consola al arrancar:

```
Usuario admin creado: admin / <contraseña>
```

**Recomendado:** definir `ADMIN_PASSWORD` en `.env` *antes* del primer arranque.

> ⚠️ Si no se define, se usa una contraseña por defecto que está escrita en el
> código fuente y por lo tanto es **pública**: cualquiera que vea el repositorio
> la conoce. Un servidor que siga usándola está abierto a cualquier persona que
> alcance el puerto 5000.

Cambiar la contraseña en cualquier momento desde **Administración → Usuarios**.
Si el equipo ya está en producción y nunca se cambió, cambiala ahora.
