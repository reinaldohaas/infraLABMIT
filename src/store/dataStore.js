// ============================================================
//  dataStore.js — Armazenamento e envio de pacotes LABMIT
//  Formato JSON compatível com RedVox API 1000
//  Upload via Firebase Firestore com Auth Anônimo e Stats
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { db, ensureAuth } from '../firebase';

const LOCAL_KEY = 'labmit_spl_history';
const ANOMALY_KEY = 'labmit_pressure_anomalies';
const MAX_LOCAL = 3600; // ~30 min a 2/s
const FLUSH_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos

let localBuffer = [];
let lastFlush = Date.now();
let latestContext = {};

// Carrega histórico do localStorage na inicialização
try {
  const saved = localStorage.getItem(LOCAL_KEY);
  if (saved) localBuffer = JSON.parse(saved);
} catch (e) {
  console.error('[DataStore] Erro ao carregar cache:', e);
  localBuffer = [];
}

/**
 * Registra uma leitura no buffer local.
 */
export function recordReading({ spl, dominantFreq, envContext }) {
  const entry = {
    t: Date.now(),
    spl: Math.round((spl ?? -120) * 10) / 10,
    freq: Math.round((dominantFreq ?? 0) * 10) / 10,
  };

  if (envContext) latestContext = envContext;

  localBuffer.push(entry);

  if (localBuffer.length % 50 === 0) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(localBuffer.slice(-MAX_LOCAL)));
    } catch (e) {
      console.error('[DataStore] Erro ao salvar cache:', e);
    }
  }

  if (Date.now() - lastFlush > FLUSH_INTERVAL_MS || localBuffer.length >= MAX_LOCAL) {
    flushBufferToCloud(); // Note that flushBufferToCloud might be called without deviceInfo/pressureAnomalies in this automatic path. In a real app we'd pass a provider or use a global store for device info, but for this simple version we rely on the periodic manual call from App or pass nulls.
  }

  return entry;
}

function computeStats(readings) {
  if (readings.length === 0) return {};

  const splValues = readings.map(r => r.spl);
  const freqValues = readings.map(r => r.freq);

  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const std = (arr, m) => Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);

  const splMean = mean(splValues);
  const infrasoundCount = freqValues.filter(f => f > 0 && f < 20).length;

  // Moda estatística
  const freqMap = {};
  let maxCount = 0, modeVal = 0;
  freqValues.forEach(v => {
    const r = Math.round(v);
    freqMap[r] = (freqMap[r] || 0) + 1;
    if (freqMap[r] > maxCount) { maxCount = freqMap[r]; modeVal = r; }
  });

  const freqBins = {};
  freqValues.forEach(f => {
    const bin = Math.floor(f / 50) * 50;
    freqBins[`${bin}-${bin + 50}`] = (freqBins[`${bin}-${bin + 50}`] || 0) + 1;
  });

  const sortedSpl = [...splValues].sort((a, b) => a - b);
  const spl_p95 = sortedSpl[Math.floor(sortedSpl.length * 0.95)] || -120;

  return {
    spl_min: Math.min(...splValues),
    spl_max: Math.max(...splValues),
    spl_mean: Math.round(splMean * 10) / 10,
    spl_std: Math.round(std(splValues, splMean) * 10) / 10,
    spl_p95: spl_p95,
    freq_dominant_mode: modeVal,
    freq_max: Math.max(...freqValues),
    infrasound_percent: Math.round(infrasoundCount / readings.length * 1000) / 10,
    infrasound_count: infrasoundCount,
    freq_histogram: freqBins,
    loud_events: splValues.filter(s => s > -30).length,
  };
}

/**
 * Cria pacote RedVox API 1000 JSON com estatísticas
 */
function buildRedVoxPacket(readings, deviceInfo, pressureAnomalies) {
  const uuid = deviceInfo?.uuid || localStorage.getItem('labmit_device_uuid') || 'unknown';

  const stats = computeStats(readings);

  return {
    api: 'labmit-1000',
    api_version: '4.0.0',
    station_information: {
      id: `LABMIT_${uuid.slice(0, 8).toUpperCase()}`,
      uuid: uuid,
      make: deviceInfo?.make || 'Desconhecido',
      model: deviceInfo?.model || 'Desconhecido',
      os: deviceInfo?.os || 'Desconhecido',
      os_version: deviceInfo?.osVersion || '',
      app_version: '4.0.0',
      screen: deviceInfo ? `${deviceInfo.screenWidth}x${deviceInfo.screenHeight}` : '',
      language: deviceInfo?.language || 'pt-BR',
      battery_level: deviceInfo?.batteryLevel ?? null,
      battery_charging: deviceInfo?.batteryCharging ?? null,
    },
    timing: {
      packet_start: readings.length > 0 ? new Date(readings[0].t).toISOString() : null,
      packet_end: readings.length > 0 ? new Date(readings[readings.length - 1].t).toISOString() : null,
      sample_count: readings.length,
      created_at: new Date().toISOString(),
    },
    sensors: {
      audio: {
        type: 'statistics',
        description: 'SPL e frequência dominante (não amostras raw)',
        sample_rate_hz: 2,
        spl_db: readings.map(r => r.spl),
        dominant_freq_hz: readings.map(r => r.freq),
        timestamps_ms: readings.map(r => r.t),
        stats: stats,
        redvox_compatible: true,
      },
      pressure: {
        available: pressureAnomalies && pressureAnomalies.length > 0,
        anomaly_count: pressureAnomalies ? pressureAnomalies.length : 0,
        anomalies: (pressureAnomalies || []).map(a => ({
          timestamp: a.timestamp,
          current_hpa: a.currentPressure,
          previous_hpa: a.previousPressure,
          delta_hpa: a.delta,
          direction: a.direction,
          pressure_window: a.pressureWindow || [],
        })),
      },
      location: {
        source: 'yr_geolocation',
        name: latestContext?.yrWeather?.locationName || null,
        latitude: latestContext?.yrWeather?.location?.lat ?? null,
        longitude: latestContext?.yrWeather?.location?.lon ?? null,
      },
    },
    environmental_context: {
      terrestrial: {
        source: 'yr.no',
        location: latestContext?.yrWeather?.locationName || null,
        storm_warning: latestContext?.yrWeather?.stormWarning || false,
        current_forecast: latestContext?.yrWeather?.forecast?.[0] ? {
          temp_c: latestContext.yrWeather.forecast[0].temp,
          pressure_hpa: latestContext.yrWeather.forecast[0].pressure,
          precipitation_mm: latestContext.yrWeather.forecast[0].precipitation,
          wind_speed_ms: latestContext.yrWeather.forecast[0].windSpeed,
          symbol: latestContext.yrWeather.forecast[0].symbol,
        } : null,
      },
      space: {
        source: 'noaa_swpc',
        kp_index: latestContext?.spaceWeather?.kpIndex?.value ?? null,
        solar_flare: latestContext?.spaceWeather?.flareClass?.classification ?? null,
        solar_flare_flux: latestContext?.spaceWeather?.flareClass?.flux ?? null,
      },
      storm_intelligence: latestContext?.stormIntelligence || null,
    },
    metadata: {
      labmit_version: '4.0.0',
      format: 'labmit-redvox-compatible-json',
      institution: 'UFSC - Depto de Física',
      data_policy: 'Dados anônimos para pesquisa científica',
    },
  };
}

/**
 * Envia o buffer para o Firebase Firestore com Authentication
 */
export async function flushBufferToCloud(deviceInfo, pressureAnomalies) {
  if (localBuffer.length === 0) return;

  const readings = [...localBuffer];
  localBuffer = [];
  localStorage.removeItem(LOCAL_KEY);
  lastFlush = Date.now();

  const authUid = await ensureAuth();

  let anomalies = pressureAnomalies;
  if (!anomalies) {
    try {
      const saved = localStorage.getItem(ANOMALY_KEY);
      anomalies = saved ? JSON.parse(saved) : [];
    } catch (e) { anomalies = []; }
  }

  const packet = buildRedVoxPacket(readings, deviceInfo, anomalies);

  packet._auth_uid = authUid || 'unauthenticated';
  packet._created_at = new Date().toISOString();
  if (readings.length > 0) {
    packet.timing.packet_start_ts = readings[0].t; // Adicionado para queries
  }

  if (db && authUid) {
    try {
      const { collection, addDoc, doc, setDoc, serverTimestamp } = await import('firebase/firestore');

      // 1. Envia pacote de dados
      await addDoc(collection(db, 'labmit_packets'), {
        ...packet,
        _server_timestamp: serverTimestamp(),
      });

      // 2. Atualiza perfil da estação
      const stationUuid = deviceInfo?.uuid || 'unknown';
      await setDoc(doc(db, 'labmit_stations', stationUuid), {
        uuid: stationUuid,
        id: packet.station_information.id,
        make: deviceInfo?.make || '',
        model: deviceInfo?.model || '',
        os: `${deviceInfo?.os || ''} ${deviceInfo?.osVersion || ''}`,
        last_seen: serverTimestamp(),
        _auth_uid: authUid,
        location_name: packet.environmental_context?.terrestrial?.location || '',
      }, { merge: true });

      // 3. Envia alertas sísmicos
      if (anomalies?.length > 0) {
        for (const anomaly of anomalies) {
          if (anomaly.delta >= 1.0) {
            await addDoc(collection(db, 'labmit_seismic_alerts'), {
              station_id: packet.station_information.id,
              station_uuid: stationUuid,
              timestamp: serverTimestamp(),
              delta_hpa: anomaly.delta,
              direction: anomaly.direction,
              location_name: packet.sensors?.location?.name || '',
              pressure_window: anomaly.pressureWindow || [],
              _auth_uid: authUid,
            });
          }
        }
      }

      console.log(`[LABMIT] ✅ Pacote enviado ao Firebase. ${readings.length} leituras.`);
      localStorage.removeItem(ANOMALY_KEY);
      return;
    } catch (err) {
      console.warn('[LABMIT] ⚠️ Falha no Firebase, salvando localmente:', err.message);
    }
  }

  // Fallback local
  try {
    const fallbackKey = `labmit_packet_${Date.now()}`;
    localStorage.setItem(fallbackKey, JSON.stringify(packet));
    console.log(`[LABMIT] 💾 Pacote salvo localmente: ${fallbackKey}`);
  } catch (e) {
    console.error('[LABMIT] ❌ Falha ao salvar pacote:', e);
    localBuffer = [...readings, ...localBuffer];
  }
}

export function savePressureAnomaly(anomaly) {
  try {
    const saved = localStorage.getItem(ANOMALY_KEY);
    const list = saved ? JSON.parse(saved) : [];
    list.push(anomaly);
    localStorage.setItem(ANOMALY_KEY, JSON.stringify(list.slice(-50)));
  } catch (e) {
    console.error('[DataStore] Erro ao salvar anomalia:', e);
  }
}

export function getLocalHistory() {
  return [...localBuffer];
}

export function clearHistory() {
  localBuffer = [];
  try { localStorage.removeItem(LOCAL_KEY); } catch (e) { /* */ }
}

export function exportCSV() {
  if (localBuffer.length === 0) return;
  const header = 'timestamp_iso,timestamp_ms,spl_db,dominant_freq_hz\n';
  const rows = localBuffer.map(r =>
    `${new Date(r.t).toISOString()},${r.t},${r.spl},${r.freq}`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LABMIT_infrassom_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportJSON(deviceInfo, pressureAnomalies) {
  if (localBuffer.length === 0) return;
  const packet = buildRedVoxPacket(localBuffer, deviceInfo, pressureAnomalies);
  const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `LABMIT_packet_${new Date().toISOString().slice(0, 16).replace(/:/g, '')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}




