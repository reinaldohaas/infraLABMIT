import { useMemo } from 'react';

/**
 * Hook de inteligência de tempestades.
 *
 * Combina dados meteorológicos (Yr), clima espacial e infrassom
 * para calcular uma avaliação de risco de tempestade.
 *
 * @param {Object} params
 * @param {Object} params.yr - Dados de previsão do Yr
 * @param {Object} params.spaceWeather - Dados de clima espacial (Kp, flares)
 * @param {number} params.spl - Nível de pressão sonora em dB
 * @param {number} params.dominantFreq - Frequência dominante em Hz
 * @param {boolean} params.isRecording - Se a gravação está ativa
 * @returns {{ riskScore: number, riskLevel: string, message: string, suggestion: string, factors: string[] }}
 */
export function useStormIntelligence({ yr, spaceWeather, spl, dominantFreq, isRecording }) {

  /**
   * Verifica se a previsão do Yr contém trovoada ou chuva forte
   * nas próximas 6 horas.
   */
  const verificarPrevisaoSevera = (forecast) => {
    if (!forecast || !Array.isArray(forecast)) return false;

    // Considera as próximas 6 entradas da previsão como proxy para 6 horas
    const proximasHoras = forecast.slice(0, 6);

    return proximasHoras.some((periodo) => {
      if (!periodo) return false;

      // Verifica diferentes formatos possíveis de dados do Yr
      const simbolo = periodo.symbol || periodo.symbolCode || '';
      const simboloMinusculo = simbolo.toLowerCase();

      // Trovoada ou chuva forte indicam condições severas
      return (
        simboloMinusculo.includes('thunder') ||
        simboloMinusculo.includes('heavyrain') ||
        simboloMinusculo.includes('heavy_rain') ||
        simboloMinusculo.includes('storm')
      );
    });
  };

  /**
   * Verifica se há queda de pressão significativa (>3 hPa em 6 horas)
   * nos dados de previsão do Yr.
   */
  const verificarQuedaPressao = (forecast) => {
    if (!forecast || !Array.isArray(forecast) || forecast.length < 2) return false;

    // Extrai valores de pressão das previsões
    const valoresPressao = forecast
      .slice(0, 6)
      .map((p) => {
        if (!p) return null;
        // Tenta acessar pressão em diferentes formatos do Yr
        return p.pressure || (p.details && p.details.air_pressure_at_sea_level) || null;
      })
      .filter((v) => v !== null);

    if (valoresPressao.length < 2) return false;

    // Calcula a diferença entre o primeiro e o último valor
    const primeiro = valoresPressao[0];
    const ultimo = valoresPressao[valoresPressao.length - 1];
    return primeiro - ultimo > 3;
  };

  /**
   * Resultado principal: avaliação de risco calculada a partir de múltiplos fatores.
   */
  const avaliacao = useMemo(() => {
    let pontuacao = 0;
    const fatores = [];

    // --- Fator 1: Previsão Yr (trovoada/chuva forte nas próximas 6h) ---
    if (yr && !yr.loading && yr.forecast) {
      if (yr.stormWarning || verificarPrevisaoSevera(yr.forecast)) {
        pontuacao += 30;
        fatores.push('Previsão Yr indica trovoada ou chuva forte nas próximas 6 horas (+30)');
      }

      // Fator 2: Queda de pressão atmosférica
      if (verificarQuedaPressao(yr.forecast)) {
        pontuacao += 15;
        fatores.push('Pressão atmosférica em queda (>3 hPa em 6h) (+15)');
      }
    }

    // --- Fator 3: Índice Kp (atividade geomagnética) ---
    if (spaceWeather && !spaceWeather.loading && spaceWeather.kpIndex) {
      const kp = spaceWeather.kpIndex.value;

      if (typeof kp === 'number') {
        if (kp >= 7) {
          // Tempestade geomagnética severa — usa 30 pontos (não cumulativo com Kp>=5)
          pontuacao += 30;
          fatores.push(`Tempestade geomagnética severa — índice Kp = ${kp} (+30)`);
        } else if (kp >= 5) {
          pontuacao += 20;
          fatores.push(`Atividade geomagnética elevada — índice Kp = ${kp} (+20)`);
        }
      }
    }

    // --- Fator 4: Erupções solares (flares) ---
    if (spaceWeather && !spaceWeather.loading && spaceWeather.flareClass) {
      const classificacao = (spaceWeather.flareClass.classification || '').toUpperCase();

      if (classificacao.startsWith('X')) {
        pontuacao += 20;
        fatores.push(`Erupção solar classe X detectada (${classificacao}) (+20)`);
      } else if (classificacao.startsWith('M')) {
        pontuacao += 10;
        fatores.push(`Erupção solar classe M detectada (${classificacao}) (+10)`);
      }
    }

    // --- Fator 5: Anomalia de infrassom ---
    if (isRecording && typeof spl === 'number' && typeof dominantFreq === 'number') {
      if (spl > -40 && dominantFreq < 5) {
        pontuacao += 25;
        fatores.push(
          `Anomalia de infrassom detectada — SPL: ${spl.toFixed(1)} dB, freq. dominante: ${dominantFreq.toFixed(1)} Hz (+25)`
        );
      }
    }

    // --- Fator 6: Geografia Local ---
    const geography = localStorage.getItem('labmit_geography');
    if (geography === 'encosta' && verificarPrevisaoSevera(yr?.forecast)) {
      pontuacao += 20;
      fatores.push('Risco agravado: Área de encosta/morro sob previsão severa (+20)');
    } else if (geography === 'litoral' && yr?.forecast) {
      // Simulação: assumimos vento mais forte no litoral; na prática poderíamos ler `wind_speed`
      pontuacao += 15;
      fatores.push('Risco agravado: Área litorânea sujeita a ventanias costeiras (+15)');
    } else if (geography === 'vale') {
      pontuacao += 10;
      fatores.push('Atenção: Áreas de vale retêm umidade e neblina (+10)');
    }

    // Limita a pontuação ao intervalo 0–100
    const pontuacaoFinal = Math.min(100, Math.max(0, pontuacao));

    // Determina nível de risco com base na pontuação
    let nivel;
    if (pontuacaoFinal >= 76) {
      nivel = 'critical';
    } else if (pontuacaoFinal >= 51) {
      nivel = 'high';
    } else if (pontuacaoFinal >= 26) {
      nivel = 'medium';
    } else {
      nivel = 'low';
    }

    // Mensagens em português para cada nível
    const mensagens = {
      low: 'Condições normais — sem risco iminente',
      medium: 'Atenção — condições atmosféricas em mudança',
      high: 'Alerta — alta probabilidade de tempestade nas próximas horas',
      critical: 'PERIGO — tempestade iminente! Recomenda-se abrigo',
    };

    // Sugestões de ação para cada nível
    const sugestoes = {
      low: 'Monitoramento de rotina',
      medium: 'Recomenda-se gravação contínua',
      high: 'Gravação intensiva ativada — verificar abrigo',
      critical: 'Procure abrigo imediatamente!',
    };

    return {
      riskScore: pontuacaoFinal,
      riskLevel: nivel,
      message: mensagens[nivel],
      suggestion: sugestoes[nivel],
      factors: fatores,
    };
  }, [yr, spaceWeather, spl, dominantFreq, isRecording]);

  return avaliacao;
}
