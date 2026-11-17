'use strict';

// Painel inicial e estatisticas.

const ChatService = require('../services/ChatService');

class PainelController {
  // GET / - envia para o painel (logado) ou para o login (visitante).
  static inicio(req, res) {
    res.redirect(req.session.usuario ? '/painel' : '/login');
  }

  // GET /painel - conversas, mensagens nao lidas e agenda do usuario logado.
  // Reaproveita ChatService.painelDoUsuario, criado no Projeto 1.
  static async exibir(req, res) {
    const painel = await ChatService.painelDoUsuario(req.usuario.id);
    const naoLidas = new Map(painel.naoLidas.map((item) => [String(item.conversaId), item.naoLidas]));

    res.render('painel', {
      titulo: 'Painel',
      usuario: painel.usuario.paraJSON(),
      conversas: painel.conversas.slice(0, 6).map((conversa) => ({
        ...conversa,
        id: String(conversa._id),
        naoLidas: naoLidas.get(String(conversa._id)) ?? 0
      })),
      totalConversas: painel.conversas.length,
      totalNaoLidas: painel.totalNaoLidas,
      agenda: painel.agenda.filter((contato) => !contato.bloqueado).slice(0, 8),
      totalContatos: painel.agenda.length
    });
  }

  // GET /estatisticas - numeros gerais do ZapChat (agregacoes do MongoDB).
  static async estatisticas(req, res) {
    const estatisticas = await ChatService.estatisticasGerais();

    res.render('estatisticas', { titulo: 'Estatísticas', estatisticas });
  }
}

module.exports = PainelController;
