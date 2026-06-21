// src/hooks/useFirebaseData.js
// ============================================================
//  Hook para LEITURA de dados do Firebase Firestore
//  Coleções usadas pelo dataStore.js:
//    - labmit_packets     → pacotes de sessão (SPL, freq, contexto)
//    - labmit_stations    → perfil de cada estação
//    - labmit_seismic_alerts → alertas de variação de pressão
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  doc,
  getDoc,
  where,
  Timestamp,
} from 'firebase/firestore';
import { db, ensureAuth } from '../firebase';

// ─── utilitário: garante auth antes de qualquer query ─────────────────────────
async function withAuth() {
  const uid = await ensureAuth();
  if (!uid || !db) throw new Error('Firebase não disponível');
  return uid;
}

// ── 1. Listar pacotes do usuário atual (busca única) ─────────────────────────
/**
 * Retorna os últimos N pacotes enviados por este dispositivo.
 *
 * Cada pacote tem a estrutura do buildRedVoxPacket():
 *   { timing, station_information, sensors, environmental_context, ... }
 *
 * Uso:
 *   const { packets, loading, error, refresh } = useMyPackets(20);
 */
export function useMyPackets(limitN = 20) {
  const [packets,  setPackets]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const uid = await withAuth();
      const ref = collection(db, 'labmit_packets');
      // Filtra pelo uid do usuário autenticado anonimamente
      const q   = query(ref,
        where('_auth_uid', '==', uid),
        orderBy('_created_at', 'desc'),
        limit(limitN)
      );
      const snap = await getDocs(q);
      setPackets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [limitN]);

  useEffect(() => { fetch(); }, [fetch]);
  return { packets, loading, error, refresh: fetch };
}

// ── 2. Escutar novos pacotes em TEMPO REAL ────────────────────────────────────
/**
 * Atualiza automaticamente sempre que um novo pacote chega ao Firestore.
 * Ideal para um dashboard de monitoramento ao vivo.
 *
 * Uso:
 *   const { packets, loading } = usePacketsRealtime(10);
 */
export function usePacketsRealtime(limitN = 10) {
  const [packets, setPackets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let unsub = null;
    (async () => {
      try {
        const uid = await withAuth();
        const ref = collection(db, 'labmit_packets');
        const q   = query(ref,
          where('_auth_uid', '==', uid),
          orderBy('_created_at', 'desc'),
          limit(limitN)
        );
        // onSnapshot: re-renderiza em tempo real sem precisar fazer refresh
        unsub = onSnapshot(q, (snap) => {
          setPackets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        }, (err) => {
          setError(err.message);
          setLoading(false);
        });
      } catch (e) {
        setError(e.message);
        setLoading(false);
      }
    })();
    return () => { if (unsub) unsub(); };  // limpa ao desmontar
  }, [limitN]);

  return { packets, loading, error };
}

// ── 3. Buscar um pacote específico por ID ─────────────────────────────────────
/**
 * Uso:
 *   const { packet, loading } = usePacket(packetId);
 */
export function usePacket(packetId) {
  const [packet,  setPacket]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!packetId) return;
    (async () => {
      setLoading(true);
      try {
        await withAuth();  // garante auth
        const snap = await getDoc(doc(db, 'labmit_packets', packetId));
        if (snap.exists()) setPacket({ id: snap.id, ...snap.data() });
        else throw new Error('Pacote não encontrado');
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [packetId]);

  return { packet, loading, error };
}

// ── 4. Buscar pacotes por intervalo de datas ──────────────────────────────────
/**
 * Uso:
 *   const { packets } = usePacketsByDate(new Date('2025-06-01'), new Date());
 */
export function usePacketsByDate(startDate, endDate, limitN = 100) {
  const [packets, setPackets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!startDate || !endDate) return;
    (async () => {
      setLoading(true);
      try {
        const uid = await withAuth();
        const ref = collection(db, 'labmit_packets');
        const q   = query(ref,
          where('_auth_uid',   '==', uid),
          where('_created_at', '>=', startDate.toISOString()),
          where('_created_at', '<=', endDate.toISOString()),
          orderBy('_created_at', 'desc'),
          limit(limitN)
        );
        const snap = await getDocs(q);
        setPackets(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [startDate, endDate, limitN]);

  return { packets, loading, error };
}

// ── 5. Alertas sísmicos (variações de pressão ≥ 1 hPa) ───────────────────────
/**
 * Uso:
 *   const { alerts, loading } = useSeismicAlerts(30);
 */
export function useSeismicAlerts(limitN = 30) {
  const [alerts,  setAlerts]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let unsub = null;
    (async () => {
      try {
        const uid = await withAuth();
        const ref = collection(db, 'labmit_seismic_alerts');
        const q   = query(ref,
          where('_auth_uid', '==', uid),
          orderBy('timestamp', 'desc'),
          limit(limitN)
        );
        // Tempo real
        unsub = onSnapshot(q, (snap) => {
          setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        }, (err) => {
          setError(err.message); setLoading(false);
        });
      } catch (e) {
        setError(e.message); setLoading(false);
      }
    })();
    return () => { if (unsub) unsub(); };
  }, [limitN]);

  return { alerts, loading, error };
}

// ── 6. Perfil da estação (este dispositivo) ───────────────────────────────────
/**
 * Uso:
 *   const { station, loading } = useMyStation();
 */
export function useMyStation() {
  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await withAuth();
        const uuid = localStorage.getItem('labmit_device_uuid') || 'unknown';
        const snap = await getDoc(doc(db, 'labmit_stations', uuid));
        if (snap.exists()) setStation({ id: snap.id, ...snap.data() });
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { station, loading, error };
}
