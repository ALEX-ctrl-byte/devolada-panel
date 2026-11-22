import { Fragment, Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { api, hayToken, setToken } from './api.js';

const MapaOperativo = lazy(() => import('./MapaOperativo.jsx'));

const fmt = (v) => (v === null || v === undefined ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));
// Los saldos operativos son unidades enteras, nunca dinero disponible.
const esCampoOperaciones = (k) => /^saldo_(prepago|comision)/.test(k) || /^operaciones_/.test(k);
const ops = (v) => { const n = Number(v); return Number.isFinite(n) ? `${Math.floor(n)} operaciones` : fmt(v); };
const fmtCampo = (k, v) => (v !== null && v !== undefined && esCampoOperaciones(k) ? ops(v) : fmt(v));
const fecha = (v) => { if (!v) return '—'; const d = new Date(v); return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString('es-BO', { dateStyle: 'short', timeStyle: 'short' }); };
const nombre = (k) => k.replaceAll('_', ' ');
const preguntar = (t) => { const v = window.prompt(t); return v && v.trim() ? v.trim() : null; };

function useDatos(ruta) {
  const [d, setD] = useState(null);
  const [e, setE] = useState('');
  const cargar = useCallback(() => { setE(''); api.get(ruta).then(setD).catch((x) => setE(x.message)); }, [ruta]);
  useEffect(() => { setD(null); cargar(); }, [cargar]);
  return [d, e, cargar];
}

function useAccion(recargar) {
  const [m, setM] = useState(null);
  const [ocupado, setO] = useState(false);
  const ejecutar = async (ruta, cuerpo, textoOk) => {
    setO(true); setM(null);
    try { await api.post(ruta, cuerpo); setM({ t: 'b', x: textoOk }); recargar(); }
    catch (x) { setM({ t: 'e', x: x.message }); }
    setO(false);
  };
  const aviso = m && <div className={'msg ' + m.t} role="status">{m.x}</div>;
  return { ejecutar, aviso, ocupado };
}

function Tabla({ filas, onFila, acciones }) {
  if (!filas?.length) return <div className="scroll"><p className="vacio">No hay registros en este estado.</p></div>;
  const cols = Object.keys(filas[0]).filter((c) => !c.startsWith('_'));
  return (
    <div className="scroll"><table>
      <thead><tr>{cols.map((c) => <th key={c}>{nombre(c)}</th>)}{acciones && <th>Acciones</th>}</tr></thead>
      <tbody>{filas.map((f, i) => (
        <tr key={f.id ?? i} className={onFila ? 'fila' : ''} onClick={() => onFila?.(f)}>
          {cols.map((c) => <td key={c} title={fmtCampo(c, f[c])}>{fmtCampo(c, f[c])}</td>)}
          {acciones && <td onClick={(e) => e.stopPropagation()}><div className="acc">{acciones(f)}</div></td>}
        </tr>))}
      </tbody>
    </table></div>
  );
}

const Dict = ({ o }) => (
  <dl>{Object.entries(o ?? {}).map(([k, v]) => <Fragment key={k}><dt>{nombre(k)}</dt><dd>{fmtCampo(k, v)}</dd></Fragment>)}</dl>
);

function Cola({ titulo, sub, estados, ruta, clave, acciones, Detalle, transformar, aviso: avisoFijo }) {
  const [estado, setEstado] = useState(estados?.[0]);
  const [datos, err, cargar] = useDatos(ruta(estado));
  const { ejecutar, aviso, ocupado } = useAccion(cargar);
  const [sel, setSel] = useState(null);
  return (
    <section>
      <h2>{titulo}</h2><p className="sub">{sub}</p>
      <div className="barra">
        {estados && <label>Estado <select value={estado} onChange={(e) => { setEstado(e.target.value); setSel(null); }}>{estados.map((s) => <option key={s}>{s}</option>)}</select></label>}
        <button className="btn" onClick={cargar}>Actualizar</button>
      </div>
      {avisoFijo && <div className="msg">{avisoFijo}</div>}
      {err && <div className="msg e">{err}</div>}{aviso}
      {datos && <Tabla filas={transformar ? (datos[clave] ?? []).map(transformar) : datos[clave]} onFila={Detalle && setSel} acciones={acciones && ((f) => acciones(f, ejecutar, ocupado, estado))} />}
      {sel && Detalle && <Detalle id={sel.id} cerrar={() => setSel(null)} refrescar={cargar} />}
    </section>
  );
}

function Decidir({ base, ejecutar, ocupado, okTxt, malTxt, nomOk = 'Aprobar', nomMal = 'Rechazar' }) {
  return (<>
    <button className="btn ok" disabled={ocupado} onClick={() => ejecutar(`${base}/aprobar`, {}, okTxt)}>{nomOk}</button>
    <button className="btn mal" disabled={ocupado} onClick={() => { const m = preguntar('Motivo del rechazo (mínimo 5 caracteres):'); if (m) ejecutar(`${base}/rechazar`, { motivo: m }, malTxt); }}>{nomMal}</button>
  </>);
}

function ConductorDet({ id, cerrar, refrescar }) {
  const [d, err, cargar] = useDatos(`/admin/conductores/${id}`);
  const { ejecutar, aviso, ocupado } = useAccion(() => { cargar(); refrescar(); });
  const ver = async (doc) => {
    const w = window.open('', '_blank');
    try { w.location = URL.createObjectURL(await api.blob(`/admin/documentos/${doc.id}/archivo`)); }
    catch (x) { w?.close(); alert(x.message); }
  };
  return (
    <div className="det">
      <div className="barra"><h3 style={{ margin: 0 }}>Conductor #{id}</h3><button className="btn" onClick={cerrar}>Cerrar</button></div>
      {err && <div className="msg e">{err}</div>}{aviso}
      {d && (<>
        <Dict o={d.conductor} />
        <div className="barra"><Decidir base={`/admin/conductores/${id}`} ejecutar={ejecutar} ocupado={ocupado} okTxt="Conductor aprobado." malTxt="Conductor rechazado." /></div>
        <h3>Vehículo registrado</h3>{d.moto ? <Dict o={d.moto} /> : <p className="sub">Sin moto o auto registrado.</p>}
        <h3>Documentos</h3>
        <Tabla filas={d.documentos} acciones={(doc) => (<>
          <button className="btn" onClick={() => ver(doc)}>Ver</button>
          <Decidir base={`/admin/documentos/${doc.id}`} ejecutar={ejecutar} ocupado={ocupado} okTxt="Documento aprobado." malTxt="Documento rechazado." />
        </>)} />
      </>)}
    </div>
  );
}

function ComercioDet({ id, cerrar, refrescar }) {
  const [d, err, cargar] = useDatos(`/admin/comercios/${id}`);
  const { ejecutar, aviso, ocupado } = useAccion(() => { cargar(); refrescar(); });
  return (
    <div className="det">
      <div className="barra"><h3 style={{ margin: 0 }}>Comercio #{id}</h3><button className="btn" onClick={cerrar}>Cerrar</button></div>
      {err && <div className="msg e">{err}</div>}{aviso}
      {d && (<>
        <Dict o={d.comercio} />
        <div className="barra"><Decidir base={`/admin/comercios/${id}`} ejecutar={ejecutar} ocupado={ocupado} okTxt="Comercio aprobado." malTxt="Comercio rechazado." /></div>
        <h3>Horarios</h3><Tabla filas={d.horarios} />
        <h3>Productos</h3><Tabla filas={d.productos} />
      </>)}
    </div>
  );
}

function Resumen() {
  const [d, err] = useDatos('/admin/resumen');
  const T = { usuarios_activos: 'Usuarios activos', usuarios_pendientes: 'Usuarios pendientes de aprobación', comercios_revision: 'Comercios por revisar', comercios_publicados: 'Comercios publicados', comercios_rechazados: 'Comercios rechazados', conductores_revision: 'Conductores por revisar', conductores_aprobados: 'Conductores aprobados', conductores_rechazados: 'Conductores rechazados', documentos_pendientes: 'Documentos pendientes', viajes_solicitados: 'Viajes solicitados', viajes_activos: 'Viajes en curso', viajes_finalizados: 'Viajes finalizados', envios_solicitados: 'Envíos solicitados', envios_activos: 'Envíos activos', envios_entregados: 'Envíos entregados', envios_revision: 'Envíos por revisar' };
  const urgente = ['usuarios_pendientes', 'comercios_revision', 'conductores_revision', 'documentos_pendientes', 'envios_revision'];
  return (
    <section><h2>Resumen</h2><p className="sub">Estado general de De Volada.</p>
      {err && <div className="msg e">{err}</div>}
      {d && <div className="tarjetas">{Object.entries(d).map(([k, v]) => (
        <div key={k} className={'tarjeta' + (urgente.includes(k) && v > 0 ? ' alerta' : '')}><b>{v}</b><span>{T[k] ?? nombre(k)}</span></div>))}</div>}
    </section>
  );
}

function Auditoria() {
  const [p, setP] = useState(1);
  const [accion, setAccion] = useState('');
  const [entidad, setEntidad] = useState('');
  const q = `/admin/auditoria?limite=50&pagina=${p}&accion=${encodeURIComponent(accion)}&entidad=${encodeURIComponent(entidad)}`;
  const [d, err, cargar] = useDatos(q);
  const paginas = d ? Math.max(1, Math.ceil(d.total / d.limite)) : 1;
  return (
    <section><h2>Auditoría</h2><p className="sub">Registro de solo lectura de las acciones en la plataforma.</p>
      <div className="barra">
        <input placeholder="Acción" value={accion} onChange={(e) => { setAccion(e.target.value); setP(1); }} />
        <input placeholder="Entidad" value={entidad} onChange={(e) => { setEntidad(e.target.value); setP(1); }} />
        <button className="btn" onClick={cargar}>Actualizar</button>
        <button className="btn" disabled={p <= 1} onClick={() => setP(p - 1)}>Anterior</button>
        <span>Página {p} de {paginas}{d ? ` (${d.total} eventos)` : ''}</span>
        <button className="btn" disabled={p >= paginas} onClick={() => setP(p + 1)}>Siguiente</button>
      </div>
      {err && <div className="msg e">{err}</div>}
      {d && <Tabla filas={d.eventos} />}
    </section>
  );
}

const confirmar = (t) => window.confirm(t);
const resolver = (tipo) => (f, ejecutar, ocupado) => (
  <button className="btn ok" disabled={ocupado} onClick={() => confirmar(`¿Reconciliar y finalizar el ${tipo} #${f.id}? Verifica antes que las operaciones del conductor/comercio cuadran.`) && ejecutar(`/admin/${tipo}s/${f.id}/resolver-finalizacion`, {}, `${tipo[0].toUpperCase() + tipo.slice(1)} #${f.id} finalizado.`)}>Resolver y finalizar</button>
);

function MapaOperaciones() {
  const [d, err, cargar] = useDatos('/admin/ubicaciones-activas');
  const puntos = d?.puntos ?? [];
  const osm = (p) => `https://www.openstreetmap.org/?mlat=${p.latitud}&mlon=${p.longitud}#map=17/${p.latitud}/${p.longitud}`;
  return (
    <section>
      <h2>Mapa operativo</h2>
      <p className="sub">Muestra ubicaciones GPS reales y recientes (últimos 120 segundos) solo de conductores con viaje, delivery o envío activo. No muestra conductores fuera de servicio.</p>
      <div className="barra"><button className="btn" onClick={cargar}>Actualizar posiciones</button><span>{puntos.length} servicio(s) con ubicación reciente</span></div>
      {err && <div className="msg e" role="alert">{err}</div>}
      <div className="mapa">
        <Suspense fallback={<p className="vacio">Cargando mapa…</p>}><MapaOperativo puntos={puntos} /></Suspense>
        <p className="sub">Mapa gratuito de OpenFreeMap con datos de OpenStreetMap (sin token ni costo). Amarillo: viaje · Azul: delivery · Verde: envío. Si el mapa no carga, usa la tabla y el botón "Ver en OpenStreetMap".</p>
      </div>
      {d && <Tabla filas={puntos} acciones={(p) => <a className="btn" href={osm(p)} target="_blank" rel="noopener noreferrer">Ver en OpenStreetMap</a>} />}
      {d && puntos.length === 0 && <p className="vacio">No hay conductores con servicios activos y GPS reciente.</p>}
    </section>
  );
}

function Ciudades() {
  const [d, err, cargar] = useDatos('/admin/ciudades');
  const { ejecutar, aviso, ocupado } = useAccion(cargar);
  return (
    <section>
      <h2>Ciudades de operación</h2>
      <p className="sub">La Paz y El Alto se habilitan para la prueba inicial. Las demás ciudades permanecen guardadas, pero no aparecen en el registro mientras estén inactivas.</p>
      <div className="barra"><button className="btn" onClick={cargar}>Actualizar</button></div>
      {err && <div className="msg e" role="alert">{err}</div>}{aviso}
      {d && <Tabla filas={d.ciudades} acciones={(c) => (
        <button className={'btn ' + (Number(c.activa) === 1 ? 'mal' : 'ok')} disabled={ocupado}
          onClick={() => ejecutar(`/admin/ciudades/${c.id}/${Number(c.activa) === 1 ? 'desactivar' : 'activar'}`, {}, Number(c.activa) === 1 ? `${c.nombre} desactivada.` : `${c.nombre} activada.`)}>
          {Number(c.activa) === 1 ? 'Desactivar' : 'Activar'}
        </button>
      )} />}
    </section>
  );
}

function TarifasAdmin() {
  const [d, err, cargar] = useDatos('/admin/tarifas');
  const { ejecutar, aviso, ocupado } = useAccion(cargar);
  const [valores, setValores] = useState({});
  useEffect(() => { if (d?.valores) setValores(d.valores); }, [d]);
  const parametros = d?.parametros ?? [];
  const grupos = [...new Set(parametros.map((p) => p.grupo))];
  return (
    <section>
      <h2>Tarifas dinámicas</h2>
      <p className="sub">Todos los importes de transporte se cobran en bolivianos enteros. La misma fórmula se usa en viajes, envíos personales y delivery de comercios; los costos cambian por moto o auto.</p>
      <div className="msg">La base es Bs 4 normalmente. Baja a Bs 3 solo si hay al menos el umbral configurado de conductores compatibles cerca y la oferta supera la demanda. La aproximación hasta la recogida se calcula por separado.</div>
      {err && <div className="msg e" role="alert">{err}</div>}{aviso}
      {parametros.length === 0 && !err && <p className="vacio">Cargando parámetros del motor de tarifas…</p>}
      {grupos.map((grupo) => (
        <div className="tarifa-grupo" key={grupo}>
          <h3>{grupo}</h3>
          <div className="tarifas-grid">
            {parametros.filter((p) => p.grupo === grupo).map((p) => (
              <label className="tarifa-campo" key={p.clave}>
                <span>{p.etiqueta}</span>
                <small>{p.descripcion}</small>
                <div className="tarifa-entrada">
                  <input type="number" inputMode="numeric" step="1" min={p.minimo} max={p.maximo}
                    value={valores[p.clave] ?? p.valor}
                    onChange={(e) => setValores((prev) => ({ ...prev, [p.clave]: e.target.value === '' ? '' : Number(e.target.value) }))}
                    aria-label={p.etiqueta} />
                  <b>{p.unidad}</b>
                </div>
                <small>Permitido: entero de {p.minimo} a {p.maximo}.</small>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div className="barra">
        <button className="btn" onClick={cargar} disabled={ocupado}>Recargar valores</button>
        <button className="btn ok" disabled={ocupado || parametros.length === 0}
          onClick={() => ejecutar('/admin/tarifas', { valores }, 'Tarifas guardadas. Las nuevas cotizaciones usarán estos parámetros.')}>Guardar tarifas</button>
      </div>
      <p className="sub">Los cambios no modifican viajes, envíos ni pedidos históricos. Cada nueva cotización guardará su propio detalle de tarifa para auditoría.</p>
    </section>
  );
}

const ROLES = { pasajero: 'Pasajero', conductor: 'Conductor', comercio: 'Comercio', admin: 'Administrador', soporte: 'Soporte' };

// Verificación inicial: el usuario se registra como 'pendiente' y envía un WhatsApp a De Volada;
// el administrador revisa sus datos y aprueba o rechaza la cuenta desde aquí.
function AsignarPin({ id, nombre, ejecutar, ocupado }) {
  const asignar = () => {
    const pin = preguntar(`Nuevo PIN de 4 dígitos para ${nombre}:`);
    if (pin == null) return;
    if (!/^\d{4}$/.test(pin)) return window.alert('El PIN debe tener exactamente 4 dígitos.');
    if (preguntar('Repite el PIN para confirmar:') !== pin) return window.alert('Los PIN no coinciden. No se hizo ningún cambio.');
    ejecutar(`/admin/usuarios/${id}/pin`, { pin }, `PIN asignado a ${nombre}. Comunícaselo por WhatsApp; sus sesiones abiertas se cerraron.`);
  };
  return <button className="btn" disabled={ocupado} onClick={(ev) => { ev.stopPropagation(); asignar(); }}>Asignar PIN</button>;
}

function UsuariosPendientes() {
  return <Cola titulo="Usuarios pendientes" sub="Cuentas nuevas esperando aprobación manual (las más antiguas primero). Compara nombre y teléfono con el mensaje de WhatsApp recibido antes de aprobar."
    ruta={() => '/admin/usuarios/pendientes'} clave="usuarios"
    transformar={(u) => ({ id: u.id, nombre: `${u.nombre ?? ''} ${u.apellido ?? ''}`.trim() || '—', telefono: u.telefono, rol: ROLES[u.rol] ?? u.rol, ciudad: u.ciudad, fecha_registro: fecha(u.creado_en) })}
    acciones={(f, ejecutar, ocupado) => (<><Decidir base={`/admin/usuarios/${f.id}`} ejecutar={ejecutar} ocupado={ocupado} okTxt={`Cuenta de ${f.nombre} aprobada. Ya puede iniciar sesión.`} malTxt={`Solicitud de ${f.nombre} rechazada.`} /><AsignarPin id={f.id} nombre={f.nombre} ejecutar={ejecutar} ocupado={ocupado} /></>)} />;
}

// Recargas de operaciones: Bs 2 verificados acreditan 1 operación (mínimo Bs 2).
function RecargasOperaciones() {
  return <Cola titulo="Recargas de operaciones" sub="Confirma únicamente después de verificar el depósito real en la cuenta oficial. Cada Bs 2 acredita 1 operación; las recargas deben ser múltiplos de Bs 2."
    aviso="Las operaciones son unidades internas, no dinero. No existen retiros, transferencias entre usuarios ni envío de dinero. Cada viaje, envío/delivery o venta completada consume 1 operación según corresponda."
    estados={['pendiente', 'confirmada', 'rechazada']} ruta={(e) => `/admin/operaciones/recargas?estado=${e}`} clave="recargas"
    transformar={(r) => { const monto = Number(r.monto_bs ?? r.monto); const cantidad = Number(r.operaciones_acreditadas ?? r.operaciones_a_acreditar ?? Math.floor(monto / 2)); return { id: r.id, solicitante: `${r.nombre ?? ''} ${r.apellido ?? ''}`.trim() || `Usuario #${r.usuario_id}`, telefono: r.telefono, rol: ROLES[r.rol] ?? r.rol, monto_depositado: `Bs ${monto.toFixed(2)}`, [r.estado === 'confirmada' ? 'operaciones_acreditadas' : 'operaciones_a_acreditar']: cantidad, metodo: r.metodo, referencia_cliente: r.referencia_cliente, referencia_pago: r.referencia_pago, motivo_revision: r.motivo_revision, solicitado: fecha(r.solicitado_en), _monto: monto }; }}
    acciones={(f, ejecutar, ocupado, estado) => estado === 'pendiente' && <>
      <button className="btn ok" disabled={ocupado} onClick={() => { const r = preguntar(`Depósito verificado de Bs ${f._monto.toFixed(2)} → +${Math.floor(f._monto / 2)} operaciones para ${f.solicitante}.\nReferencia del depósito verificado:`); if (r) ejecutar(`/admin/operaciones/recargas/${f.id}/confirmar`, { referencia_pago: r }, `Recarga confirmada: +${Math.floor(f._monto / 2)} operaciones para ${f.solicitante}.`); }}>Confirmar y acreditar</button>
      <button className="btn mal" disabled={ocupado} onClick={() => { const m = preguntar('Motivo del rechazo (mínimo 5 caracteres):'); if (m) ejecutar(`/admin/operaciones/recargas/${f.id}/rechazar`, { motivo: m }, 'Recarga rechazada. No se acreditaron operaciones.'); }}>Rechazar</button>
    </>} />;
}

const SECCIONES = {
  resumen: ['Resumen', Resumen],
  mapa: ['Mapa operativo', MapaOperaciones],
  pendientes: ['Usuarios pendientes', UsuariosPendientes],
  usuarios: ['Usuarios', function UsuariosPage() { return <Cola titulo="Usuarios" sub="Consulta cuentas y estados de verificación. Los datos sensibles de autenticación no se muestran." ruta={() => '/admin/usuarios'} clave="usuarios" acciones={(f, ejecutar, ocupado) => f.estado !== 'eliminado' && <AsignarPin id={f.id} nombre={[f.nombre, f.apellido].filter(Boolean).join(' ') || `#${f.id}`} ejecutar={ejecutar} ocupado={ocupado} />} />; }],
  ciudades: ['Ciudades', Ciudades],
  tarifas: ['Tarifas', TarifasAdmin],
  viajes: ['Viajes', function ViajesPage() { return <Cola titulo="Viajes" sub="Seguimiento administrativo de solicitudes, servicios activos, finalizados y viajes en revisión." estados={['solicitado','aceptado','conductor_llego','en_curso','finalizado','cancelado_pasajero','cancelado_conductor','expirado','requiere_revision','programado_pendiente','programado_asignado']} ruta={(e) => `/admin/viajes?estado=${encodeURIComponent(e)}`} clave="viajes" />; }],
  pedidos: ['Pedidos', function PedidosPage() { return <Cola titulo="Pedidos" sub="Consulta pedidos comerciales, asignaciones, pagos y estados de conciliación." estados={['creado','buscando_repartidor','asignado','recogido','en_camino','entregado','cancelado','requiere_revision','reembolso_pendiente']} ruta={(e) => `/admin/pedidos?estado=${encodeURIComponent(e)}`} clave="pedidos" />; }],
  reembolsos: ['Reembolsos QR', function ReembolsosPage() { return <Cola titulo="Reembolsos QR pendientes" sub="Esta cola es de seguimiento. El comercio debe devolver realmente el dinero y registrar la referencia bancaria; el panel no simula una devolución." ruta={() => '/admin/pedidos/reembolsos'} clave="pedidos" />; }],
  conductores: ['Conductores', function ConductoresPage() { return <Cola titulo="Conductores" sub="Revisa documentos y aprueba o rechaza solicitudes. Pulsa una fila para ver el detalle." estados={['en_revision', 'pendiente', 'aprobado', 'rechazado', 'suspendido']} ruta={(e) => `/admin/conductores?estado=${e}`} clave="conductores" Detalle={ConductorDet} />; }],
  comercios: ['Comercios', function ComerciosPage() { return <Cola titulo="Comercios" sub="Aprueba los comercios que aparecerán en la app." estados={['pendiente', 'aprobado', 'rechazado']} ruta={(e) => `/admin/comercios?estado=${e}`} clave="comercios" Detalle={ComercioDet} />; }],
  recargas: ['Recargas de operaciones', RecargasOperaciones],
  revision: ['Por conciliar', function RevisionPage() { return (<>
    <Cola titulo="Pedidos por conciliar" sub="Pedidos cuyo saldo o reserva no cuadró al finalizar." ruta={() => '/admin/pedidos/revision'} clave="pedidos" acciones={resolver('pedido')} />
    <div style={{ height: 28 }} />
    <Cola titulo="Viajes por conciliar" sub="Viajes cuyo saldo o reserva no cuadró al finalizar." ruta={() => '/admin/viajes/revision'} clave="viajes" acciones={resolver('viaje')} />
  </>); }],
  envios: ['Envíos', function EnviosPage() {
    const transformar = (e) => ({
      ...e,
      valor_paquete: e.cobra_paquete ? `Bs ${Number(e.importe_paquete || 0).toFixed(2)}` : 'Sin cobro',
      cobro_paquete: !e.cobra_paquete ? 'No aplica' : e.estado_cobro_paquete === 'confirmado' ? 'Confirmado por remitente' : 'Pendiente',
      metodo_delivery: e.metodo_pago === 'qr' ? 'QR al repartidor' : 'Efectivo al repartidor',
      cobro_delivery: e.estado_cobro_delivery === 'confirmado' ? 'Confirmado por repartidor' : e.estado_cobro_delivery === 'no_aplica' ? 'Sin trazabilidad previa' : 'Pendiente',
    });
    return <Cola titulo="Envíos entre personas" sub="Seguimiento de recogidas y entregas. Valor del paquete y tarifa del delivery se concilian por separado; el panel nunca muestra QR privados ni códigos PIN." estados={['solicitado','asignado','recogido','en_camino','en_punto_entrega','entregado','cancelado','requiere_revision']} ruta={(e) => `/admin/envios?estado=${encodeURIComponent(e)}`} clave="envios" transformar={transformar} />;
  }],
  soporte: ['Soporte', function SoportePage() { return <Cola titulo="Centro de soporte" sub="Casos enviados desde las cuentas de pasajeros, conductores y comercios. Cada respuesta queda registrada en auditoría." estados={['abierto','en_revision','resuelto','cerrado']} ruta={(e) => `/admin/soporte/tickets?estado=${encodeURIComponent(e)}`} clave="tickets" acciones={(f, ejecutar, ocupado) => (<>
    <button className="btn ok" disabled={ocupado} onClick={() => { const r = preguntar(`Respuesta para el ticket #${f.id} (mínimo 2 caracteres):`); if (r) ejecutar(`/admin/soporte/tickets/${f.id}/responder`, { respuesta: r, estado: 'resuelto' }, `Ticket #${f.id} respondido y resuelto.`); }}>Responder y resolver</button>
    <button className="btn" disabled={ocupado} onClick={() => { const r = preguntar(`Respuesta para el ticket #${f.id}:`); if (r) ejecutar(`/admin/soporte/tickets/${f.id}/responder`, { respuesta: r, estado: 'en_revision' }, `Respuesta guardada para el ticket #${f.id}.`); }}>Responder y seguir</button>
  </>)} />; }],
  calificaciones: ['Calificaciones', function CalificacionesPage() {
    const [tipo, setTipo] = useState('todas');
    const [puntaje, setPuntaje] = useState('');
    const filtro = `${tipo !== 'todas' ? `tipo=${encodeURIComponent(tipo)}&` : ''}${puntaje ? `puntaje=${puntaje}` : ''}`;
    const [d, err, cargar] = useDatos(`/admin/calificaciones${filtro ? `?${filtro}` : ''}`);
    const filas = d?.calificaciones ?? [];
    const promedio = filas.length ? (filas.reduce((s, f) => s + Number(f.puntaje || 0), 0) / filas.length).toFixed(2) : '—';
    return <section>
      <h2>Calificaciones y opiniones</h2><p className="sub">Opiniones registradas para conductores, comercios, envíos y la aplicación. Es una vista de lectura; no permite editar ni eliminar reseñas.</p>
      <div className="barra filtros">
        <label>Tipo <select value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="todas">Todas las opiniones</option><option value="conductor">Conductores / viajes</option><option value="comercio">Comercios</option><option value="envio">Repartidores / envíos</option><option value="app">Aplicación De Volada</option></select></label>
        <label>Estrellas <select value={puntaje} onChange={(e) => setPuntaje(e.target.value)}><option value="">Todas</option><option value="5">5 estrellas</option><option value="4">4 estrellas</option><option value="3">3 estrellas</option><option value="2">2 estrellas</option><option value="1">1 estrella</option></select></label>
        <button className="btn" onClick={cargar}>Actualizar</button>
      </div>
      {err && <div className="msg e" role="alert">{err}</div>}
      <div className="tarjetas resumen-cali">
        <div className="tarjeta"><b>{filas.length}</b><span>Opiniones cargadas (máx. 300 recientes)</span></div>
        <div className="tarjeta"><b>{promedio}{promedio !== '—' ? ' / 5' : ''}</b><span>Promedio de las opiniones cargadas</span></div>
        <div className="tarjeta"><b>{filas.filter((f) => Number(f.puntaje) <= 2).length}</b><span>Opiniones de 1–2 estrellas cargadas</span></div>
      </div>
      {d && <Tabla filas={filas} />}
      {d && filas.length === 0 && <p className="vacio">No hay opiniones que coincidan con estos filtros.</p>}
    </section>;
  }],
  auditoria: ['Auditoría', Auditoria],
};

function Login({ entrar }) {
  const [tel, setTel] = useState('');
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [ocupado, setO] = useState(false);
  // Inicio de sesión con teléfono + PIN de 4 dígitos (sin OTP, sin costo).
  const enviar = async (ev) => {
    ev.preventDefault(); setErr(''); setO(true);
    try {
      const r = await api.post('/entrar', { telefono: tel, pin });
      setToken(r.token);
      if (r.usuario?.rol !== 'admin') { await api.post('/sesion/cerrar').catch(() => {}); setToken(null); throw new Error('Esta cuenta no tiene permisos de administrador.'); }
      entrar();
    } catch (x) { setErr(x.message); setPin(''); }
    setO(false);
  };
  return (
    <form className="login" onSubmit={enviar}>
      <div className="login-brand"><span className="brand-mark" aria-hidden="true"><b>D</b><i /><em /></span><div><h1>DE VOLADA</h1><small>Centro de administración</small></div></div>
      <p>Ingresa el teléfono y el PIN de tu cuenta de administrador.</p>
      {err && <div className="msg e" role="alert">{err}</div>}
      <input aria-label="Teléfono" inputMode="tel" placeholder="Teléfono" value={tel} onChange={(e) => setTel(e.target.value)} autoFocus />
      <input aria-label="PIN" type="password" inputMode="numeric" maxLength={4} placeholder="PIN de 4 dígitos" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
      <button className="btn ok" disabled={ocupado}>Entrar</button>
    </form>
  );
}

export default function App() {
  const [dentro, setDentro] = useState(hayToken());
  const [sec, setSec] = useState('resumen');
  if (!dentro) return <Login entrar={() => setDentro(true)} />;
  const PantallaActiva = SECCIONES[sec][1];
  const salir = async () => { await api.post('/sesion/cerrar').catch(() => {}); setToken(null); setDentro(false); };
  return (
    <div className="app">
      <nav className="lado" aria-label="Secciones">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true"><b>D</b><i /><em /></span>
          <span className="brand-name">DE VOLADA<small>ADMINISTRACIÓN</small></span>
        </div>
        <div className="nav-group-label">OPERACIONES</div>
        {Object.entries(SECCIONES).map(([k, [t]]) => <button key={k} className={sec === k ? 'on' : ''} onClick={() => setSec(k)}><span className="nav-dot" />{t}</button>)}
        <div className="sidebar-foot"><span className="status-dot" /> API y controles administrativos <button className="fin" onClick={salir}>Cerrar sesión</button></div>
      </nav>
      <main key={sec}>
        <header className="topbar"><div><span className="eyebrow">DE VOLADA / CENTRO DE CONTROL</span><strong>{SECCIONES[sec][0]}</strong></div><span className="top-chip"><i /> Sesión de administrador</span></header>
        <PantallaActiva />
      </main>
    </div>
  );
}
