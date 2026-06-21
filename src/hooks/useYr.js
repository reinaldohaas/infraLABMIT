// ============================================================
//  useYr.js — Hook para previsão do tempo via Yr (api.met.no)
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useState, useEffect, useCallback } from 'react';

const YR_BASE = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const NOMINATIM = 'https://nominatim.openstreetmap.org/reverse';
const USER_AGENT = 'LABMIT-UFSC-InfrasoundApp/1.0 reinaldo.haas@ufsc.br';

// Símbolos Yr → descrição em português
const SYMBOL_MAP = {
  clearsky: 'Céu limpo', fair: 'Tempo bom', partlycloudy: 'Parcialmente nublado',
  cloudy: 'Nublado', fog: 'Neblina', lightrain: 'Chuva fraca',
  rain: 'Chuva', heavyrain: 'Chuva intensa', lightrainshowers: 'Pancadas fracas',
  rainshowers: 'Pancadas', heavyrainshowers: 'Pancadas intensas',
  lightsleet: 'Granizo fraco', sleet: 'Granizo', heavysleet: 'Granizo intenso',
  lightsnow: 'Neve fraca', snow: 'Neve', heavysnow: 'Neve intensa',
  thunder: 'Trovões', lightrainandthunder: 'Chuva e trovões',
  rainandthunder: 'Chuva intensa e trovões',
};

function parseSymbol(code) {
  if (!code) return 'Desconhecido';
  const base = code.replace(/_day$|_night$|_polartwilight$/, '');
  return SYMBOL_MAP[base] || code;
}

function isStormSymbol(code) {
  if (!code) return false;
  return ['thunder', 'lightrainandthunder', 'rainandthunder', 'heavyrain',
    'heavyrainshowers', 'sleet', 'heavysleet'].some(s => code.includes(s));
}

export function useYr() {
  const [location, setLocation] = useState(null);
  const [locationName, setLocationName] = useState('Detectando localização...');
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stormWarning, setStormWarning] = useState(false);

  const fetchForecast = useCallback(async (lat, lon) => {
    try {
      setLoading(true);
      const url = `${YR_BASE}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      });
      if (!res.ok) throw new Error(`Yr API: ${res.status}`);
      const json = await res.json();

      const timeseries = json.properties.timeseries.slice(0, 48);
      const parsed = timeseries.map(ts => {
        const d = ts.data;
        const instant = d.instant.details;
        const next1h = d.next_1_hours?.details || {};
        const next6h = d.next_6_hours?.details || {};
        const symbol = d.next_1_hours?.summary?.symbol_code ||
                       d.next_6_hours?.summary?.symbol_code || '';

        return {
          time: new Date(ts.time),
          temp: instant.air_temperature,
          pressure: instant.air_pressure_at_sea_level,
          humidity: instant.relative_humidity,
          windSpeed: instant.wind_speed,
          windDir: instant.wind_from_direction,
          precipitation: next1h.precipitation_amount ?? next6h.precipitation_amount ?? 0,
          symbol,
          symbolText: parseSymbol(symbol),
          isStorm: isStormSymbol(symbol),
          cloudArea: instant.cloud_area_fraction,
        };
      });

      setForecast(parsed);
      setStormWarning(parsed.slice(0, 12).some(f => f.isStorm));
      setError(null);
    } catch (e) {
      setError(`Erro na previsão: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLocationName = useCallback(async (lat, lon) => {
    try {
      const res = await fetch(
        `${NOMINATIM}?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'User-Agent': USER_AGENT } }
      );
      const data = await res.json();
      const addr = data.address;
      const name = addr.city || addr.town || addr.village || addr.municipality || 'Localização desconhecida';
      const state = addr.state || '';
      setLocationName(`${name}${state ? ', ' + state : ''}`);
    } catch {
      setLocationName('Localização detectada');
    }
  }, []);

  const detect = useCallback(() => {
    if (!navigator.geolocation) {
      // Fallback: Florianópolis
      const lat = -27.5954, lon = -48.548;
      setLocation({ lat, lon });
      setLocationName('Florianópolis, SC (padrão)');
      fetchForecast(lat, lon);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation({ lat, lon });
        fetchLocationName(lat, lon);
        fetchForecast(lat, lon);
      },
      () => {
        const lat = -27.5954, lon = -48.548;
        setLocation({ lat, lon });
        setLocationName('Florianópolis, SC (padrão)');
        fetchForecast(lat, lon);
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, [fetchForecast, fetchLocationName]);

  useEffect(() => {
    detect();
    const interval = setInterval(detect, 30 * 60 * 1000); // atualiza a cada 30 min
    return () => clearInterval(interval);
  }, [detect]);

  return { location, locationName, forecast, loading, error, stormWarning, refresh: detect };
}
