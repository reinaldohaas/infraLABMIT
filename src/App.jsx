// ============================================================
//  App.jsx — LABMIT Frankenstein Monitor
//  RedVox (Espectrograma) + Yr (Clima Terrestre) + NOAA (Espacial)
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useState, useEffect } from 'react';
import { useAudioCapture } from './hooks/useAudioCapture';
import { useYr } from './hooks/useYr';
import { useSpaceWeather } from './hooks/useSpaceWeather';
import { usePatternDetector } from './hooks/usePatternDetector';
import { useStormIntelligence } from './hooks/useStormIntelligence';
import { useDeviceInfo } from './hooks/useDeviceInfo';
import { useBarometer } from './hooks/useBarometer';
import { recordReading, savePressureAnomaly, flushBufferToCloud, exportJSON } from './store/dataStore';
import { db, ensureAuth } from './firebase';

import LiveSpectrogram from './components/LiveSpectrogram';
import MetricsBar from './components/MetricsBar';
import WeatherBar from './components/WeatherBar';
import StormAlert from './components/StormAlert';
import WeatherForecast from './components/WeatherForecast';
import AlertPanel from './components/AlertPanel';
import DataPanel from './components/DataPanel';
import Onboarding from './components/Onboarding';
import EventReporter from './components/EventReporter';

import { Mic, Square, ChevronDown, ChevronUp, CloudLightning, Cloud, Database, Settings, BellRing } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './index.css';

const RECORD_INTERVAL_MS = 500;

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export default function App() {
  const [tutorialCompleted, setTutorialCompleted] = useState(
    () => localStorage.getItem('labmit_tutorial_completed') === 'true'
  );
  const [elapsed, setElapsed] = useState(0);
  const [targetSampleRate] = useState(8000);

  // Seções colapsáveis e abas centrais
  const [activeTab, setActiveTab] = useState('infrasound'); // 'infrasound', 'weather', 'space'
  const [maxFreqLimit, setMaxFreqLimit] = useState(100); // 100, 200, 500 Hz
  const [showAlerts, setShowAlerts] = useState(false);
  const [showData, setShowData] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Hooks de dados
  const audio = useAudioCapture({ targetSampleRate, autoStart: tutorialCompleted });
  const yr = useYr();
  const spaceWeather = useSpaceWeather();
  const deviceInfo = useDeviceInfo();
  const barometer = useBarometer();
  const { patterns } = usePatternDetector({ fftData: audio.fftData, isRecording: audio.isRecording });
  const storm = useStormIntelligence({
    yr,
    spaceWeather,
    spl: audio.spl,
    dominantFreq: audio.dominantFreq,
    isRecording: audio.isRecording,
  });

  // Timer
  useEffect(() => {
    if (!audio.isRecording) { setElapsed(0); return; }
    const interval = setInterval(() => {
      setElapsed(e => {
        const next = e + 1;
        if (next >= 1800) { // 30 minutos = 1800 segundos
          audio.stopRecording();
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [audio.isRecording, audio]);

  // Persiste leituras e cruza dados (Frankenstein)
  useEffect(() => {
    if (!audio.isRecording) return;
    const interval = setInterval(() => {
      recordReading({
        spl: audio.spl,
        dominantFreq: audio.dominantFreq,
        envContext: { yrWeather: yr, spaceWeather, stormIntelligence: storm },
      });
    }, RECORD_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [audio.isRecording, audio.spl, audio.dominantFreq, yr, spaceWeather, storm]);

  // Salva anomalias de pressão (terremotos)
  useEffect(() => {
    if (barometer.anomaly) {
      savePressureAnomaly(barometer.anomaly);
    }
  }, [barometer.anomaly]);

  // Heartbeat: atualiza last_seen a cada 5 min
  useEffect(() => {
    if (!audio.isRecording || !deviceInfo?.uuid) return;

    const sendHeartbeat = async () => {
      const authUid = await ensureAuth();
      if (!db || !authUid) return;

      try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        await setDoc(doc(db, 'labmit_stations', deviceInfo.uuid), {
          uuid: deviceInfo.uuid,
          id: `LABMIT_${deviceInfo.uuid.slice(0, 8).toUpperCase()}`,
          last_seen: serverTimestamp(),
          status: 'online',
          battery_level: deviceInfo.batteryLevel ?? null,
          is_recording: true,
          _auth_uid: authUid,
        }, { merge: true });
      } catch (e) {
        console.warn('[Heartbeat] Falha:', e.message);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [audio.isRecording, deviceInfo]);

  // Flush ao reconectar
  useEffect(() => {
    const handleOnline = async () => {
      console.log('[LABMIT] Reconectado — enviando dados pendentes');
      const keys = Object.keys(localStorage).filter(k => k.startsWith('labmit_packet_'));

      for (const key of keys) {
        try {
          const packet = JSON.parse(localStorage.getItem(key));
          const { collection, addDoc } = await import('firebase/firestore');
          if (db) {
            await addDoc(collection(db, 'labmit_packets'), packet);
            localStorage.removeItem(key);
            console.log(`[LABMIT] Pacote pendente enviado: ${key}`);
          }
        } catch (e) {
          console.warn(`[LABMIT] Falha ao reenviar ${key}:`, e.message);
          break;
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Onboarding (primeiro uso)
  if (!tutorialCompleted) {
    return (
      <Onboarding onComplete={() => setTutorialCompleted(true)} />
    );
  }

  return (
    <div className="app-root">
      {/* ─── Header ─── */}
      <header className="app-header">
        <div className="logo">
          LABMIT <span>UFSC Física</span>
        </div>
        <div className="header-right">
          {audio.isRecording ? (
            <>
              <div className="rec-indicator">
                <div className="rec-dot" />
                {formatTime(elapsed)}
              </div>
              <button className="btn-stop" onClick={audio.stopRecording}>
                <Square size={10} style={{ marginRight: 4 }} /> PARAR
              </button>
            </>
          ) : (
            <button className="btn-record" onClick={audio.startRecording}>
              <Mic size={14} /> GRAVAR
            </button>
          )}
        </div>
      </header>

      {/* ─── Topo Fixo (Ergonomia) ─── */}
      <div className="sticky-top">
        {/* Métricas */}
        <MetricsBar
          spl={audio.spl}
          dominantFreq={audio.dominantFreq}
          gain={audio.gain}
          isRecording={audio.isRecording}
          sampleRate={audio.sampleRate}
          pressure={barometer.pressure}
          pressureAvailable={barometer.available}
          pressureAnomaly={barometer.anomaly}
        />

        {/* Clima unificado */}
        <WeatherBar
          yr={yr}
          spaceWeather={spaceWeather}
          expanded={activeTab !== 'infrasound'}
          onToggle={() => setActiveTab(t => t === 'infrasound' ? 'weather' : 'infrasound')}
        />

        {/* Alerta IA */}
        <StormAlert
          riskScore={storm.riskScore}
          riskLevel={storm.riskLevel}
          message={storm.message}
          suggestion={storm.suggestion}
          factors={storm.factors}
        />
      </div>

      {/* ─── Seleção de Visualização Central (Tabs) ─── */}
      <div style={{ display: 'flex', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', zIndex: 5 }}>
        {[
          { id: 'infrasound', label: '🔊 Infrassom' },
          { id: 'weather', label: '🌦 Clima Yr' },
          { id: 'space', label: '🌌 Espacial' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '12px 8px',
              background: activeTab === tab.id ? 'var(--bg-input)' : 'transparent',
              color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
              border: 'none',
              fontSize: '12px',
              fontWeight: 'bold',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : 'none',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── Frame Central Interativo ─── */}
      <div className="central-frame" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#000', overflow: 'hidden', minHeight: '280px', position: 'relative' }}>
        
        {activeTab === 'infrasound' && (
          <>
            {/* Controles de Zoom no Espectrograma */}
            <div style={{ flex: 1 }}>
              <LiveSpectrogram
                fftData={audio.fftData}
                isRecording={audio.isRecording}
                patterns={patterns}
                maxFreqLimit={maxFreqLimit}
              />
            </div>
          </>
        )}

        {activeTab === 'weather' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            <WeatherForecast
              forecast={yr.forecast}
              locationName={yr.locationName}
              loading={yr.loading}
              error={yr.error}
              stormWarning={yr.stormWarning}
              location={yr.location}
              onRefresh={yr.refresh}
              visible={true}
            />
          </div>
        )}

        {activeTab === 'space' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: 'var(--accent)' }}>Condições de Clima Espacial (NOAA)</h4>
            {spaceWeather.loading && <div className="loading-spinner"><div className="spinner" /> Conectando SWPC...</div>}
            {spaceWeather.error && <div className="error-msg">{spaceWeather.error}</div>}
            {!spaceWeather.loading && !spaceWeather.error && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Índice Kp Geomagnético</div>
                  <div className="value-display" style={{ fontSize: 28, color: (spaceWeather.kpIndex?.value ?? 0) >= 5 ? 'var(--danger)' : 'var(--accent)' }}>
                    {spaceWeather.kpIndex?.value ?? '--'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                    {(spaceWeather.kpIndex?.value ?? 0) >= 5 ? 'Alerta: Aurora/Tempestade Ativa' : 'Condições Estáveis'}
                  </div>
                </div>
                <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 6, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>Classe Flare Solar</div>
                  <div className="value-display" style={{ fontSize: 28, color: ['M', 'X'].includes(spaceWeather.flareClass?.classification) ? 'var(--danger)' : 'var(--accent)' }}>
                    {spaceWeather.flareClass?.classification ?? '--'}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 4 }}>
                    Emissão Raio-X do Sol
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Painel Inferior (scrollável) ─── */}
      <div className="bottom-panel" style={{ flexShrink: 0 }}>
        {/* Relatar Evento */}
        <EventReporter deviceInfo={deviceInfo} location={yr?.locationName} />

        {/* ─── Seções Colapsáveis Remanescentes ─── */}

        {/* Alertas */}
        <div className="expand-section">
          <div className="expand-header" onClick={() => setShowAlerts(a => !a)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <BellRing size={13} /> Alertas e Limites
            </span>
            {showAlerts ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          {showAlerts && (
            <div className="expand-body">
              <AlertPanel spl={audio.spl} isRecording={audio.isRecording} />
            </div>
          )}
        </div>

        {/* Dados da Sessão */}
        <div className="expand-section">
          <div className="expand-header" onClick={() => setShowData(d => !d)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Database size={13} /> Dados da Sessão
            </span>
            {showData ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          {showData && (
            <div className="expand-body">
              <DataPanel spl={audio.spl} isRecording={audio.isRecording} />
            </div>
          )}
        </div>

        {/* Configurações */}
        <div className="expand-section">
          <div className="expand-header" onClick={() => setShowSettings(s => !s)}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Settings size={13} /> Hardware e Transmissão
            </span>
            {showSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
          {showSettings && (
            <div className="expand-body">
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                <div>📱 ID: <span className="text-mono text-accent">{deviceInfo?.uuid?.slice(0,8) || '...'}</span></div>
                <div>📱 Device: <span className="text-mono text-accent">{deviceInfo?.make} {deviceInfo?.model}</span></div>
                <div>🎙 Taxa: <span className="text-mono text-accent">{audio.sampleRate} Hz</span></div>
                <div>🌡 Barômetro: <span className="text-mono text-accent">{barometer.available ? `${barometer.pressure?.toFixed(1) || '...'} hPa` : 'Indisponível'}</span></div>
                <div>🔋 Bateria: <span className="text-mono text-accent">{deviceInfo?.batteryLevel != null ? `${deviceInfo.batteryLevel}%` : '...'}</span></div>
                <div>📡 Backend: <span className="text-mono text-accent">Firebase Firestore</span></div>
                <div>📦 Formato: <span className="text-mono text-accent">JSON RedVox-compatible</span></div>
                <div>🤖 IA: <span className="text-mono text-accent">Yr + NOAA + Infrassom + Pressão</span></div>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                <button
                  onClick={() => { flushBufferToCloud(deviceInfo, barometer.anomalyLog); alert('Pacote enviado!'); }}
                  className="btn-sm"
                  style={{ flex: 1, justifyContent: 'center', padding: 8 }}
                >
                  📤 Enviar Firebase
                </button>
                <button
                  onClick={() => { exportJSON(deviceInfo, barometer.anomalyLog); }}
                  className="btn-sm"
                  style={{ flex: 1, justifyContent: 'center', padding: 8 }}
                >
                  💾 Exportar JSON
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div style={{ padding: '12px 16px', fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
          LABMIT — Lab de Mitigação de Tempestades · Depto de Física · UFSC<br/>
          Dados cruzados: RedVox (Áudio) + Yr (Terrestre) + NOAA (Espacial)<br/>
          Ao usar este app, você concorda com os Termos de Privacidade.
        </div>
      </div>
    </div>
  );
}
