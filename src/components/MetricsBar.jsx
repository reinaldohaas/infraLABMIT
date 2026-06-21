import React from 'react';
import { Activity, Gauge } from 'lucide-react';

function getSplColor(spl) {
  if (spl < -60) return '#22c55e';
  if (spl < -40) return 'var(--warning, #ffaa00)';
  return 'var(--danger, #ff3333)';
}

export default function MetricsBar({
  spl = -120,
  dominantFreq = 0,
  gain = 1.0,
  isRecording,
  sampleRate,
  pressure = null,
  pressureAvailable = null,
  pressureAnomaly = null,
}) {
  const splColor = getSplColor(spl);
  const isInfrasound = dominantFreq > 0 && dominantFreq < 20;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        background: 'var(--bg-card, #111)',
        borderTop: '1px solid var(--border, #333)',
        borderBottom: '1px solid var(--border, #333)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 11,
        color: 'var(--text-primary, #fff)',
        gap: 6,
        flexShrink: 0,
        flexWrap: 'wrap',
        minHeight: 36,
      }}
    >
      {/* SPL */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Activity size={12} color={splColor} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 9 }}>SPL</span>
        <span style={{ color: splColor, fontWeight: 700, fontSize: 13 }}>
          {spl.toFixed(1)}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>dB</span>
      </div>

      {/* Frequência */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 9 }}>Freq</span>
        <span style={{ fontWeight: 600 }}>
          {dominantFreq > 0 ? dominantFreq.toFixed(0) : '—'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>Hz</span>
        {isInfrasound && (
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
            padding: '1px 4px', borderRadius: 3,
            background: 'var(--danger)', color: '#fff',
          }}>INFRA</span>
        )}
      </div>

      {/* Pressão Barométrica */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Gauge size={11} color={pressureAnomaly ? '#ff3333' : '#888'} />
        <span style={{ color: 'var(--text-secondary)', fontSize: 9 }}>hPa</span>
        {pressureAvailable === false ? (
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>—</span>
        ) : pressure != null ? (
          <span style={{
            fontWeight: 600,
            color: pressureAnomaly ? '#ff3333' : '#fff',
            animation: pressureAnomaly ? 'pulse-dot 0.5s infinite' : 'none',
          }}>
            {pressure.toFixed(1)}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>...</span>
        )}
        {pressureAnomaly && (
          <span style={{
            fontSize: 7, fontWeight: 700,
            padding: '1px 4px', borderRadius: 3,
            background: '#ff3333', color: '#fff',
          }}>SISMO</span>
        )}
      </div>

      {/* Taxa */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 9 }}>Taxa</span>
        <span style={{ fontWeight: 600 }}>
          {sampleRate >= 1000 ? `${(sampleRate/1000).toFixed(0)}k` : sampleRate}
        </span>
      </div>
    </div>
  );
}
