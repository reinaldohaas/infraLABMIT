import { useState, useEffect, useCallback } from 'react';

const SWPC_KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const SWPC_FLARES_URL = 'https://services.swpc.noaa.gov/json/goes/primary/xrays-1-day.json';

export function useSpaceWeather() {
  const [kpIndex, setKpIndex] = useState(null);
  const [flareClass, setFlareClass] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSpaceWeather = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch Kp Index
      const kpRes = await fetch(SWPC_KP_URL);
      if (kpRes.ok) {
        const kpData = await kpRes.json();
        // O JSON do Kp é um array de arrays onde a primeira linha é o cabeçalho
        // Ex: ["time_tag", "Kp", "a_running", "station_count"]
        if (kpData && kpData.length > 1) {
          const latest = kpData[kpData.length - 1];
          setKpIndex({
            time: new Date(latest[0]),
            value: parseFloat(latest[1])
          });
        }
      }

      // Fetch Solar Flares
      const flareRes = await fetch(SWPC_FLARES_URL);
      if (flareRes.ok) {
        const flareData = await flareRes.json();
        if (flareData && flareData.length > 0) {
          // Os dados vêm em ordem temporal
          const latest = flareData[flareData.length - 1];
          // O fluxo é dado em W/m^2. Classificação: A(<10^-7), B(10^-7), C(10^-6), M(10^-5), X(>=10^-4)
          const flux = latest.flux;
          let cls = 'A';
          if (flux >= 1e-4) cls = 'X';
          else if (flux >= 1e-5) cls = 'M';
          else if (flux >= 1e-6) cls = 'C';
          else if (flux >= 1e-7) cls = 'B';
          
          setFlareClass({
            time: new Date(latest.time_tag),
            flux: flux,
            classification: cls
          });
        }
      }

      setError(null);
    } catch (err) {
      console.error('Erro ao buscar clima espacial:', err);
      setError('Falha ao conectar com o NOAA SWPC');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSpaceWeather();
    // Atualiza clima espacial a cada 30 minutos
    const interval = setInterval(fetchSpaceWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSpaceWeather]);

  return { kpIndex, flareClass, loading, error, refresh: fetchSpaceWeather };
}
