// ============================================================
//  DataPanel.jsx — Histórico e estatísticas do Firebase
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useState, useMemo } from 'react';
import {
  Database, Trash2, RefreshCw, Download,
  CloudOff, Activity, Zap, AlertTriangle, ChevronDown, ChevronUp
} from 'lucide-react';
import { getLocalHistory, clearHistory, exportCSV, exportJSON } from '../store/dataStore';
import { useMyPackets, useSeismicAlerts, useMyStation } from '../hooks/useFirebaseData';

// ── mini formatadores ─────────────────────────────────────────────────────────
const fmt1 = v => (v != null && !isNaN(v)) ? Number(v).toFixed(1) : '---';
const fmtDate = iso => {
  if (!iso) return '---';
  try {
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso.slice(0, 16); }
};
const fmtDuration = ms => {
  if (!ms) return '---';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}m ${ss.toString().padStart(2, '0')}s`;
};

// ── Sparkline SVG (mini gráfico de linha) ─────────────────────────────────────
function Sparkline({ values, color = '#e5ff00', height = 36, width = 180 }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.85"
      />
      {/* área preenchida */}
      <polyline
        points={`0,${height} ${pts} ${width},${height}`}
        fill={color}
        opacity="0.08"
      />
    </svg>
  );
}

// ── Linha de pacote individual ────────────────────────────────────────────────
function PacketRow({ packet, onClick, selected }) {
  const st  = packet?.timing?.packet_start;
  const end = packet?.timing?.packet_end;
  const dur = st && end
    ? fmtDuration(new Date(end) - new Date(st))
    : '---';
  const stats   = packet?.sensors?.audio?.stats || {};
  const splVals = packet?.sensors?.audio?.spl_db?.slice(-40) || [];
  const riskLv  = packet?.environmental_context?.storm_intelligence?.riskLevel;
  const riskColor = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' }[riskLv] || '#666';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '8px 10px',
        borderRadius: 8,
        background: selected ? 'rgba(229,255,0,0.06)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${selected ? 'rgba(229,255,0,0.3)' : '#222'}`,
        cursor: 'pointer',
        marginBottom: 6,
        transition: 'all 0.15s',
      }}
    >
      {/* linha 1: data + duração + risco */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: '#88ccff', fontFamily: 'var(--font-mono)' }}>
          {fmtDate(st)}
        </span>
        <span style={{ fontSize: 10, color: '#666' }}>{dur}</span>
        {riskLv && (
          <span style={{
            fontSize: 9, padding: '1px 6px', borderRadius: 10,
            background: riskColor + '22', color: riskColor, fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.05em'
          }}>
            {riskLv}
          </span>
        )}
      </div>

      {/* linha 2: stats + sparkline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: '#888', marginBottom: 2 }}>
            SPL médio <span style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
              {fmt1(stats.spl_mean)} dB
            </span>
            {'  '}
            máx <span style={{ color: 'var(--danger)', fontFamily: 'var(--font-mono)' }}>
              {fmt1(stats.spl_max)} dB
            </span>
          </div>
          <div style={{ fontSize: 10, color: '#666' }}>
            Infrassom: <span style={{ color: '#a78bfa' }}>
              {stats.infrasound_percent ?? '---'} %
            </span>
            {'  '}{packet?.sensors?.audio?.sample_count ?? stats.infrasound_count + '+'} leituras
          </div>
        </div>
        <Sparkline values={splVals} color="#e5ff00" width={80} height={28} />
      </div>
    </div>
  );
}

// ── Detalhe expandido de um pacote ────────────────────────────────────────────
function PacketDetail({ packet }) {
  if (!packet) return null;
  const stats = packet?.sensors?.audio?.stats || {};
  const loc   = packet?.sensors?.location || {};
  const space = packet?.environmental_context?.space || {};
  const earth = packet?.environmental_context?.terrestrial || {};
  const si    = packet?.environmental_context?.storm_intelligence || {};
  const splVals = packet?.sensors?.audio?.spl_db || [];

  return (
    <div style={{
      background: '#0d0d1a', borderRadius: 10, padding: 14,
      border: '1px solid #2a2a3a', marginTop: 8
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 }}>
        {fmtDate(packet?.timing?.packet_start)} — {fmtDate(packet?.timing?.packet_end)}
      </div>

      {/* Sparkline grande */}
      {splVals.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: '#666', marginBottom: 4 }}>SPL ao longo da sessão:</div>
          <Sparkline values={splVals.slice(-200)} color="#e5ff00" width={300} height={50} />
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
        {[
          ['SPL mín', fmt1(stats.spl_min) + ' dB', '#22c55e'],
          ['SPL médio', fmt1(stats.spl_mean) + ' dB', '#e5ff00'],
          ['SPL máx', fmt1(stats.spl_max) + ' dB', '#ef4444'],
          ['Desvio-padrão', fmt1(stats.spl_std) + ' dB', '#888'],
          ['P95', fmt1(stats.spl_p95) + ' dB', '#f59e0b'],
          ['Infrassom', (stats.infrasound_percent ?? '---') + ' %', '#a78bfa'],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background: '#111', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 13, color, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{val}</div>
            <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Contexto */}
      <div style={{ fontSize: 10, color: '#666', lineHeight: 1.8 }}>
        {loc.name && <div>📍 {loc.name}</div>}
        {earth.storm_warning && <div style={{ color: '#f97316' }}>⚡ Alerta de tempestade ativo no momento</div>}
        {space.kp_index != null && <div>🌐 Kp = {space.kp_index}  |  Flare: {space.solar_flare || '---'}</div>}
        {si.riskLevel && (
          <div>🛡 Risco: <span style={{
            color: { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' }[si.riskLevel]
          }}>{si.riskLevel} ({si.riskScore}/100)</span>
            {si.message && ` — ${si.message}`}
          </div>
        )}
        <div style={{ marginTop: 4, color: '#444', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
          id: {packet.id}
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function DataPanel({ spl, isRecording, deviceInfo, pressureAnomalies }) {
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('cloud'); // 'cloud' | 'local' | 'alerts'

  // Firebase
  const { packets, loading, error, refresh } = useMyPackets(30);
  const { alerts, loading: loadingAlerts }   = useSeismicAlerts(20);
  const { station }                          = useMyStation();

  // Histórico local
  const localHistory = getLocalHistory();
  const localSPL = useMemo(() => localHistory.map(h => h.spl).filter(v => v > -120), [localHistory]);
  const localStats = useMemo(() => {
    if (localSPL.length === 0) return {};
    return {
      max: Math.max(...localSPL),
      min: Math.min(...localSPL),
      avg: localSPL.reduce((a, b) => a + b, 0) / localSPL.length,
    };
  }, [localSPL]);

  const selectedPacket = packets.find(p => p.id === selectedId) || null;

  const tabStyle = active => ({
    padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
    background: active ? 'rgba(229,255,0,0.12)' : 'transparent',
    color: active ? 'var(--accent)' : '#666',
    border: active ? '1px solid rgba(229,255,0,0.25)' : '1px solid transparent',
    transition: 'all 0.15s',
  });

  return (
    <div className="card">
      <div className="card-title">
        <Database size={14} className="card-title-icon" />
        Dados &amp; Histórico
        {station && (
          <span style={{ marginLeft: 8, fontSize: 9, color: '#555', fontFamily: 'var(--font-mono)' }}>
            [{station.id}]
          </span>
        )}
      </div>

      {/* Abas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <button style={tabStyle(tab === 'cloud')}  onClick={() => setTab('cloud')}>
          ☁️ Firebase ({packets.length})
        </button>
        <button style={tabStyle(tab === 'local')}  onClick={() => setTab('local')}>
          💾 Local ({localHistory.length})
        </button>
        <button style={tabStyle(tab === 'alerts')} onClick={() => setTab('alerts')}>
          <span style={{ color: alerts.length > 0 ? '#ef4444' : undefined }}>
            ⚡ Alertas ({alerts.length})
          </span>
        </button>
      </div>

      {/* ── ABA CLOUD ─────────────────────────────────────────────────────── */}
      {tab === 'cloud' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: '#555' }}>
              {loading ? 'Carregando…' : error ? `❌ ${error}` : `${packets.length} sessões no Firebase`}
            </span>
            <button
              onClick={refresh}
              style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', padding: 4 }}
              title="Atualizar"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', color: '#444', padding: '20px 0', fontSize: 12 }}>
              Buscando sessões…
            </div>
          )}

          {!loading && packets.length === 0 && !error && (
            <div style={{
              textAlign: 'center', color: '#444', padding: '20px 0', fontSize: 12,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8
            }}>
              <CloudOff size={28} color="#333" />
              Nenhuma sessão gravada ainda.
              <span style={{ fontSize: 10 }}>Grave e finalize uma sessão para ver aqui.</span>
            </div>
          )}

          <div style={{ maxHeight: 280, overflowY: 'auto', paddingRight: 2 }}>
            {packets.map(p => (
              <PacketRow
                key={p.id}
                packet={p}
                selected={selectedId === p.id}
                onClick={() => setSelectedId(selectedId === p.id ? null : p.id)}
              />
            ))}
          </div>

          {selectedPacket && <PacketDetail packet={selectedPacket} />}
        </div>
      )}

      {/* ── ABA LOCAL ─────────────────────────────────────────────────────── */}
      {tab === 'local' && (
        <div>
          <div className="stats-grid" style={{ marginBottom: 12 }}>
            <div className="stat-box">
              <div className="stat-val text-danger">{fmt1(localStats.max)}</div>
              <div className="stat-lbl">SPL máx (dB)</div>
            </div>
            <div className="stat-box">
              <div className="stat-val text-accent">{fmt1(localStats.avg)}</div>
              <div className="stat-lbl">SPL médio (dB)</div>
            </div>
            <div className="stat-box">
              <div className="stat-val text-ok">{fmt1(localStats.min)}</div>
              <div className="stat-lbl">SPL mín (dB)</div>
            </div>
          </div>

          {localSPL.length > 1 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, color: '#555', marginBottom: 4 }}>SPL — sessão atual:</div>
              <Sparkline values={localSPL.slice(-300)} color="#e5ff00" width={260} height={44} />
            </div>
          )}

          <div style={{ fontSize: 11, color: '#555', marginBottom: 12, fontFamily: 'var(--font-mono)' }}>
            {localHistory.length} leituras em buffer local
          </div>

          {/* Ações */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className="btn-sm"
              onClick={() => exportCSV()}
              disabled={localHistory.length === 0}
              style={{ color: '#22c55e', borderColor: 'rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.05)' }}
            >
              <Download size={11} style={{ marginRight: 4 }} />CSV
            </button>
            <button
              className="btn-sm"
              onClick={() => exportJSON(deviceInfo, pressureAnomalies)}
              disabled={localHistory.length === 0}
              style={{ color: '#88ccff', borderColor: 'rgba(136,204,255,0.3)', background: 'rgba(136,204,255,0.05)' }}
            >
              <Download size={11} style={{ marginRight: 4 }} />JSON
            </button>
            <button
              className="btn-sm"
              onClick={() => { if (confirm('Limpar buffer local?')) clearHistory(); }}
              disabled={localHistory.length === 0}
              style={{ color: 'var(--danger)', borderColor: 'rgba(244,71,71,0.3)', background: 'rgba(244,71,71,0.05)' }}
            >
              <Trash2 size={11} style={{ marginRight: 4 }} />Limpar
            </button>
          </div>
        </div>
      )}

      {/* ── ABA ALERTAS ───────────────────────────────────────────────────── */}
      {tab === 'alerts' && (
        <div>
          {loadingAlerts && (
            <div style={{ textAlign: 'center', color: '#444', padding: '20px 0', fontSize: 12 }}>
              Carregando alertas…
            </div>
          )}
          {!loadingAlerts && alerts.length === 0 && (
            <div style={{ textAlign: 'center', color: '#444', padding: '20px 0', fontSize: 12 }}>
              <Activity size={28} color="#333" style={{ marginBottom: 8 }} />
              <div>Nenhum alerta sísmico registrado.</div>
            </div>
          )}
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {alerts.map(alert => (
              <div key={alert.id} style={{
                padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                background: 'rgba(239,68,68,0.06)',
                border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>
                    <AlertTriangle size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                    Δ {fmt1(alert.delta_hpa)} hPa {alert.direction === 'drop' ? '↓ queda' : '↑ subida'}
                  </span>
                  <span style={{ fontSize: 10, color: '#555' }}>
                    {alert.timestamp?.toDate ? fmtDate(alert.timestamp.toDate().toISOString()) : '---'}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: '#666' }}>
                  Estação: {alert.station_id || '---'}
                  {alert.location_name && ` · ${alert.location_name}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="separator" />
      <div style={{ fontSize: 10, color: '#333', lineHeight: 1.7 }}>
        🔵 Firebase: <span style={{ color: '#555' }}>labmit_packets</span>
        {'  ·  '}
        💾 Local: <span style={{ color: '#555' }}>localStorage</span>
        {'  ·  '}
        📡 Coleta: 500 ms
      </div>
    </div>
  );
}
