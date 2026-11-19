# Panel de administración De Volada

> Despliegue en producción: ver [LEEME_RAILWAY.md](LEEME_RAILWAY.md).

Panel web React + Vite con tema visual azul petróleo, dorado y amarillo de la marca De Volada.

## Instalación en Windows

1. Extrae esta carpeta `panel` en `D:\DEUNA TODO\DEUNA Programacion\DEUNA_PREPRUEBA_FINAL\panel` (haz una copia de seguridad de la anterior).
2. No se distribuye el archivo `.env` real ni `node_modules`. Conserva tu `.env` actual si ya lo tienes. Si aún no existe, copia `.env.example` como `.env`.
3. En `.env`, configura `VITE_API_URL=http://localhost:3000` para desarrollo local. La API debe estar encendida y permitir el origen `http://localhost:5173`.
4. Abre CMD/PowerShell en esta carpeta y ejecuta `npm install` y después `npm run dev`. Alternativamente, usa `INICIAR_PANEL_DEVOLADA.bat`.
5. Abre `http://localhost:5173`.

## Inicio de sesión

El panel inicia sesión con teléfono + PIN (`POST /entrar`) de un usuario con `rol='admin'`.

## Secciones disponibles

- Resumen operativo, mapa de ubicaciones recientes y usuarios.
- Usuarios pendientes: aprobación manual de cuentas nuevas (verificación inicial por WhatsApp). Aprobar o rechazar con motivo.
- Ciudades de operación.
- Viajes, pedidos, envíos persona-a-persona y revisiones de conciliación.
- Revisión de conductores, documentos y vehículos; aprobación de comercios.
- Recargas de operaciones: cada Bs 2 verificados acredita 1 operación; mínimo Bs 2 y múltiplos de Bs 2. No existen retiros ni transferencias entre usuarios.
- Soporte: lectura de tickets y respuesta/resolución con auditoría.
- Calificaciones: vista de solo lectura, filtrable por tipo y puntuación.
- Auditoría de acciones administrativas.

## Mapa operativo

Usa Leaflet con las teselas públicas de OpenStreetMap: no necesita token ni tiene costo. Es un uso de bajo volumen (solo administradores) y muestra la atribución obligatoria. Si las teselas no cargan, la tabla de posiciones y los enlaces "Ver en OpenStreetMap" siguen funcionando.

## Calificaciones

La sección nueva consume `GET /admin/calificaciones`. Si la API todavía no tiene esa ruta, aplica el parche entregado por separado en `deuna-api/src/rutas/admin.js` y reinicia Node. La ruta es de solo lectura y requiere sesión de administrador. Las tablas `calificaciones_comercio`, `calificaciones_app` y `calificaciones_envios` deben existir; aplica la migración de soporte/calificaciones/envíos antes de utilizar estas funciones.

## Build

- Desarrollo: `npm run dev`
- Validar/compilar para publicación: `npm run build`
- Vista previa del build: `npm run preview`

No publiques el `.env`, claves ni tokens. Para producción, usa HTTPS y configura `ADMIN_WEB_ORIGIN` con el origen exacto del panel.

## Despliegue en DigitalOcean App Platform (sitio estático, gratis)

El panel se compila con Vite y se publica como **sitio estático**: no necesita servidor Node en producción. El plan Starter de DO permite hasta 3 sitios estáticos sin costo.

### `VITE_API_URL`

- Vite incrusta `VITE_API_URL` **al compilar** (`npm run build`), no al ejecutar. Si la cambias, hay que volver a desplegar (DO recompila solo).
- Valor: la URL pública de la API, en HTTPS y **sin barra final**. Ejemplos: `https://api.devolada.com` o `https://api-devolada-xxxxx.ondigitalocean.app`.
- Si no se define, el panel usa `http://localhost:3000` (solo sirve en desarrollo).
- En la API, `ADMIN_WEB_ORIGIN` debe ser exactamente el origen del panel (por ejemplo, `https://panel.devolada.com`). Si no coincide, el navegador bloquea las peticiones (CORS).

### Opción A: con `doctl` y `.do/app.yaml`

1. Sube el panel a un repositorio de GitHub y añade a `.do/app.yaml` el bloque `github:` (repo, branch `main`, `deploy_on_push: true`) dentro de `static_sites`. Si el panel está en una subcarpeta, añade también `source_dir: panel`.
2. Cambia `VITE_API_URL` en `.do/app.yaml` por la URL real de la API.
3. Ejecuta `doctl apps create --spec .do/app.yaml`. Para cambios posteriores: `doctl apps update <APP_ID> --spec .do/app.yaml`.

### Opción B: desde la web de DigitalOcean

1. **Apps → Create App →** elige el repositorio de GitHub y la rama.
2. DO detecta el proyecto: cambia el tipo de recurso a **Static Site**.
3. Build command: `npm install && npm run build`; Output directory: `dist`; Catchall document: `index.html`.
4. En **Environment Variables** añade `VITE_API_URL` (scope *Build Time*) con la URL de la API.
5. Elige la región `nyc` (o la más cercana) y crea la app.

### Dominio propio con Cloudflare

1. En DO: **Settings → Domains → Add Domain** → `panel.devolada.com` → elige "You manage your domain".
2. En Cloudflare (DNS): crea un registro `CNAME panel → <tu-app>.ondigitalocean.app`. Déjalo primero en **DNS only** (nube gris) hasta que DO emita el certificado; después puedes activar el proxy (nube naranja) con SSL/TLS en modo **Full (strict)**.
3. Actualiza `ADMIN_WEB_ORIGIN=https://panel.devolada.com` en la API y vuelve a desplegarla.
