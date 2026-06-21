import { useState } from 'react';
import { Mic, MapPin, ShieldCheck, CloudLightning, ChevronRight, CheckCircle } from 'lucide-react';

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(1);
  const [geography, setGeography] = useState('plano');

  const nextStep = () => {
    if (step < 4) setStep(s => s + 1);
  };

  const handleComplete = async () => {
    try {
      // Pedir permissões proativas
      await navigator.mediaDevices.getUserMedia({ audio: true });
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
      }
    } catch (e) {
      console.warn('[Onboarding] Permissão negada ou ignorada:', e);
    }
    
    localStorage.setItem('labmit_geography', geography);
    localStorage.setItem('labmit_tutorial_completed', 'true');
    onComplete(geography);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-dark)', zIndex: 9999, display: 'flex', flexDirection: 'column', color: '#fff', overflowY: 'auto' }}>
      
      {/* ProgressBar */}
      <div style={{ display: 'flex', gap: 4, padding: 20 }}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={{ flex: 1, height: 4, background: i <= step ? 'var(--accent)' : 'var(--border)', borderRadius: 2 }} />
        ))}
      </div>

      <div style={{ flex: 1, padding: 30, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        
        {step === 1 && (
          <div className="fade-in">
            <CloudLightning size={48} color="var(--accent)" style={{ marginBottom: 20 }} />
            <h1 style={{ margin: '0 0 16px 0', fontSize: 24 }}>Bem-vindo ao LABMIT</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 16 }}>
              Você está prestes a transformar seu celular em um sensor científico. O LABMIT monitora <strong>infrassom</strong> — ondas sonoras tão graves que humanos não escutam, mas que são geradas por tempestades severas.
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <ShieldCheck size={48} color="#4caf50" style={{ marginBottom: 20 }} />
            <h1 style={{ margin: '0 0 16px 0', fontSize: 24 }}>Privacidade Garantida</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 16 }}>
              Nós <strong>nunca</strong> escutamos ou gravamos suas conversas.
            </p>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 16 }}>
              O app apenas calcula o volume (dB) e as frequências de infrassom. O aplicativo realiza medições contínuas de <strong>até 30 minutos sem intervenção</strong>. Você pode parar a gravação a qualquer hora e reiniciar manualmente depois se desejar.
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="fade-in">
            <Mic size={48} color="var(--warning)" style={{ marginBottom: 20 }} />
            <h1 style={{ margin: '0 0 16px 0', fontSize: 24 }}>Permissões Necessárias</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 16 }}>
              Para funcionar, o LABMIT precisa de:
            </p>
            <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: 15, paddingLeft: 20 }}>
              <li><strong>Microfone:</strong> Para captar a pressão do ar e sons de baixa frequência.</li>
              <li><strong>Localização:</strong> Para cruzar os dados com a previsão do tempo do Yr (MET Norway) e do Clima Espacial (NOAA).</li>
            </ul>
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 20 }}>
              * Serão solicitadas no próximo passo.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="fade-in">
            <MapPin size={48} color="var(--accent)" style={{ marginBottom: 20 }} />
            <h1 style={{ margin: '0 0 16px 0', fontSize: 24 }}>Sua Localização</h1>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: 16, marginBottom: 24 }}>
              A geografia do local afeta a forma como o infrassom se propaga e os riscos climáticos. Onde você vai deixar este sensor?
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { id: 'litoral', icon: '🌊', title: 'Litoral', desc: 'Próximo ao mar (risco de ressaca, ciclones)' },
                { id: 'encosta', icon: '⛰️', title: 'Encosta / Morro', desc: 'Terreno acidentado (risco de deslizamento)' },
                { id: 'vale', icon: '🌲', title: 'Vale', desc: 'Região baixa entre morros' },
                { id: 'plano', icon: '🏙️', title: 'Planície / Urbano', desc: 'Terreno plano ou cidade densa' }
              ].map(geo => (
                <div 
                  key={geo.id}
                  onClick={() => setGeography(geo.id)}
                  style={{ 
                    padding: 16, 
                    borderRadius: 8, 
                    border: `2px solid ${geography === geo.id ? 'var(--accent)' : 'var(--border)'}`,
                    background: geography === geo.id ? 'rgba(229, 255, 0, 0.1)' : 'var(--bg-input)',
                    display: 'flex', gap: 16, alignItems: 'center', cursor: 'pointer'
                  }}
                >
                  <span style={{ fontSize: 24 }}>{geo.icon}</span>
                  <div>
                    <div style={{ fontWeight: 'bold', color: geography === geo.id ? 'var(--accent)' : '#fff' }}>{geo.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{geo.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botões Base */}
      <div style={{ padding: 20, display: 'flex', gap: 12 }}>
        {step > 1 && (
          <button 
            onClick={() => setStep(s => s - 1)} 
            style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: '#fff', padding: 16 }}
          >
            Voltar
          </button>
        )}
        
        {step < 4 ? (
          <button 
            onClick={nextStep} 
            style={{ flex: 2, background: 'var(--accent)', color: '#000', fontWeight: 'bold', padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
          >
            Avançar <ChevronRight size={18} />
          </button>
        ) : (
          <button 
            onClick={handleComplete} 
            style={{ flex: 2, background: 'var(--accent)', color: '#000', fontWeight: 'bold', padding: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}
          >
            <CheckCircle size={18} /> Concluir e Iniciar
          </button>
        )}
      </div>

      <style>{`
        .fade-in { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
