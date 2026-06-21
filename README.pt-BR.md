# infraLABMIT

Monitor de infrassom em tempo real desenvolvido pelo **Laboratório de Mitigação de Tempestades (LABMIT)** — Departamento de Física / UFSC.

🇺🇸 [English version (official)](README.md)


---

> [!CAUTION]
> ## 🔒 Acesso aos Dados — Autorização Obrigatória
>
> Os dados coletados e armazenados no Firebase deste projeto são de propriedade do **LABMIT / UFSC** e estão protegidos pelas regras de segurança do Firestore.
>
> **O acesso ao banco de dados requer autorização prévia do autor:**
>
> **Prof. Reinaldo Haas** — `reinaldohaas@ufsc.br`
> Departamento de Física — Universidade Federal de Santa Catarina
>
> Isso inclui:
> - Leitura de dados via Firebase Console
> - Uso da chave de serviço (`serviceAccountKey.json`)
> - Execução do script de análise (`analysis/labmit_analyze.py`)
> - Qualquer acesso programático ao Firestore (`labmit_packets`, `labmit_stations`, `labmit_seismic_alerts`)
>
> Dados coletados pelos voluntários são anônimos e utilizados exclusivamente para pesquisa científica.

---

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

> [!WARNING]
> O banco de dados é protegido por regras de segurança do Firestore.
> A chave de serviço (`serviceAccountKey.json`) **não está incluída** neste repositório
> e só é fornecida mediante autorização do autor.

O app usa **autenticação anônima** para gravação de dados pelos voluntários.
Para **leitura e análise** dos dados coletados, é necessária a chave de serviço:

```bash
pip install firebase-admin pandas matplotlib seaborn

# serviceAccountKey.json deve ser solicitada ao autor
# reinaldohaas@ufsc.br

python analysis/labmit_analyze.py
```

## 📊 Estrutura do Firestore

| Coleção | Conteúdo | Acesso |
|---------|---------|--------|
| `labmit_packets` | Sessões de gravação (SPL, freq, contexto ambiental) | 🔒 Autorizado |
| `labmit_stations` | Perfil de cada dispositivo/estação | 🔒 Autorizado |
| `labmit_seismic_alerts` | Variações de pressão ≥ 1 hPa | 🔒 Autorizado |

## 👥 Equipe

- **Prof. Reinaldo Haas** (autor/responsável) — reinaldohaas@ufsc.br
- **LABMIT — Lab de Mitigação de Tempestades**
- Departamento de Física — UFSC
- Florianópolis, SC, Brasil

## 📄 Licença

O **código-fonte** deste projeto é disponibilizado sob a licença **MIT** para fins científicos e educacionais.

Os **dados coletados e armazenados no Firebase** são de propriedade do LABMIT/UFSC e seu acesso é restrito — veja o aviso no início deste documento.
