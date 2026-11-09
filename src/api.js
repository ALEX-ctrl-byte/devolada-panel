const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
let token = sessionStorage.getItem('devolada_admin_token');
export const hayToken = () => !!token;
export function setToken(t) {
  token = t;
  if (t) sessionStorage.setItem('devolada_admin_token', t); else sessionStorage.removeItem('devolada_admin_token');
}
async function pedir(metodo, ruta, cuerpo, blob) {
  let r;
  try {
    r = await fetch(BASE + ruta, {
      method: metodo,
      headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
  } catch { throw new Error('No se pudo conectar con la API. Revisa que esté encendida.'); }
  if (blob) { if (!r.ok) throw new Error('No se pudo abrir el archivo.'); return r.blob(); }
  const j = await r.json().catch(() => null);
  if (r.status === 401) { setToken(null); location.reload(); }
  if (!j?.ok) {
    const e = j?.error;
    const det = e?.detalles ? ' ' + Object.values(e.detalles).join(' ') : '';
    throw new Error((e?.mensaje ?? 'Error inesperado.') + det);
  }
  return j.datos;
}
export const api = {
  get: (r) => pedir('GET', r),
  post: (r, c = {}) => pedir('POST', r, c),
  blob: (r) => pedir('GET', r, null, true),
};
