// ============================================================
//  useDeviceInfo.js — Identificação do dispositivo e metadados
//  Gera UUID persistente e coleta informações de hardware
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useState, useEffect } from 'react';

const UUID_KEY = 'labmit_device_uuid';
const INFO_KEY = 'labmit_device_info';

// Gera UUID v4 simples
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Extrai make/model do User Agent (heurística)
function parseDevice(ua) {
  let make = 'Desconhecido';
  let model = 'Desconhecido';
  let os = 'Desconhecido';
  let osVersion = '';

  // Android
  const androidMatch = ua.match(/Android\s([\d.]+)/);
  if (androidMatch) {
    os = 'Android';
    osVersion = androidMatch[1];
    // Tenta extrair modelo: "Build/XX" ou "; Model" pattern
    const modelMatch = ua.match(/;\s*([^;)]+)\s*Build/);
    if (modelMatch) {
      const parts = modelMatch[1].trim().split(/\s+/);
      // Primeiro token geralmente é o fabricante
      if (parts.length > 1) {
        make = parts[0];
        model = parts.slice(1).join(' ');
      } else {
        model = parts[0];
      }
    }
  }

  // iOS
  const iosMatch = ua.match(/iPhone|iPad/);
  if (iosMatch) {
    make = 'Apple';
    model = iosMatch[0];
    os = 'iOS';
    const vMatch = ua.match(/OS\s([\d_]+)/);
    if (vMatch) osVersion = vMatch[1].replace(/_/g, '.');
  }

  return { make, model, os, osVersion };
}

export function useDeviceInfo() {
  const [deviceInfo, setDeviceInfo] = useState(() => {
    // Tenta carregar do cache
    try {
      const saved = localStorage.getItem(INFO_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignora */ }
    return null;
  });

  useEffect(() => {
    // UUID persistente
    let uuid = localStorage.getItem(UUID_KEY);
    if (!uuid) {
      uuid = generateUUID();
      localStorage.setItem(UUID_KEY, uuid);
    }

    // Metadados do dispositivo
    const ua = navigator.userAgent;
    const { make, model, os, osVersion } = parseDevice(ua);

    const info = {
      uuid,
      make,
      model,
      os,
      osVersion,
      appVersion: '4.0.0',
      userAgent: ua,
      screenWidth: window.screen?.width || 0,
      screenHeight: window.screen?.height || 0,
      language: navigator.language || 'pt-BR',
      timestamp: new Date().toISOString(),
    };

    // Bateria (assíncrona)
    if (navigator.getBattery) {
      navigator.getBattery().then(battery => {
        info.batteryLevel = Math.round(battery.level * 100);
        info.batteryCharging = battery.charging;
        setDeviceInfo({ ...info });
        try { localStorage.setItem(INFO_KEY, JSON.stringify(info)); } catch (e) { /* */ }
      }).catch(() => {
        setDeviceInfo(info);
        try { localStorage.setItem(INFO_KEY, JSON.stringify(info)); } catch (e) { /* */ }
      });
    } else {
      setDeviceInfo(info);
      try { localStorage.setItem(INFO_KEY, JSON.stringify(info)); } catch (e) { /* */ }
    }
  }, []);

  return deviceInfo;
}
