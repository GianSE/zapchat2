'use strict';

// Funcoes usadas por todos os controllers (erros de formulario e sessao).

const logger = require('../utils/Logger');
const RespostaErro = require('../utils/RespostaErro');

class Controlador {
  // Prepara um erro causado pelos dados do usuario para ser exibido de volta
  // no formulario. Qualquer outro erro (falha do banco, erro inesperado) e
  // relancado e segue para o tratador central de erros.
  static erroDoUsuario(erro) {
    if (!RespostaErro.ehErroDoUsuario(erro)) throw erro;

    if (!erro.registradoEmLog) logger.erro(erro);

    return { status: RespostaErro.status(erro), ...RespostaErro.paraUsuario(erro) };
  }

  // Guarda o erro como aviso na sessao, para exibi-lo depois do redirecionamento.
  static avisarErro(req, erro) {
    const { mensagem, itens } = Controlador.erroDoUsuario(erro);
    req.avisar('erro', mensagem, itens);
  }

  // Endereco de retorno informado no formulario (campo oculto "voltar").
  // So aceita caminhos internos, evitando redirecionar para outro site.
  static destinoSeguro(valor, padrao) {
    const caminho = typeof valor === 'string' ? valor.trim() : '';

    return caminho.startsWith('/') && !caminho.startsWith('//') && !caminho.includes('\\') ? caminho : padrao;
  }

  // Caminho da pagina de uma conversa.
  static caminhoConversa(conversaId, ancora = 'fim') {
    return `/conversas/${encodeURIComponent(String(conversaId ?? ''))}${ancora ? `#${ancora}` : ''}`;
  }

  // Sessao

  // Cria a sessao autenticada do usuario.
  //
  // O identificador da sessao e regenerado no login, para que um identificador
  // obtido antes da autenticacao nao possa ser reaproveitado (session fixation).
  static async iniciarSessao(req, usuario) {
    await new Promise((resolver, rejeitar) => req.session.regenerate((erro) => (erro ? rejeitar(erro) : resolver())));

    req.session.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      nomeExibicao: usuario.nomeExibicao,
      email: usuario.email,
      avatar: usuario.avatar
    };
    req.session.iniciadaEm = new Date().toISOString();

    await Controlador.salvarSessao(req);
  }

  // Grava a sessao antes do redirecionamento.
  static salvarSessao(req) {
    return new Promise((resolver, rejeitar) => req.session.save((erro) => (erro ? rejeitar(erro) : resolver())));
  }

  // Encerra a sessao (logout): apaga os dados no servidor e o cookie no navegador.
  static async encerrarSessao(req, res) {
    await new Promise((resolver, rejeitar) => req.session.destroy((erro) => (erro ? rejeitar(erro) : resolver())));

    res.clearCookie(Controlador.NOME_COOKIE_SESSAO);
  }
}

// Nome do cookie que guarda o identificador da sessao.
Controlador.NOME_COOKIE_SESSAO = 'zapchat.sid';

module.exports = Controlador;
