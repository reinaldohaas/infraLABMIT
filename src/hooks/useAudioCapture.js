// ============================================================
//  useAudioCapture.js — Hook Web Audio API para infrassom e áudio
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useRef, useState, useCallback, useEffect } from 'react';

const FFT_SIZE = 4096;          // Alta resolução de frequência
const UPDATE_INTERVAL_MS = 100;  // ~10 fps de dados

// Converte magnitude linear → dB SPL (ref: 20 µPa)
const linearToDb = (magnitude) => {
  if (magnitude <= 0) return -120;
  return 20 * Math.log10(magnitude / 1.0);  // normalizado para 1.0 FS
};

export function useAudioCapture({ targetSampleRate = 8000, autoStart = false } = {}) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const [spl, setSpl] = useState(-120);
  const [dominantFreq, setDominantFreq] = useState(0);
  const [fftData, setFftData] = useState(null);
  const [timeData, setTimeData] = useState(null);
  const [sampleRate, setSampleRate] = useState(48000);
  const [gain, setGainValue] = useState(1.0);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const sourceRef = useRef(null);
  const gainNodeRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);

  const processAudio = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    
    // Frequency Domain (FFT)
    const dataArray = new Float32Array(bufferLength);
    analyser.getFloatFrequencyData(dataArray);

    // Time Domain (Waveform)
    const timeArray = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(timeArray);

    // dB → linear para cálculo de RMS SPL
    const linearData = dataArray.map(db => Math.pow(10, db / 20));

    // Nyquist limit and resolution
    const actualSampleRate = audioCtxRef.current.sampleRate;
    const nyquist = actualSampleRate / 2;
    const freqPerBin = nyquist / bufferLength;
    
    // Limits based on the chosen sample rate
    // Focus specifically on frequencies < 100Hz as requested for Toró infrasound
    const maxRelevantFreq = Math.min(100, nyquist);
    
    const bin1Hz = Math.floor(1 / freqPerBin);
    const binMaxFreq = Math.ceil(maxRelevantFreq / freqPerBin);

    const relevantBand = linearData.slice(bin1Hz, binMaxFreq);
    let rms = 0;
    if (relevantBand.length > 0) {
      rms = Math.sqrt(relevantBand.reduce((s, v) => s + v * v, 0) / relevantBand.length);
    }
    const splDb = linearToDb(rms);

    // Frequência dominante
    let maxIdx = bin1Hz;
    let maxVal = -Infinity;
    for (let i = bin1Hz; i <= binMaxFreq; i++) {
      if (dataArray[i] > maxVal) {
        maxVal = dataArray[i];
        maxIdx = i;
      }
    }
    const domFreq = maxIdx * freqPerBin;

    setSpl(Math.max(splDb, -120));
    setDominantFreq(Math.round(domFreq * 10) / 10);
    
    setFftData({
      data: dataArray,
      freqPerBin,
      bin1Hz,
      binMaxFreq,
      sampleRate: actualSampleRate,
    });
    
    setTimeData(timeArray);
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        }
      });
      streamRef.current = stream;

      // Try to request the specific sample rate (supported on modern browsers)
      const ctxOptions = targetSampleRate ? { sampleRate: targetSampleRate } : {};
      const ctx = new (window.AudioContext || window.webkitAudioContext)(ctxOptions);
      audioCtxRef.current = ctx;
      setSampleRate(ctx.sampleRate);

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;
      gainNodeRef.current = gainNode;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      source.connect(gainNode);
      gainNode.connect(analyser);

      intervalRef.current = setInterval(processAudio, UPDATE_INTERVAL_MS);
      setIsRecording(true);
    } catch (err) {
      setError(`Erro ao acessar microfone: ${err.message}`);
      console.error('[Audio]', err);
    }
  }, [gain, processAudio, targetSampleRate]);

  const stopRecording = useCallback(() => {
    clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
    setSpl(-120);
    setFftData(null);
    setTimeData(null);
  }, []);

  const setGain = useCallback((value) => {
    setGainValue(value);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = value;
    }
  }, []);

  // Auto-start gravação ao montar (como RedVox)
  useEffect(() => {
    if (autoStart && !isRecording) {
      startRecording();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  useEffect(() => {
    return () => {
      stopRecording();
    };
  }, [stopRecording]);

  return {
    isRecording,
    error,
    spl,
    dominantFreq,
    fftData,
    timeData,
    sampleRate,
    gain,
    setGain,
    startRecording,
    stopRecording,
  };
}
