// Servidor estático mínimo para el panel (sin dependencias). Sirve la carpeta dist/ generada por `vite build`.
// Railway define PORT; las rutas desconocidas devuelven index.html (aplicación de una sola página).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const puerto = Number(process.env.PORT ?? 3000);
const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.map': 'application/json',
};
const SEGURIDAD = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

if (!fs.existsSync(path.join(raiz, 'index.html'))) {
  console.error('No existe dist/index.html: ejecuta `npm run build` antes de `npm start`.');
  process.exit(1);
}

function resolver(urlPath) {
  let ruta;
  try { ruta = decodeURIComponent(urlPath.split('?')[0]); } catch { return null; }
  const absoluta = path.normalize(path.join(raiz, ruta));
  if (absoluta !== raiz && !absoluta.startsWith(raiz + path.sep)) return null; // evita salir de dist/
  try {
    const st = fs.statSync(absoluta);
    if (st.isFile()) return absoluta;
    if (st.isDirectory() && fs.existsSync(path.join(absoluta, 'index.html'))) return path.join(absoluta, 'index.html');
  } catch { /* no existe */ }
  return path.extname(ruta) ? undefined : path.join(raiz, 'index.html'); // SPA: rutas sin extensión -> index.html
}

const servidor = http.createServer((req, res) => {
  if (req.url === '/salud') {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ok');
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const archivo = resolver(req.url ?? '/');
  if (archivo === null || archivo === undefined) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SEGURIDAD });
    return res.end('No encontrado');
  }
  const ext = path.extname(archivo).toLowerCase();
  const esIndex = archivo.endsWith('index.html');
  res.writeHead(200, {
    'Content-Type': TIPOS[ext] ?? 'application/octet-stream',
    // Los archivos de assets/ llevan hash en el nombre: se pueden cachear; index.html nunca.
    'Cache-Control': esIndex ? 'no-cache' : (archivo.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'public, max-age=3600'),
    ...SEGURIDAD,
  });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(archivo).pipe(res);
});

servidor.listen(puerto, () => console.log(`Panel De Volada sirviendo dist/ en el puerto ${puerto}`));
process.on('SIGTERM', () => { servidor.close(); setTimeout(() => process.exit(0), 3000).unref(); });
