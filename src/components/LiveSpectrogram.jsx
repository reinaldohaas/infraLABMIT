// ============================================================
//  LiveSpectrogram.jsx — Espectrograma temporal estilo RedVox
//  Scroll horizontal: tempo → , frequência ↑, cor = intensidade dB
//  Paleta magma com auto-escala dinâmica
//  Lab de Mitigação de Tempestades — Depto de Física / UFSC
// ============================================================

import { useRef, useEffect, useCallback } from 'react';

// ─── Paleta Magma Verdadeira (256 cores) ───
// Baseada na paleta matplotlib magma — começa em roxo escuro, nunca preto puro
const MAGMA = (() => {
  // Pontos de controle da paleta magma real
  const ctrl = [
    [0.001462, 0.000466, 0.013866],  // 0: preto-azulado
    [0.039608, 0.031090, 0.133515],  // ~25: roxo muito escuro
    [0.136834, 0.054184, 0.296005],  // ~51: roxo
    [0.315588, 0.071659, 0.429220],  // ~76: magenta escuro
    [0.515946, 0.106311, 0.429597],  // ~102: magenta
    [0.716387, 0.214982, 0.332092],  // ~127: vermelho-magenta
    [0.868793, 0.382914, 0.199311],  // ~153: laranja-vermelho
    [0.961293, 0.569150, 0.067836],  // ~178: laranja
    [0.993248, 0.774815, 0.154952],  // ~204: amarelo
    [0.987053, 0.991438, 0.749504],  // ~255: branco-quente
  ];
  const N = ctrl.length;
  const palette = [];
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * (N - 1);
    const lo = Math.floor(t);
    const hi = Math.min(lo + 1, N - 1);
    const frac = t - lo;
    const r = Math.round((ctrl[lo][0] + (ctrl[hi][0] - ctrl[lo][0]) * frac) * 255);
    const g = Math.round((ctrl[lo][1] + (ctrl[hi][1] - ctrl[lo][1]) * frac) * 255);
    const b = Math.round((ctrl[lo][2] + (ctrl[hi][2] - ctrl[lo][2]) * frac) * 255);
    palette.push([r, g, b]);
  }
  return palette;
})();

const SCROLL_PX = 2;
const FREQ_TICKS = [50, 67, 82, 100, 122, 150, 183, 224, 274, 400, 600, 800];

export default function LiveSpectrogram({ fftData, isRecording, patterns = [], maxFreqLimit = 100 }) {
  const canvasRef = useRef(null);
  const offscreenCanvasRef = useRef(null);
  const cursorXRef = useRef(0);
  const isFullRef = useRef(false);
  const timeLabelsRef = useRef([]);
  const lastTimeRef = useRef(0);
  const dbRangeRef = useRef({ min: -90, max: -30, samples: 0 });

  // Eixo Y ticks dinâmicos baseados no limite máximo de frequência
  const getFreqTicks = (maxF) => {
    if (maxF <= 100) {
      return [1, 5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    } else if (maxF <= 200) {
      return [2, 10, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
    } else {
      return [5, 20, 50, 100, 150, 200, 250, 300, 400, 500];
    }
  };

  // Get or create offscreen canvas
  const getOffscreenCanvas = (w, h) => {
    if (!offscreenCanvasRef.current) {
      offscreenCanvasRef.current = document.createElement('canvas');
    }
    const oc = offscreenCanvasRef.current;
    if (oc.width !== w || oc.height !== h) {
      const temp = document.createElement('canvas');
      temp.width = oc.width;
      temp.height = oc.height;
      const tCtx = temp.getContext('2d');
      tCtx.drawImage(oc, 0, 0);

      oc.width = w;
      oc.height = h;
      const ocCtx = oc.getContext('2d');
      ocCtx.fillStyle = '#0a0020';
      ocCtx.fillRect(0, 0, w, h);
      ocCtx.drawImage(temp, 0, 0);
    }
    return oc;
  };

  // Reset fills when recording starts/stops
  useEffect(() => {
    if (!isRecording) {
      cursorXRef.current = 0;
      isFullRef.current = false;
      timeLabelsRef.current = [];
      if (offscreenCanvasRef.current) {
        const ctx = offscreenCanvasRef.current.getContext('2d');
        ctx.fillStyle = '#0a0020';
        ctx.fillRect(0, 0, offscreenCanvasRef.current.width, offscreenCanvasRef.current.height);
      }
      // Desenha estado ocioso
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0020';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.font = '14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Toque GRAVAR para iniciar', canvas.width / 2, canvas.height / 2);
        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillText('Infrassom e Espectrograma em tempo real', canvas.width / 2, canvas.height / 2 + 20);
      }
    }
  }, [isRecording]);

  // Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    const setSize = () => {
      const w = parent?.clientWidth || 360;
      const h = parent?.clientHeight || 300;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        // Redesenha fundo se parado
        if (!isRecording) {
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#0a0020';
          ctx.fillRect(0, 0, w, h);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
          ctx.font = '14px Inter, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Toque GRAVAR para iniciar', w / 2, h / 2);
        }
      }
    };
    setSize();
    const ro = new ResizeObserver(setSize);
    ro.observe(parent || canvas);
    return () => ro.disconnect();
  }, [isRecording]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || !fftData || !isRecording) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const usableH = H - 16;

    const now = Date.now();
    const { data, freqPerBin, sampleRate } = fftData;
    const nyquist = sampleRate / 2;
    const minFreq = 1.0; // Capturar Infrassom real abaixo de 100 Hz
    const maxFreq = Math.min(maxFreqLimit, nyquist);
    const logMin = Math.log10(minFreq);
    const logMax = Math.log10(Math.max(minFreq + 1, maxFreq));

    // ─── Auto-escala dinâmica ───
    let colMin = 0, colMax = -200;
    const binLo = Math.max(1, Math.round(minFreq / freqPerBin));
    const binHi = Math.min(data.length - 1, Math.round(maxFreq / freqPerBin));
    for (let i = binLo; i <= binHi; i++) {
      const v = data[i];
      if (v > -200 && v < 0) {
        if (v < colMin) colMin = v;
        if (v > colMax) colMax = v;
      }
    }

    const dr = dbRangeRef.current;
    const alpha = dr.samples < 30 ? 0.3 : 0.02;
    dr.min = dr.min + alpha * (colMin - dr.min);
    dr.max = dr.max + alpha * (colMax - dr.max);
    dr.samples++;

    let rangeMin = dr.min;
    let rangeMax = dr.max;
    if (rangeMax - rangeMin < 30) {
      const mid = (rangeMax + rangeMin) / 2;
      rangeMin = mid - 15;
      rangeMax = mid + 15;
    }

    const offscreen = getOffscreenCanvas(W, usableH);
    const oCtx = offscreen.getContext('2d');

    let targetX = 0;
    if (!isFullRef.current) {
      targetX = cursorXRef.current;
      cursorXRef.current += SCROLL_PX;
      if (cursorXRef.current >= W - SCROLL_PX) {
        isFullRef.current = true;
        cursorXRef.current = W - SCROLL_PX;
      }
    } else {
      oCtx.drawImage(offscreen, -SCROLL_PX, 0);
      targetX = W - SCROLL_PX;
    }

    // Desenha coluna
    for (let y = 0; y < usableH; y++) {
      const t = 1 - (y / usableH);
      const logFreq = logMin + t * (logMax - logMin);
      const freq = Math.pow(10, logFreq);
      const bin = Math.round(freq / freqPerBin);
      const clampedBin = Math.max(0, Math.min(data.length - 1, bin));
      const db = data[clampedBin];

      const norm = Math.max(0, Math.min(1, (db - rangeMin) / (rangeMax - rangeMin)));
      const idx = Math.round(norm * 255);
      const [r, g, b] = MAGMA[idx];
      oCtx.fillStyle = `rgb(${r},${g},${b})`;
      oCtx.fillRect(targetX, y, SCROLL_PX, 1);
    }

    // Copia para tela e desenha overlay fixo
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(offscreen, 0, 0);

    // Timestamps
    if (now - lastTimeRef.current > 3000) {
      lastTimeRef.current = now;
      const ts = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      timeLabelsRef.current.push({ x: targetX, time: ts });
    }

    if (isFullRef.current) {
      timeLabelsRef.current = timeLabelsRef.current
        .map(l => ({ ...l, x: l.x - SCROLL_PX }))
        .filter(l => l.x > -60);
    }

    // Eixo Tempo
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, usableH, W, 16);
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    timeLabelsRef.current.forEach(l => {
      ctx.fillText(l.time, l.x, usableH + 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(l.x, 0);
      ctx.lineTo(l.x, usableH);
      ctx.stroke();
    });

    // Eixo Frequência (Dinâmico)
    ctx.font = '9px JetBrains Mono, monospace';
    ctx.textAlign = 'right';
    const ticks = getFreqTicks(maxFreqLimit);
    ticks.forEach(freq => {
      if (freq < minFreq || freq > maxFreq) return;
      const t = (Math.log10(freq) - logMin) / (logMax - logMin);
      const y = usableH - t * usableH;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(W - 44, y - 5, 44, 11);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(`${freq}Hz`, W - 3, y + 3);
      
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W - 46, y);
      ctx.stroke();
    });

    // Overlays extras
    ctx.fillStyle = 'rgba(229,255,0,0.9)';
    const badgeY = usableH - 18;
    ctx.fillRect(4, badgeY, 28, 14);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 9px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('LOG', 7, badgeY + 10);

    ctx.fillStyle = 'rgba(128,128,128,0.6)';
    ctx.fillRect(W - 62, 4, 58, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Spectra', W - 8, 16);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round(maxFreq)}Hz`, 4, 14);

    // Desenhar Padrões de Áudio
    if (patterns.length > 0) {
      patterns.forEach((p, i) => {
        if (!p || !p.label) return;
        const freq = p.frequency || 20;
        const clampedFreq = Math.max(minFreq, Math.min(maxFreq, freq));
        const t = (Math.log10(clampedFreq) - logMin) / (logMax - logMin);
        const y = usableH - t * usableH;
        const x = W - 100 - i * 90;
        if (x < 10) return;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 4.5);
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetX = 1;
        ctx.shadowOffsetY = 1;
        ctx.fillText(p.label, 0, 0);
        ctx.restore();
      });
    }
  }, [fftData, isRecording, patterns, maxFreqLimit]);

  // Executar renderização APENAS quando novos dados de FFT chegarem
  useEffect(() => {
    if (isRecording && fftData) {
      drawFrame();
    }
  }, [fftData, isRecording, drawFrame]);

  return (
    <div className="spectrogram-container" style={{ height: '100%' }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
