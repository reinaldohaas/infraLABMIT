import React, { useEffect, useRef } from 'react';
import { Shield } from 'lucide-react';

const LEVEL_CONFIG = {
  low: {
    bg: '#0a2e0a',
    border: '#1a4a1a',
    icon: '#22c55e',
    label: 'Baixo',
  },
  medium: {
    bg: '#2e2a0a',
    border: '#4a4420',
    icon: 'var(--warning, #ffaa00)',
    label: 'Médio',
  },
  high: {
    bg: '#2e1a0a',
    border: '#4a3018',
    icon: '#ff8800',
    label: 'Alto',
  },
  critical: {
    bg: '#2e0a0a',
    border: 'var(--danger, #ff3333)',
    icon: 'var(--danger, #ff3333)',
    label: 'Crítico',
  },
};

const PULSE_KEYFRAMES = `
@keyframes stormAlertPulse {
  0%, 100% { box-shadow: 0 0 4px rgba(255,51,51,0.3); }
  50% { box-shadow: 0 0 14px rgba(255,51,51,0.7); }
}
`;

export default function StormAlert({
  riskScore = 0,
  riskLevel = 'low',
  message = '',
  suggestion = '',
  factors = [],
}) {
  const styleInjected = useRef(false);

  useEffect(() => {
    if (styleInjected.current) return;
    const style = document.createElement('style');
    style.textContent = PULSE_KEYFRAMES;
    document.head.appendChild(style);
    styleInjected.current = true;
  }, []);

  const config = LEVEL_CONFIG[riskLevel] || LEVEL_CONFIG.low;
  const isCritical = riskLevel === 'critical';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '10px 12px',
        background: config.bg,
        border: `1px solid ${config.border}`,
        borderRadius: 8,
        fontFamily: 'var(--font-mono, monospace)',
        color: 'var(--text-primary, #fff)',
        flexShrink: 0,
        ...(isCritical
          ? { animation: 'stormAlertPulse 2s ease-in-out infinite' }
          : {}),
      }}
    >
      {/* Ícone */}
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        <Shield size={20} color={config.icon} />
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Cabeçalho com nível */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: message ? 2 : 0,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: config.icon,
            }}
          >
            Risco {config.label}
          </span>
          <span
            style={{
              fontSize: 10,
              color: 'var(--text-muted, #666)',
            }}
          >
            ({riskScore}%)
          </span>
        </div>

        {/* Mensagem principal */}
        {message && (
          <div style={{ fontSize: 13, lineHeight: 1.4, marginBottom: suggestion ? 4 : 0 }}>
            {message}
          </div>
        )}

        {/* Sugestão */}
        {suggestion && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary, #a0a0a0)',
              lineHeight: 1.3,
            }}
          >
            {suggestion}
          </div>
        )}

        {/* Fatores */}
        {factors.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              marginTop: 6,
            }}
          >
            {factors.map((factor, i) => (
              <span
                key={i}
                style={{
                  fontSize: 9,
                  padding: '2px 6px',
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--text-secondary, #a0a0a0)',
                  whiteSpace: 'nowrap',
                }}
              >
                {factor}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
