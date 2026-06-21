// ============================================================
//  AlertPanel.jsx — Painel de alertas e configuração de limites
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useState, useEffect, useRef } from 'react';
import { BellRing, Settings } from 'lucide-react';

const ALERT_AUDIO_FREQ = 880;
const DEFAULT_THRESHOLDS = { attention: -60, danger: -40 };

function playBeep(freq = ALERT_AUDIO_FREQ, duration = 0.2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(); osc.stop(ctx.currentTime + duration);
  } catch { /* sem suporte a áudio */ }
}

export default function AlertPanel({ spl = -120, isRecording, onThresholdsChange }) {
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS);
  const [history, setHistory] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const lastLevelRef = useRef('normal');

  const getLevel = (spl) => {
    if (!isRecording || spl <= -120) return 'normal';
    if (spl >= thresholds.danger) return 'danger';
    if (spl >= thresholds.attention) return 'attention';
    return 'normal';
  };

  const level = getLevel(spl);

  // Detecta mudança de nível e registra evento
  useEffect(() => {
    if (level === lastLevelRef.current) return;
    lastLevelRef.current = level;

    if (level === 'attention') {
      playBeep(660, 0.15);
      setHistory(h => [{
        time: new Date().toLocaleTimeString('pt-BR'),
        label: `⚠ Atenção — SPL ${spl.toFixed(1)} dB`,
        level: 'attention'
      }, ...h].slice(0, 20));
    } else if (level === 'danger') {
      playBeep(1200, 0.3);
      setHistory(h => [{
        time: new Date().toLocaleTimeString('pt-BR'),
        label: `⛔ ALERTA — SPL ${spl.toFixed(1)} dB`,
        level: 'danger'
      }, ...h].slice(0, 20));
    } else if (lastLevelRef.current !== 'normal') {
      setHistory(h => [{
        time: new Date().toLocaleTimeString('pt-BR'),
        label: `✓ Normalizado — SPL ${spl.toFixed(1)} dB`,
        level: 'normal'
      }, ...h].slice(0, 20));
    }
  }, [level]);

  const updateThresholds = (key, val) => {
    const next = { ...thresholds, [key]: parseFloat(val) };
    setThresholds(next);
    onThresholdsChange?.(next);
  };

  const LEVELS = {
    normal:    { icon: '🟢', title: 'NORMAL',  desc: 'Nível de infrassom dentro dos parâmetros', color: 'var(--ok)' },
    attention: { icon: '🟡', title: 'ATENÇÃO',  desc: `SPL acima de ${thresholds.attention} dB — monitorar`, color: 'var(--warn)' },
    danger:    { icon: '🔴', title: 'ALERTA',   desc: `SPL acima de ${thresholds.danger} dB — evento crítico!`, color: 'var(--danger)' },
  };

  const cfg = LEVELS[level];

  return (
    <div className="card">
      <div className="card-title flex-between">
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <BellRing size={14} className="card-title-icon" />
          Painel de Alertas
        </span>
        <button
          id="btn-alert-settings"
          className="btn-sm"
          onClick={() => setShowSettings(s => !s)}
          title="Configurar limites"
          style={{ padding: '3px 10px' }}
        >
          <Settings size={11} style={{ marginRight: 4 }} />
          Limites
        </button>
      </div>

      {/* Nível atual */}
      {['normal', 'attention', 'danger'].map(l => (
        <div key={l} className={`alert-level ${l === level ? l : ''}`}
          style={{ opacity: l === level ? 1 : 0.35, marginBottom: 8 }}>
          <span className="alert-icon">{LEVELS[l].icon}</span>
          <div>
            <div className="alert-text-title" style={{ color: l === level ? cfg.color : 'inherit' }}>
              {LEVELS[l].title}
            </div>
            <div className="alert-text-desc">{LEVELS[l].desc}</div>
          </div>
        </div>
      ))}

      {/* Configuração de limites */}
      {showSettings && (
        <div className="threshold-controls" style={{ padding: '10px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>LIMITES DE ALERTA (dB)</div>
          <div className="threshold-row">
            <span className="threshold-label text-warn">⚠ Atenção:</span>
            <input
              id="threshold-attention"
              type="number" min="-100" max="-10" step="1"
              className="threshold-input"
              value={thresholds.attention}
              onChange={e => updateThresholds('attention', e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>dB</span>
          </div>
          <div className="threshold-row">
            <span className="threshold-label text-danger">⛔ Alerta:</span>
            <input
              id="threshold-danger"
              type="number" min="-100" max="-10" step="1"
              className="threshold-input"
              value={thresholds.danger}
              onChange={e => updateThresholds('danger', e.target.value)}
            />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>dB</span>
          </div>
        </div>
      )}

      {/* Histórico de eventos */}
      {history.length > 0 && (
        <div className="alert-history">
          <div className="alert-history-title">Histórico de Eventos</div>
          {history.slice(0, 8).map((evt, i) => (
            <div key={i} className="alert-event" style={{
              color: evt.level === 'danger' ? 'var(--danger)'
                   : evt.level === 'attention' ? 'var(--warn)'
                   : 'var(--text-muted)'
            }}>
              <span style={{ opacity: 0.6 }}>{evt.time}</span>{'  '}{evt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
