'use strict';

// Funcoes usadas nas views para formatar datas, status e reacoes.

const FUSO = 'America/Sao_Paulo';

class Formatacao {
  // Data e hora no formato dd/mm/aaaa hh:mm.
  static dataHora(valor) {
    if (!valor) return '-';

    return new Date(valor).toLocaleString('pt-BR', {
      timeZone: FUSO,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Somente a hora (hh:mm) quando a data e de hoje; caso contrario, dd/mm.
  static horaCurta(valor) {
    if (!valor) return '';

    const data = new Date(valor);
    const opcoesDia = { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' };
    const hoje = new Date().toLocaleDateString('pt-BR', opcoesDia);

    if (data.toLocaleDateString('pt-BR', opcoesDia) === hoje) {
      return data.toLocaleTimeString('pt-BR', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' });
    }

    return data.toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit' });
  }

  // Rotulo do status de presenca.
  static status(status) {
    const rotulos = { online: 'Online', ausente: 'Ausente', ocupado: 'Ocupado', offline: 'Offline' };
    return rotulos[status] ?? status ?? '-';
  }

  // Agrupa a lista de reacoes de uma mensagem por emoji.
  static agruparReacoes(reacoes = [], usuarioId = null) {
    const grupos = new Map();

    for (const { emoji, usuarioId: autor } of reacoes) {
      const grupo = grupos.get(emoji) ?? { emoji, total: 0, minha: false };

      grupo.total += 1;
      if (String(autor) === String(usuarioId)) grupo.minha = true;

      grupos.set(emoji, grupo);
    }

    return [...grupos.values()];
  }
}

module.exports = Formatacao;
