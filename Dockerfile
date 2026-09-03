##############################################################################
# Etapa 1: compilar el frontend con Vite
##############################################################################
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public

RUN npm run build

##############################################################################
# Etapa 2: imagen final, sólo con lo necesario para ejecutar
##############################################################################
FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# tzdata: sin los datos de zonas horarias, TZ se ignora y el contenedor queda
# en UTC sin avisar. La aplicación usa la hora local para decidir el turno de
# cada préstamo y el día con el que busca al docente, así que tiene que estar.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata \
 && rm -rf /var/lib/apt/lists/*
ENV TZ=America/Argentina/Buenos_Aires

# Sólo dependencias de producción (sin Vite ni el plugin de React).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server ./server
COPY --from=build /app/dist ./dist
# La plantilla de despachos es de sólo lectura y viaja con la imagen.
COPY ["planilla despachos.xltx", "./"]

# Carpeta de datos: base de datos, planilla de alumnos y reportes guardados.
# Se monta como volumen para que sobreviva a las actualizaciones.
ENV DATA_DIR=/data
RUN mkdir -p /data && chown -R node:node /data /app

USER node
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
