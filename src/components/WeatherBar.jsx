import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const WEATHER_SYMBOLS = {
  clearsky: '☀',
  fair: '🌤',
  partlycloudy: '⛅',
  cloudy: '☁',
  rain: '🌧',
  heavyrain: '🌧',
  lightrainshowers: '🌦',
  rainshowers: '🌦',
  thunder: '⛈',
  snow: '❄',
  sleet: '🌨',
  fog: '🌫',
};

function getWeatherSymbol(code) {
  if (!code) return '🌡';
  const base = code.replace(/_day|_night|_polartwilight/g, '');
  return WEATHER_SYMBOLS[base] || '🌡';
}

function isFlareHigh(classification) {
  if (!classification) return false;
  const first = classification.charAt(0).toUpperCase();
  return first === 'M' || first === 'X';
}

export default function WeatherBar({ yr, spaceWeather, expanded, onToggle }) {
  const forecast = yr?.forecast?.[0];
  const temp = forecast?.data?.instant?.details?.air_temperature;
  const symbolCode = forecast?.data?.next_1_hours?.summary?.symbol_code
    || forecast?.data?.next_6_hours?.summary?.symbol_code;
  const locationName = yr?.locationName || '';

  const kpValue = spaceWeather?.kpIndex?.value;
  const kpHigh = typeof kpValue === 'number' && kpValue >= 5;

  const flareClass = spaceWeather?.flareClass?.classification;
  const flareHigh = isFlareHigh(flareClass);

  const loading = yr?.loading || spaceWeather?.loading;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: 36,
        padding: '0 12px',
        background: 'var(--bg-card, #111)',
        borderBottom: '1px solid var(--border, #333)',
        fontSize: 12,
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--text-primary, #fff)',
        gap: 14,
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* Clima local */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        <span style={{ fontSize: 14 }}>{getWeatherSymbol(symbolCode)}</span>
        <span style={{ fontWeight: 600 }}>
          {temp != null ? `${Math.round(temp)}°C` : '—°C'}
        </span>
        {locationName && (
          <span
            style={{
              color: 'var(--text-secondary, #a0a0a0)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 90,
            }}
          >
            {locationName}
          </span>
        )}
      </div>

      {/* Separador */}
      <div
        style={{
          width: 1,
          height: 16,
          background: 'var(--border, #333)',
          flexShrink: 0,
        }}
      />

      {/* Índice Kp */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--text-muted, #666)', fontSize: 11 }}>Kp:</span>
        <span
          style={{
            fontWeight: 700,
            color: kpHigh ? 'var(--danger, #ff3333)' : 'var(--text-primary, #fff)',
          }}
        >
          {kpValue != null ? kpValue : '—'}
        </span>
      </div>

      {/* Classe de flare */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--text-muted, #666)', fontSize: 11 }}>Flare:</span>
        <span
          style={{
            fontWeight: 700,
            color: flareHigh ? 'var(--danger, #ff3333)' : 'var(--text-primary, #fff)',
          }}
        >
          {flareClass || '—'}
        </span>
      </div>

      {/* Espaço flexível */}
      <div style={{ flex: 1 }} />

      {/* Carregando */}
      {loading && (
        <span style={{ color: 'var(--text-muted, #666)', fontSize: 10 }}>
          carregando…
        </span>
      )}

      {/* Botão expandir */}
      <button
        onClick={onToggle}
        aria-label={expanded ? 'Recolher clima' : 'Expandir clima'}
        style={{
          background: 'none',
          border: 'none',
          padding: 2,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          color: 'var(--text-secondary, #a0a0a0)',
          flexShrink: 0,
        }}
      >
        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
    </div>
  );
}
