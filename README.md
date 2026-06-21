# infraLABMIT

Monitor de infrassom em tempo real desenvolvido pelo **Laboratório de Mitigação de Tempestades (LABMIT)** — Departamento de Física / UFSC.

## 🎯 Sobre o projeto

Aplicação web progressiva (PWA) que captura áudio de baixa frequência via microfone do dispositivo, detecta eventos de infrassom (< 20 Hz), correlaciona com dados meteorológicos e índices de atividade solar, e envia os dados para o Firebase para análise científica.

## 🔬 Funcionalidades

- **Espectrograma ao vivo** com ênfase em 1–100 Hz (modo infrassom)
- **SPL em tempo real** com detecção de padrões (fala, assovio, motor, infrassom)
- **Inteligência de tempestade** — correlação com:
  - Yr.no (previsão meteorológica)
  - NOAA SWPC (índice Kp, flares solares)
  - Barômetro do dispositivo (quando disponível)
- **Sincronização Firebase** — pacotes compatíveis com RedVox API 1000
- **Alertas sísmicos** — detecção de variações de pressão ≥ 1 hPa
- **Exportação** CSV e JSON

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React + Vite |
| Áudio | Web Audio API (`AudioWorklet`) |
| Backend/DB | Firebase Firestore + Auth anônimo |
| Clima | API Yr.no + NOAA SWPC |
| Análise | Python + pandas + matplotlib |

## 📁 Estrutura

```
src/
├── components/
│   ├── LiveSpectrogram.jsx   # Espectrograma canvas em tempo real
│   ├── MetricsBar.jsx        # Barra SPL / freq / taxa de amostragem
│   ├── WeatherBar.jsx        # Clima compacto + Kp index
│   ├── StormAlert.jsx        # Alerta colorido de risco de tempestade
│   ├── DataPanel.jsx         # Histórico Firebase + local + alertas
│   ├── AlertPanel.jsx        # Painel de notificações
│   ├── EventReporter.jsx     # Reporte de eventos pelo pesquisador
│   └── Onboarding.jsx        # Tutorial inicial
├── hooks/
│   ├── useAudioCapture.js    # Captura e FFT de áudio
│   ├── useYr.js              # Previsão Yr.no
│   ├── useSpaceWeather.js    # NOAA SWPC (Kp, flares)
│   ├── usePatternDetector.js # Detecção de padrões no FFT
│   ├── useStormIntelligence.js # Score de risco de tempestade
│   ├── useBarometer.js       # Sensor de pressão do dispositivo
│   ├── useDeviceInfo.js      # Informações do dispositivo
│   └── useFirebaseData.js    # Leitura de dados do Firestore
├── store/
│   └── dataStore.js          # Buffer local + envio para Firebase
├── firebase.js               # Configuração Firebase
└── App.jsx                   # Componente raiz
analysis/
└── labmit_analyze.py         # Script Python para análise dos dados
```

## 🚀 Instalação e execução

```bash
# Instalar dependências
npm install

# Desenvolvimento
npm run dev

# Build de produção
npm run build
```

## 🔑 Configuração Firebase

As credenciais do Firebase já estão configuradas em `src/firebase.js` para o projeto **labmit-ufsc**.

Para análise de dados em Python:
```bash
pip install firebase-admin pandas matplotlib seaborn
# Baixar serviceAccountKey.json no Firebase Console
# → Configurações → Contas de serviço → Gerar nova chave privada
python analysis/labmit_analyze.py
```

## 📊 Estrutura do Firestore

| Coleção | Conteúdo |
|---------|---------|
| `labmit_packets` | Sessões de gravação (SPL, freq, contexto ambiental) |
| `labmit_stations` | Perfil de cada dispositivo/estação |
| `labmit_seismic_alerts` | Variações de pressão ≥ 1 hPa |

## 👥 Equipe

- **LABMIT — Lab de Mitigação de Tempestades**
- Departamento de Física — UFSC
- Florianópolis, SC, Brasil

## 📄 Licença

MIT — uso livre para fins científicos e educacionais.
