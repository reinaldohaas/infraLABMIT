// ============================================================
//  WeatherForecast.jsx — Previsão Yr (Colapsável)
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useEffect, useRef } from 'react';
import { Cloud, RefreshCw, MapPin } from 'lucide-react';

function WindDir(deg) {
  const dirs = ['N','NE','L','SE','S','SO','O','NO'];
  return dirs[Math.round(deg / 45) % 8];
}

function formatHour(date) {
  return date.toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
}

function WeatherIcon({ symbol }) {
  if (!symbol) return '—';
  if (symbol.includes('thunder')) return '⛈';
  if (symbol.includes('snow') || symbol.includes('sleet')) return '🌨';
  if (symbol.includes('heavyrain')) return '🌧';
  if (symbol.includes('rain')) return '🌦';
  if (symbol.includes('cloudy')) return '☁';
  if (symbol.includes('partlycloudy')) return '⛅';
  if (symbol.includes('fair')) return '🌤';
  if (symbol.includes('clearsky')) return '☀';
  if (symbol.includes('fog')) return '🌫';
  return '🌡';
}

export default function WeatherForecast({ forecast, locationName, loading, error, stormWarning, location, onRefresh, visible }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);

  // Inicializa Leaflet apenas quando visível
  useEffect(() => {
    if (!visible || !mapRef.current) return;

    if (mapRef.current._leaflet_id) {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    }

    import('leaflet').then(L => {
      if (!mapRef.current || mapInstanceRef.current) return;

      delete L.Icon.Default.prototype._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const lat = location?.lat ?? -27.5954;
      const lon = location?.lon ?? -48.548;

      const map = L.map(mapRef.current, {
        center: [lat, lon], zoom: 8,
        zoomControl: true, attributionControl: false,
      });
      mapInstanceRef.current = map;

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OSM, CARTO', maxZoom: 18,
      }).addTo(map);

      const marker = L.marker([lat, lon]).addTo(map)
        .bindPopup(`<b>${locationName}</b>`);
      markerRef.current = marker;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, [visible]);

  useEffect(() => {
    if (!location || !mapInstanceRef.current || !markerRef.current) return;
    import('leaflet').then(() => {
      markerRef.current.setLatLng([location.lat, location.lon]);
      mapInstanceRef.current.setView([location.lat, location.lon], 8);
    });
  }, [location]);

  if (!visible) return null;

  return (
    <div className="expand-body">
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <MapPin size={11} /> {locationName}
        </span>
        <button className="btn-sm" onClick={onRefresh} disabled={loading} style={{ padding: '3px 8px' }}>
          <RefreshCw size={10} style={{ marginRight: 4 }} /> Atualizar
        </button>
      </div>

      {stormWarning && (
        <div style={{ background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.3)', borderRadius: 4, padding: '6px 10px', marginBottom: 8, fontSize: 11, color: 'var(--danger)' }}>
          ⛈ Risco de tempestade nas próximas 12h!
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /> Carregando Yr...</div>
      ) : error ? (
        <div className="error-msg">{error}</div>
      ) : (
        <div className="weather-scroll">
          <table className="weather-table">
            <thead>
              <tr><th>Hora</th><th></th><th>Temp.</th><th>Pressão</th><th>Chuva</th><th>Vento</th><th>Cond.</th></tr>
            </thead>
            <tbody>
              {forecast.slice(0, 24).map((f, i) => (
                <tr key={i} className={f.isStorm ? 'storm-row' : ''}>
                  <td className="text-mono" style={{ whiteSpace: 'nowrap', fontSize: 10 }}>{formatHour(f.time)}</td>
                  <td>{WeatherIcon({ symbol: f.symbol })}</td>
                  <td className="text-mono">{f.temp?.toFixed(1) ?? '—'}°C</td>
                  <td className="text-mono">{f.pressure?.toFixed(0) ?? '—'} hPa</td>
                  <td className="text-mono" style={{ color: f.precipitation > 5 ? 'var(--accent)' : 'inherit' }}>
                    {f.precipitation?.toFixed(1) ?? '0'} mm
                  </td>
                  <td className="text-mono">
                    {f.windSpeed?.toFixed(1)} m/s {f.windDir != null ? WindDir(f.windDir) : ''}
                  </td>
                  <td style={{ fontSize: 10, color: f.isStorm ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {f.symbolText}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div ref={mapRef} className="weather-map" style={{ background: '#0d1526' }} />
      <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
        Dados: Yr / MET Norway · Mapa: © OpenStreetMap, CARTO
      </div>
    </div>
  );
}

