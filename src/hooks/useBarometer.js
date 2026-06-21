// ============================================================
//  useBarometer.js — Sensor de pressão barométrica
//  Detecta anomalias sísmicas (quedas rápidas de pressão)
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';

// Janela de detecção de anomalias
const HISTORY_SIZE = 60;       // Últimos 60 registros (~60s a 1Hz)
const ANOMALY_THRESHOLD = 1.5; // hPa de variação rápida em 10s = anomalia sísmica
const ANOMALY_WINDOW = 10;     // Compara com leitura de 10s atrás

export function useBarometer() {
  const [pressure, setPressure] = useState(null);          // hPa atual
  const [available, setAvailable] = useState(null);        // null=checking, true/false
  const [anomaly, setAnomaly] = useState(null);            // { delta, timestamp, pressure }
  const [anomalyLog, setAnomalyLog] = useState([]);        // Histórico de anomalias
  const historyRef = useRef([]);                            // Últimas leituras
  const sensorRef = useRef(null);

  // Tenta iniciar o sensor de pressão
  useEffect(() => {
    let sensor = null;
    let fallbackInterval = null;

    // Estratégia 1: Generic Sensor API (Barometer)
    if ('Barometer' in window) {
      try {
        sensor = new window.Barometer({ frequency: 1 }); // 1 Hz
        sensor.addEventListener('reading', () => {
          const hPa = sensor.pressure; // em hPa
          if (hPa && hPa > 0) {
            updatePressure(hPa);
          }
        });
        sensor.addEventListener('error', (e) => {
          console.warn('[Barometer] Sensor error:', e.error.message);
          setAvailable(false);
        });
        sensor.start();
        sensorRef.current = sensor;
        setAvailable(true);
        return;
      } catch (e) {
        console.warn('[Barometer] Generic Sensor API falhou:', e.message);
      }
    }

    // Estratégia 2: AmbientPressureSensor (Chrome experimental)
    if ('AmbientPressureSensor' in window) {
      try {
        sensor = new window.AmbientPressureSensor({ frequency: 1 });
        sensor.addEventListener('reading', () => {
          if (sensor.pressure > 0) updatePressure(sensor.pressure);
        });
        sensor.addEventListener('error', () => setAvailable(false));
        sensor.start();
        sensorRef.current = sensor;
        setAvailable(true);
        return;
      } catch (e) {
        console.warn('[Barometer] AmbientPressureSensor falhou:', e.message);
      }
    }

    // Estratégia 3: Sensor web genérico via navigator.sensors
    // (fallback para dispositivos Android com Capacitor)
    // Infelizmente a maioria dos WebViews não expõe o barômetro.
    // Marcar como indisponível mas sem travar o app.
    setAvailable(false);
    console.info('[Barometer] Nenhum sensor de pressão disponível neste dispositivo.');

    return () => {
      if (sensor) {
        try { sensor.stop(); } catch (e) { /* */ }
      }
      if (fallbackInterval) clearInterval(fallbackInterval);
    };
  }, []);

  // Processa nova leitura de pressão
  const updatePressure = useCallback((hPa) => {
    const now = Date.now();
    const entry = { pressure: hPa, timestamp: now };

    setPressure(hPa);

    // Adiciona ao histórico
    const history = historyRef.current;
    history.push(entry);
    if (history.length > HISTORY_SIZE) history.shift();

    // Detecção de anomalia sísmica
    // Compara com leitura de ANOMALY_WINDOW segundos atrás
    const oldIdx = history.findIndex(h => now - h.timestamp >= ANOMALY_WINDOW * 1000);
    if (oldIdx >= 0) {
      const oldPressure = history[oldIdx].pressure;
      const delta = Math.abs(hPa - oldPressure);

      if (delta >= ANOMALY_THRESHOLD) {
        const anomalyEntry = {
          timestamp: new Date(now).toISOString(),
          currentPressure: hPa,
          previousPressure: oldPressure,
          delta: Math.round(delta * 100) / 100,
          direction: hPa < oldPressure ? 'queda' : 'subida',
          // Salva trecho do histórico de pressão (dados raw para "terremotos")
          pressureWindow: history.map(h => ({
            t: h.timestamp,
            p: Math.round(h.pressure * 100) / 100,
          })),
        };

        setAnomaly(anomalyEntry);
        setAnomalyLog(prev => [...prev.slice(-19), anomalyEntry]); // Máximo 20
        console.warn('[Barometer] ANOMALIA SÍSMICA DETECTADA:', anomalyEntry);
      } else if (delta < ANOMALY_THRESHOLD * 0.5) {
        // Limpa anomalia quando estabiliza
        setAnomaly(null);
      }
    }
  }, []);

  return {
    pressure,             // Pressão atual em hPa (null se indisponível)
    available,            // true/false/null(verificando)
    anomaly,              // Anomalia sísmica atual (null se normal)
    anomalyLog,           // Histórico de anomalias para salvar
    pressureHistory: historyRef.current, // Últimas 60 leituras
  };
}
