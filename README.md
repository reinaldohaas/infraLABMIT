# infraLABMIT

**Real-time infrasound monitor** developed by the **Storm Mitigation Laboratory (LABMIT)** — Department of Physics / Federal University of Santa Catarina (UFSC), Brazil.

🇧🇷 [Versão em Português](README.pt-BR.md)

---

> [!CAUTION]
> ## 🔒 Data Access — Authorization Required
>
> Data collected and stored in the Firebase database of this project are the property of **LABMIT / UFSC** and are protected by Firestore security rules.
>
> **Access to the database requires prior authorization from the author:**
>
> **Prof. Reinaldo Haas** — `reinaldohaas@ufsc.br`
> Department of Physics — Federal University of Santa Catarina (UFSC)
>
> This includes:
> - Reading data via Firebase Console
> - Using the service account key (`serviceAccountKey.json`)
> - Running the analysis script (`analysis/labmit_analyze.py`)
> - Any programmatic access to Firestore (`labmit_packets`, `labmit_stations`, `labmit_seismic_alerts`)
>
> Data collected by volunteers are anonymous and used exclusively for scientific research purposes.

---

## 🎯 About the Project

A Progressive Web Application (PWA) that captures low-frequency audio via the device microphone, detects infrasound events (< 20 Hz), correlates them with meteorological data and solar activity indices, and uploads the data to Firebase for scientific analysis.

Infrasound — acoustic waves below the human hearing threshold (< 20 Hz) — can propagate over long distances and has been associated with atmospheric phenomena such as thunderstorms, volcanic activity, and severe weather events.

## 🔬 Features

- **Live spectrogram** with emphasis on 1–100 Hz (infrasound mode)
- **Real-time SPL** with pattern detection (speech, whistle, engine, infrasound)
- **Storm intelligence engine** — correlation with:
  - Yr.no (weather forecast)
  - NOAA SWPC (Kp index, solar flares)
  - Device barometer (when available)
- **Firebase sync** — packets compatible with RedVox API 1000 format
- **Seismic alerts** — detection of pressure variations ≥ 1 hPa
- **Data export** as CSV and JSON

## 🛠️ Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Audio | Web Audio API (`AudioWorklet`) |
| Backend / DB | Firebase Firestore + Anonymous Auth |
| Weather | Yr.no API + NOAA SWPC |
| Analysis | Python + pandas + matplotlib |
| Mobile | Capacitor (Android) |

## 📁 Project Structure

```
src/
├── components/
│   ├── LiveSpectrogram.jsx     # Real-time canvas spectrogram
│   ├── MetricsBar.jsx          # SPL / frequency / sample rate bar
│   ├── WeatherBar.jsx          # Compact weather + Kp index
│   ├── StormAlert.jsx          # Color-coded storm risk alert
│   ├── DataPanel.jsx           # Firebase history + local + alerts
│   ├── AlertPanel.jsx          # Notification panel
│   ├── EventReporter.jsx       # Researcher event reporting form
│   └── Onboarding.jsx          # Initial tutorial
├── hooks/
│   ├── useAudioCapture.js      # Audio capture and FFT
│   ├── useYr.js                # Yr.no weather forecast
│   ├── useSpaceWeather.js      # NOAA SWPC (Kp, solar flares)
│   ├── usePatternDetector.js   # FFT pattern detection (heuristic)
│   ├── useStormIntelligence.js # Storm risk score engine
│   ├── useBarometer.js         # Device pressure sensor
│   ├── useDeviceInfo.js        # Device metadata
│   └── useFirebaseData.js      # Firestore read hooks
├── store/
│   └── dataStore.js            # Local buffer + Firebase upload
├── firebase.js                 # Firebase configuration
└── App.jsx                     # Root component
analysis/
└── labmit_analyze.py           # Python script for data analysis
android/                        # Capacitor Android project
```

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build
npm run build
```

## 🔑 Firebase Configuration

> [!WARNING]
> The database is protected by Firestore security rules.
> The service account key (`serviceAccountKey.json`) is **not included** in this repository
> and is only provided upon authorization by the author.

The app uses **anonymous authentication** for data collection by volunteers.
For **reading and analyzing** the collected data, a service account key is required:

```bash
pip install firebase-admin pandas matplotlib seaborn

# Request serviceAccountKey.json from:
# reinaldohaas@ufsc.br

python analysis/labmit_analyze.py
```

## 📊 Firestore Structure

| Collection | Contents | Access |
|------------|---------|--------|
| `labmit_packets` | Recording sessions (SPL, freq, environmental context) | 🔒 Authorized only |
| `labmit_stations` | Device/station profile | 🔒 Authorized only |
| `labmit_seismic_alerts` | Pressure variations ≥ 1 hPa | 🔒 Authorized only |

## 🔬 Data Format

Each session is uploaded as a JSON packet compatible with the **RedVox API 1000** format:

```json
{
  "api": "labmit-1000",
  "api_version": "4.0.0",
  "station_information": { "id": "LABMIT_XXXXXXXX", "uuid": "...", ... },
  "timing": { "packet_start": "ISO8601", "packet_end": "ISO8601", ... },
  "sensors": {
    "audio": {
      "spl_db": [...],
      "dominant_freq_hz": [...],
      "stats": { "spl_mean": -45.2, "infrasound_percent": 12.3, ... }
    },
    "pressure": { "anomaly_count": 0, "anomalies": [...] }
  },
  "environmental_context": {
    "terrestrial": { "source": "yr.no", "storm_warning": false, ... },
    "space": { "source": "noaa_swpc", "kp_index": 2, "solar_flare": "B5.1" },
    "storm_intelligence": { "riskScore": 15, "riskLevel": "low", ... }
  }
}
```

## 📈 Data Analysis (Python)

After obtaining authorization and the service account key:

```python
# Download all sessions as a pandas DataFrame
from analysis.labmit_analyze import baixar_pacotes, extrair_leituras

packets = baixar_pacotes(limite=500)
df = extrair_leituras(packets)

# df columns: timestamp, spl_db, freq_hz, station, location, packet_id
print(df.describe())
df.to_csv("labmit_data.csv", index=False)
```

## 👥 Team

- **Prof. Reinaldo Haas** (author / principal investigator) — reinaldohaas@ufsc.br
- **LABMIT — Storm Mitigation Laboratory**
- Department of Physics — Federal University of Santa Catarina (UFSC)
- Florianópolis, SC, Brazil

## 📄 License

The **source code** of this project is released under the **MIT License** for scientific and educational use.

The **data collected and stored in Firebase** are the property of LABMIT/UFSC. Access is restricted — see the authorization notice at the top of this document.

```
MIT License

Copyright (c) 2025 Reinaldo Haas / LABMIT-UFSC

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

## 📚 References

- RedVox API 1000: https://redvoxinc.github.io/redvox-sdk/
- NOAA SWPC: https://www.swpc.noaa.gov/
- Yr.no API: https://api.met.no/
- Firebase Firestore: https://firebase.google.com/docs/firestore
