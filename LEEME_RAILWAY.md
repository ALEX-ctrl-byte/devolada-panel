# Panel De Volada en Railway

El panel es un sitio React + Vite. Railway lo construye (`npm run build`) y lo sirve con `server.mjs` (sin dependencias).

## Variables del servicio del panel
```
VITE_API_URL=https://api.usadevolada.com
```
`VITE_API_URL` se incorpora al construir: si la cambias, hay que redesplegar.

## Pasos
1. Sube este proyecto a un repositorio de GitHub (puede ser otro repositorio distinto al de la API).
2. En el MISMO proyecto de Railway: **+ New → GitHub Repo** → elige el repositorio del panel.
3. Variables → agrega `VITE_API_URL`.
4. Settings → Networking → **Custom Domain** → `panel.usadevolada.com` (puerto 8080).
5. En Cloudflare crea el CNAME y el TXT que Railway indique (primero DNS only; luego proxy naranja con SSL/TLS en **Full**).
6. En el servicio de la **API**, las variables `ADMIN_WEB_ORIGIN`, `CORS_ORIGIN` y `FRONTEND_URL` deben ser exactamente `https://panel.usadevolada.com`.

Desarrollo local sin cambios: `npm install` y `npm run dev` (o `INICIAR_PANEL_DEVOLADA.bat`).
