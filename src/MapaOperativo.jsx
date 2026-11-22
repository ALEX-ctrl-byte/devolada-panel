import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

// Mismo proveedor que la app Android: OpenFreeMap (datos de OpenStreetMap), gratuito y sin token.
// A diferencia de tile.openstreetmap.org (servidores de voluntarios que bloquean aplicaciones),
// OpenFreeMap está pensado para uso en producción. La atribución la muestra el propio estilo.
const ESTILO = 'https://tiles.openfreemap.org/styles/liberty';
const CENTRO_LA_PAZ = [-68.15, -16.5]; // [lng, lat]
const COLORES = { viaje: '#E8B931', delivery: '#2388D1', envio: '#64D3AE' };
const VACIO = { type: 'FeatureCollection', features: [] };

function aGeoJson(puntos) {
  return {
    type: 'FeatureCollection',
    features: puntos
      .filter((p) => Number.isFinite(p.latitud) && Number.isFinite(p.longitud))
      .map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.longitud, p.latitud] },
        properties: {
          tipo: p.tipo_servicio ?? '',
          etiqueta: `${`${p.nombre ?? ''} ${p.apellido ?? ''}`.trim() || `Conductor #${p.conductor_id}`} · ${p.tipo_servicio} #${p.servicio_id} (${p.estado_servicio})`,
        },
      })),
  };
}

export default function MapaOperativo({ puntos }) {
  const nodo = useRef(null);
  const mapa = useRef(null);
  const listo = useRef(false);
  const ultimos = useRef(puntos);
  const [fallo, setFallo] = useState('');

  const dibujar = () => {
    const m = mapa.current;
    if (!m || !listo.current) return;
    const datos = aGeoJson(ultimos.current);
    m.getSource('puntos')?.setData(datos);
    const coords = datos.features.map((f) => f.geometry.coordinates);
    if (coords.length === 1) m.easeTo({ center: coords[0], zoom: 15 });
    else if (coords.length > 1) {
      const limites = coords.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
      m.fitBounds(limites, { padding: 40, maxZoom: 16 });
    }
  };

  useEffect(() => {
    const m = new maplibregl.Map({ container: nodo.current, style: ESTILO, center: CENTRO_LA_PAZ, zoom: 12 });
    mapa.current = m;
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

    m.on('load', () => {
      m.addSource('puntos', { type: 'geojson', data: VACIO });
      m.addLayer({
        id: 'puntos',
        type: 'circle',
        source: 'puntos',
        paint: {
          'circle-radius': 8,
          'circle-color': ['match', ['get', 'tipo'], 'viaje', COLORES.viaje, 'delivery', COLORES.delivery, 'envio', COLORES.envio, '#ffffff'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#06151f',
          'circle-opacity': 0.95,
        },
      });
      const aviso = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
      m.on('mousemove', 'puntos', (e) => {
        m.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (f) aviso.setLngLat(f.geometry.coordinates).setText(f.properties.etiqueta).addTo(m);
      });
      m.on('mouseleave', 'puntos', () => { m.getCanvas().style.cursor = ''; aviso.remove(); });
      listo.current = true;
      dibujar();
    });

    m.on('error', (e) => {
      // Errores de estilo o de red al cargar el mapa base: se avisa sin romper el panel.
      if (!listo.current) setFallo('No se pudo cargar el mapa base. Revisa tu conexión; la tabla de abajo sigue disponible.');
      console.warn('Mapa:', e?.error?.message ?? e);
    });

    return () => { listo.current = false; m.remove(); mapa.current = null; };
  }, []);

  useEffect(() => { ultimos.current = puntos; dibujar(); }, [puntos]);

  return (
    <>
      {fallo && <p className="vacio" role="alert">{fallo}</p>}
      <div ref={nodo} className="mapa-leaflet" role="region" aria-label="Mapa de conductores con servicios activos" />
    </>
  );
}
