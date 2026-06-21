# -*- coding: utf-8 -*-
"""
labmit_analyze.py
=================
Download and analyse LABMIT infrasound data from Firebase Firestore.

===========================================================
  RESTRICTED ACCESS - AUTHORISATION REQUIRED
===========================================================
  Access to the Firebase database of this project requires
  prior authorisation from the author:

  Prof. Reinaldo Haas - reinaldohaas@ufsc.br
  LABMIT / Department of Physics - UFSC (Brazil)

  The service account key (serviceAccountKey.json) is NOT
  included in this repository and is only provided upon
  express authorisation from the project owner.
===========================================================

Requirements
------------
1. pip install firebase-admin pandas matplotlib seaborn
2. Request the service account key: reinaldohaas@ufsc.br
   Save it as "serviceAccountKey.json" in the same folder as this script.
"""


import json
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
from datetime import datetime, timezone

# ── 1. Conectar ao Firebase ──────────────────────────────────────────────────
import firebase_admin
from firebase_admin import credentials, firestore

# Path to the service account key (request from reinaldohaas@ufsc.br)
# Use a raw string r"..." or forward slashes to avoid \U unicode escape errors on Windows
SERVICE_ACCOUNT_KEY = r"serviceAccountKey.json"  # place the file in the same folder as this script

if not firebase_admin._apps:
    cred = credentials.Certificate(SERVICE_ACCOUNT_KEY)
    firebase_admin.initialize_app(cred)

db = firestore.client()
print("✅ Conectado ao Firebase")

# ── 2. Baixar todos os pacotes ───────────────────────────────────────────────
def baixar_pacotes(limite=200):
    """Retorna lista de dicts com todos os pacotes labmit_packets."""
    print(f"📥 Baixando até {limite} pacotes...")
    docs = (
        db.collection("labmit_packets")
          .order_by("_created_at", direction=firestore.Query.DESCENDING)
          .limit(limite)
          .stream()
    )
    pacotes = []
    for doc in docs:
        d = doc.to_dict()
        d["_doc_id"] = doc.id
        pacotes.append(d)
    print(f"   → {len(pacotes)} pacotes encontrados")
    return pacotes

pacotes = baixar_pacotes(500)

# ── 3. Extrair séries temporais de SPL ───────────────────────────────────────
def extrair_leituras(pacotes):
    """
    Desmonta os arrays spl_db e dominant_freq_hz de cada pacote
    em um DataFrame linha por linha.
    """
    rows = []
    for p in pacotes:
        audio = p.get("sensors", {}).get("audio", {})
        spl_list  = audio.get("spl_db", [])
        freq_list = audio.get("dominant_freq_hz", [])
        ts_list   = audio.get("timestamps_ms", [])
        start_str = p.get("timing", {}).get("packet_start")

        station = p.get("station_information", {}).get("id", "desconhecido")
        loc     = p.get("sensors", {}).get("location", {}).get("name", "")

        for i, spl in enumerate(spl_list):
            # Timestamp: usa lista se existir, senão distribui a partir do start
            if ts_list and i < len(ts_list):
                ts = pd.Timestamp(ts_list[i], unit="ms", tz="UTC")
            elif start_str:
                ts = pd.Timestamp(start_str) + pd.Timedelta(seconds=i * 0.5)
            else:
                ts = pd.NaT

            rows.append({
                "timestamp":  ts,
                "spl_db":     spl,
                "freq_hz":    freq_list[i] if i < len(freq_list) else None,
                "station":    station,
                "location":   loc,
                "packet_id":  p["_doc_id"],
            })

    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    df = df.dropna(subset=["spl_db"]).sort_values("timestamp").reset_index(drop=True)
    print(f"✅ DataFrame com {len(df)} leituras individuais")
    return df

df = extrair_leituras(pacotes)

# ── 4. Estatísticas por sessão ────────────────────────────────────────────────
def resumo_por_sessao(pacotes):
    rows = []
    for p in pacotes:
        stats = p.get("sensors", {}).get("audio", {}).get("stats", {})
        si    = p.get("environmental_context", {}).get("storm_intelligence", {})
        rows.append({
            "session_id":          p["_doc_id"],
            "inicio":              p.get("timing", {}).get("packet_start"),
            "fim":                 p.get("timing", {}).get("packet_end"),
            "estacao":             p.get("station_information", {}).get("id"),
            "localizacao":         p.get("sensors", {}).get("location", {}).get("name"),
            "spl_medio_db":        stats.get("spl_mean"),
            "spl_max_db":          stats.get("spl_max"),
            "spl_min_db":          stats.get("spl_min"),
            "spl_p95_db":          stats.get("spl_p95"),
            "infrassom_pct":       stats.get("infrasound_percent"),
            "n_leituras":          p.get("sensors", {}).get("audio", {}).get("sample_count", 0),
            "risk_score":          si.get("riskScore"),
            "risk_level":          si.get("riskLevel"),
            "kp_index":            p.get("environmental_context", {}).get("space", {}).get("kp_index"),
            "flare":               p.get("environmental_context", {}).get("space", {}).get("solar_flare"),
            "storm_warning":       p.get("environmental_context", {}).get("terrestrial", {}).get("storm_warning"),
        })
    df_sess = pd.DataFrame(rows)
    df_sess["inicio"] = pd.to_datetime(df_sess["inicio"], utc=True)
    df_sess["fim"]    = pd.to_datetime(df_sess["fim"],    utc=True)
    return df_sess

df_sess = resumo_por_sessao(pacotes)
print("\n📊 Resumo das sessões:")
print(df_sess[["inicio", "spl_medio_db", "spl_max_db", "infrassom_pct", "risk_level"]].to_string())

# ── 5. Exportar para CSV / Excel ─────────────────────────────────────────────
df.to_csv("labmit_leituras.csv", index=False)
df_sess.to_csv("labmit_sessoes.csv", index=False)
# df_sess.to_excel("labmit_sessoes.xlsx", index=False)   # pip install openpyxl
print("\n💾 Arquivos salvos: labmit_leituras.csv  labmit_sessoes.csv")

# ── 6. Alertas sísmicos ───────────────────────────────────────────────────────
def baixar_alertas():
    docs = db.collection("labmit_seismic_alerts").order_by("timestamp", direction=firestore.Query.DESCENDING).limit(100).stream()
    rows = []
    for doc in docs:
        d = doc.to_dict()
        rows.append({
            "timestamp":  d.get("timestamp"),
            "delta_hpa":  d.get("delta_hpa"),
            "direcao":    d.get("direction"),
            "estacao":    d.get("station_id"),
            "localizacao":d.get("location_name"),
        })
    return pd.DataFrame(rows)

df_alerts = baixar_alertas()
print(f"\n⚡ {len(df_alerts)} alertas sísmicos encontrados")
if not df_alerts.empty:
    print(df_alerts.head(10).to_string())

# ── 7. Gráficos ───────────────────────────────────────────────────────────────
plt.style.use("dark_background")
fig, axes = plt.subplots(3, 1, figsize=(14, 10))
fig.suptitle("LABMIT — Análise de Infrassom", color="white", fontsize=14, fontweight="bold")

# Gráfico 1: SPL ao longo do tempo
ax = axes[0]
if not df.empty:
    ax.plot(df["timestamp"], df["spl_db"], lw=0.4, color="#e5ff00", alpha=0.7, label="SPL (dB)")
    # Média móvel 60 pontos (~30 s)
    if len(df) > 60:
        df["spl_smooth"] = df["spl_db"].rolling(60, center=True).mean()
        ax.plot(df["timestamp"], df["spl_smooth"], lw=1.5, color="#ff6b6b", label="Média 30s")
ax.set_ylabel("SPL (dB)", color="white")
ax.set_title("Nível de Pressão Sonora ao longo do tempo", color="#aaa", fontsize=10)
ax.legend(fontsize=8)
ax.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m %H:%M"))
plt.setp(ax.xaxis.get_majorticklabels(), rotation=20)

# Gráfico 2: Frequência dominante
ax2 = axes[1]
if not df.empty and "freq_hz" in df.columns:
    freq_valid = df[df["freq_hz"] > 0]
    infrasom   = freq_valid[freq_valid["freq_hz"] < 20]
    resto      = freq_valid[freq_valid["freq_hz"] >= 20]
    ax2.scatter(resto["timestamp"],    resto["freq_hz"],    s=1,  color="#88ccff", alpha=0.5, label="Freq. audível")
    ax2.scatter(infrasom["timestamp"], infrasom["freq_hz"], s=2,  color="#a78bfa", alpha=0.8, label="Infrassom (<20 Hz)")
    ax2.axhline(20, color="#a78bfa", lw=0.8, ls="--", alpha=0.5)
ax2.set_ylabel("Frequência (Hz)", color="white")
ax2.set_title("Frequência Dominante", color="#aaa", fontsize=10)
ax2.legend(fontsize=8)
ax2.xaxis.set_major_formatter(mdates.DateFormatter("%d/%m %H:%M"))
plt.setp(ax2.xaxis.get_majorticklabels(), rotation=20)

# Gráfico 3: Histograma de SPL por sessão
ax3 = axes[2]
if not df_sess.empty and df_sess["spl_medio_db"].notna().any():
    spl_vals = df_sess["spl_medio_db"].dropna()
    ax3.hist(spl_vals, bins=20, color="#e5ff00", alpha=0.7, edgecolor="#1a1a2e")
    ax3.axvline(spl_vals.mean(), color="#ff6b6b", lw=1.5, ls="--", label=f"Média: {spl_vals.mean():.1f} dB")
ax3.set_xlabel("SPL médio por sessão (dB)", color="white")
ax3.set_ylabel("Nº de sessões", color="white")
ax3.set_title("Distribuição do SPL médio por sessão", color="#aaa", fontsize=10)
ax3.legend(fontsize=8)

plt.tight_layout()
plt.savefig("labmit_analise.png", dpi=150, bbox_inches="tight", facecolor="#1a1a2e")
plt.show()
print("\n✅ Gráfico salvo: labmit_analise.png")

# ── 8. Análise de infrassom ───────────────────────────────────────────────────
print("\n🔬 Análise de Infrassom:")
if not df.empty and "freq_hz" in df.columns:
    total = len(df)
    infrasom = df[df["freq_hz"] < 20]
    print(f"   Total de leituras: {total}")
    print(f"   Leituras com infrassom (<20 Hz): {len(infrasom)} ({100*len(infrasom)/total:.1f} %)")
    if not infrasom.empty:
        print(f"   SPL médio em eventos de infrassom: {infrasom['spl_db'].mean():.1f} dB")
        print(f"   Frequência modal de infrassom: {infrasom['freq_hz'].round().mode().values[0]:.0f} Hz")

# ── 9. Correlação SPL × Kp index ─────────────────────────────────────────────
if not df_sess.empty:
    corr_data = df_sess[["spl_medio_db", "kp_index", "infrassom_pct", "risk_score"]].dropna()
    if len(corr_data) > 2:
        print("\n📈 Correlações:")
        print(corr_data.corr().to_string())
