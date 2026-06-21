import { useRef, useMemo, useCallback } from 'react';

/**
 * Hook para detecção de padrões acústicos a partir de dados FFT.
 *
 * Analisa o espectro de frequência e classifica padrões com base
 * em heurísticas simples (sem aprendizado de máquina).
 *
 * @param {Object} params
 * @param {Object|null} params.fftData - Dados FFT do analisador de áudio
 * @param {boolean} params.isRecording - Se a gravação está ativa
 * @returns {{ patterns: Array<{type: string, label: string, frequency: number, confidence: number}> }}
 */
export function usePatternDetector({ fftData, isRecording }) {
  // Contador de detecções consecutivas por tipo de padrão
  const consecutiveRef = useRef({
    speech: 0,
    whistle: 0,
    infrasound: 0,
    motor: 0,
    click: 0,
  });

  // Mínimo de detecções consecutivas para confirmar um padrão
  const MIN_CONSECUTIVE = 5;

  /**
   * Calcula a energia média (em dB) de uma faixa de bins.
   * Retorna -Infinity se a faixa for inválida.
   */
  const calcularEnergiaBanda = useCallback((data, binInicio, binFim) => {
    if (binInicio < 0 || binFim >= data.length || binInicio > binFim) {
      return -Infinity;
    }
    let soma = 0;
    let contagem = 0;
    for (let i = binInicio; i <= binFim; i++) {
      soma += data[i];
      contagem++;
    }
    return contagem > 0 ? soma / contagem : -Infinity;
  }, []);

  /**
   * Converte uma frequência em Hz para o índice do bin correspondente.
   */
  const freqParaBin = useCallback((freqHz, freqPerBin) => {
    return Math.round(freqHz / freqPerBin);
  }, []);

  /**
   * Detecta padrão de fala (85–300 Hz com harmônicos em 300–3000 Hz).
   */
  const detectarFala = useCallback((data, freqPerBin) => {
    const binInicio = freqParaBin(85, freqPerBin);
    const binFim = freqParaBin(300, freqPerBin);
    const binHarmInicio = freqParaBin(300, freqPerBin);
    const binHarmFim = freqParaBin(3000, freqPerBin);

    const energiaFundamental = calcularEnergiaBanda(data, binInicio, binFim);
    const energiaHarmonicos = calcularEnergiaBanda(data, binHarmInicio, binHarmFim);
    const energiaTotal = calcularEnergiaBanda(data, 0, data.length - 1);

    // Fundamental precisa estar acima da média geral e harmônicos presentes
    const diferencaFundamental = energiaFundamental - energiaTotal;
    const diferencaHarmonicos = energiaHarmonicos - energiaTotal;

    if (diferencaFundamental > 12 && diferencaHarmonicos > 8) {
      // Confiança baseada na intensidade relativa da fundamental
      const confianca = Math.min(1, (diferencaFundamental - 6) / 20 + 0.4);
      // Frequência dominante na faixa de fala
      let picoFreq = 0;
      let picoDb = -Infinity;
      for (let i = binInicio; i <= binFim && i < data.length; i++) {
        if (data[i] > picoDb) {
          picoDb = data[i];
          picoFreq = i * freqPerBin;
        }
      }
      return { type: 'speech', label: 'Fala', frequency: picoFreq, confidence: confianca };
    }
    return null;
  }, [calcularEnergiaBanda, freqParaBin]);

  /**
   * Detecta assovio (pico estreito entre 500–4000 Hz, ≤3 bins de largura).
   */
  const detectarAssovio = useCallback((data, freqPerBin) => {
    const binInicio = freqParaBin(500, freqPerBin);
    const binFim = Math.min(freqParaBin(4000, freqPerBin), data.length - 1);
    const energiaMedia = calcularEnergiaBanda(data, binInicio, binFim);

    let picoDb = -Infinity;
    let picoBin = -1;

    // Encontra o pico na faixa do assovio
    for (let i = binInicio; i <= binFim; i++) {
      if (data[i] > picoDb) {
        picoDb = data[i];
        picoBin = i;
      }
    }

    if (picoBin < 0) return null;

    // Verifica se o pico é estreito (energia cai rapidamente nos vizinhos)
    const LARGURA_MAX = 3; // bins
    let binsAcima = 0;
    const limiar = picoDb - 10; // 10 dB abaixo do pico

    for (let i = Math.max(binInicio, picoBin - LARGURA_MAX); i <= Math.min(binFim, picoBin + LARGURA_MAX); i++) {
      if (data[i] > limiar) {
        binsAcima++;
      }
    }

    // Pico estreito e significativamente acima da média
    const diferencaPico = picoDb - energiaMedia;
    if (binsAcima <= LARGURA_MAX && diferencaPico > 15) {
      const confianca = Math.min(1, (diferencaPico - 15) / 15 + 0.5);
      return {
        type: 'whistle',
        label: 'Assovio',
        frequency: picoBin * freqPerBin,
        confidence: confianca,
      };
    }
    return null;
  }, [calcularEnergiaBanda, freqParaBin]);

  /**
   * Detecta infrassom (energia dominante abaixo de 20 Hz).
   */
  const detectarInfrassom = useCallback((data, freqPerBin) => {
    const binLimite = freqParaBin(20, freqPerBin);
    if (binLimite < 1) return null;

    const energiaInfra = calcularEnergiaBanda(data, 0, binLimite);
    // Comparar com energia acima de 20 Hz (até 200 Hz como referência)
    const binRef = Math.min(freqParaBin(200, freqPerBin), data.length - 1);
    const energiaRef = calcularEnergiaBanda(data, binLimite + 1, binRef);

    const diferenca = energiaInfra - energiaRef;

    if (diferenca > 6) {
      // Encontra a frequência dominante no infrassom
      let picoDb = -Infinity;
      let picoFreq = 0;
      for (let i = 0; i <= binLimite && i < data.length; i++) {
        if (data[i] > picoDb) {
          picoDb = data[i];
          picoFreq = i * freqPerBin;
        }
      }
      const confianca = Math.min(1, (diferenca - 6) / 18 + 0.4);
      return { type: 'infrasound', label: 'Infrassom', frequency: picoFreq, confidence: confianca };
    }
    return null;
  }, [calcularEnergiaBanda, freqParaBin]);

  /**
   * Detecta motor/máquina (harmônicos regulares em 50, 100, 150, 200 Hz).
   */
  const detectarMotor = useCallback((data, freqPerBin) => {
    const frequenciasHarmonicas = [50, 100, 150, 200];
    const energiaTotal = calcularEnergiaBanda(data, 0, data.length - 1);

    let harmonicosDetectados = 0;
    let somaConfianca = 0;

    for (const freq of frequenciasHarmonicas) {
      const bin = freqParaBin(freq, freqPerBin);
      if (bin >= 0 && bin < data.length) {
        // Verifica se o bin tem energia acima da média
        const diferenca = data[bin] - energiaTotal;
        if (diferenca > 10) {
          harmonicosDetectados++;
          somaConfianca += diferenca;
        }
      }
    }

    // Precisa de pelo menos 3 dos 4 harmônicos presentes
    if (harmonicosDetectados >= 3) {
      const confianca = Math.min(1, (somaConfianca / harmonicosDetectados - 6) / 15 + 0.5);
      return { type: 'motor', label: 'Motor', frequency: 50, confidence: confianca };
    }
    return null;
  }, [calcularEnergiaBanda, freqParaBin]);

  /**
   * Detecta estalo/clique (energia de banda larga >20 dB acima da média).
   */
  const detectarEstalo = useCallback((data) => {
    // Calcula a média geral
    let soma = 0;
    for (let i = 0; i < data.length; i++) {
      soma += data[i];
    }
    const media = soma / data.length;

    // Conta quantos bins estão muito acima da média (banda larga)
    let binsAltos = 0;
    let picoDb = -Infinity;
    let picoBin = 0;
    const LIMIAR_ESTALO = 20; // dB acima da média

    for (let i = 0; i < data.length; i++) {
      if (data[i] - media > LIMIAR_ESTALO) {
        binsAltos++;
        if (data[i] > picoDb) {
          picoDb = data[i];
          picoBin = i;
        }
      }
    }

    // Estalo é banda larga: muitos bins acima do limiar
    const proporcaoBinsAltos = binsAltos / data.length;
    if (proporcaoBinsAltos > 0.3 && picoDb - media > LIMIAR_ESTALO) {
      const confianca = Math.min(1, (picoDb - media - LIMIAR_ESTALO) / 20 + 0.5);
      return { type: 'click', label: 'Estalo', frequency: 0, confidence: confianca };
    }
    return null;
  }, []);

  /**
   * Resultado final: padrões detectados (máximo 2, maior confiança).
   * Usa useRef para rastrear detecções consecutivas e confirmar padrões.
   */
  const patterns = useMemo(() => {
    // Se não está gravando ou sem dados, limpa contadores e retorna vazio
    if (!isRecording || !fftData || !fftData.data || fftData.data.length === 0) {
      const contadores = consecutiveRef.current;
      contadores.speech = 0;
      contadores.whistle = 0;
      contadores.infrasound = 0;
      contadores.motor = 0;
      contadores.click = 0;
      return [];
    }

    const { data, freqPerBin } = fftData;

    // Executa todos os detectores
    const candidatos = [
      detectarFala(data, freqPerBin),
      detectarAssovio(data, freqPerBin),
      detectarInfrassom(data, freqPerBin),
      detectarMotor(data, freqPerBin),
      detectarEstalo(data),
    ];

    // Lista dos tipos para indexação
    const tipos = ['speech', 'whistle', 'infrasound', 'motor', 'click'];
    const contadores = consecutiveRef.current;

    // Atualiza contadores de detecções consecutivas
    tipos.forEach((tipo, idx) => {
      if (candidatos[idx]) {
        contadores[tipo]++;
      } else {
        contadores[tipo] = 0;
      }
    });

    // Filtra apenas padrões confirmados (3+ detecções consecutivas)
    const confirmados = candidatos.filter((c, idx) => {
      return c !== null && contadores[tipos[idx]] >= MIN_CONSECUTIVE;
    });

    // Ordena por confiança decrescente e retorna no máximo 2
    confirmados.sort((a, b) => b.confidence - a.confidence);
    return confirmados.slice(0, 2);
  }, [
    fftData,
    isRecording,
    detectarFala,
    detectarAssovio,
    detectarInfrassom,
    detectarMotor,
    detectarEstalo,
  ]);

  return { patterns };
}
