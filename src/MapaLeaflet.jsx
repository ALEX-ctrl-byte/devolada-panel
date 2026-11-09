import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Mapa gratuito sin token: Leaflet + teselas estándar de OpenStreetMap.
// Uso de bajo volumen (solo el administrador), con atribución visible, según la política de teselas de OSM.
const COLORES = { viaje: '#E8B931', delivery: '#2388D1', envio: '#64D3AE' };
const CENTRO_LA_PAZ = [-16.5, -68.15];

export default function MapaLeaflet({ puntos }) {
  const nodo = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);

  useEffect(() => {
    mapa.current = L.map(nodo.current, { center: CENTRO_LA_PAZ, zoom: 12 });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">colaboradores de OpenStreetMap</a>',
    }).addTo(mapa.current);
    capa.current = L.layerGroup().addTo(mapa.current);
    return () => { mapa.current.remove(); mapa.current = null; };
  }, []);

  useEffect(() => {
    if (!mapa.current) return;
    capa.current.clearLayers();
    const validos = puntos.filter((p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud));
    validos.forEach((p) => {
      const etiqueta = `${p.nombre ?? ''} ${p.apellido ?? ''}`.trim() || `Conductor #${p.conductor_id}`;
      L.circleMarker([p.latitud, p.longitud], { radius: 8, weight: 2, color: '#06151f', fillColor: COLORES[p.tipo_servicio] ?? '#ffffff', fillOpacity: 0.95 })
        .bindTooltip(`${etiqueta} · ${p.tipo_servicio} #${p.servicio_id} (${p.estado_servicio})`)
        .addTo(capa.current);
    });
    if (validos.length === 1) mapa.current.setView([validos[0].latitud, validos[0].longitud], 15);
    else if (validos.length > 1) mapa.current.fitBounds(validos.map((p) => [p.latitud, p.longitud]), { padding: [30, 30], maxZoom: 16 });
  }, [puntos]);

  return <div ref={nodo} className="mapa-leaflet" role="region" aria-label="Mapa de conductores con servicios activos" />;
}
