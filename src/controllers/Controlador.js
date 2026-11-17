'use strict';

/**
 * Funcoes de apoio compartilhadas pelos controllers (camada CONTROLLER).
 *
 * Concentra o que se repete em todas as rotas:
 *   - decidir se um erro deve voltar ao formulario ou ir ao tratador central;
 *   - criar e encerrar a sessao do usuario (express-session);
 *   - montar enderecos de retorno seguros.
 */

const logger = require('../utils/Logger');
const RespostaErro = require('../utils/RespostaErro');

class Controlador {
  /**
   * Prepara um erro causado pelos dados do usuario para ser exibido de volta
   * no formulario. Qualquer outro erro (falha do banco, erro inesperado) e
   * relancado e segue para o tratador central de erros.
   *
   * @param {Error} erro Excecao capturada.
   * @returns {{status: number, titulo: string, mensagem: string, itens: string[]}}
   * @throws {Error} Quando o erro nao e causado pelos dados do usuario.
   */
  static erroDoUsuario(erro) {
    if (!RespostaErro.ehErroDoUsuario(erro)) throw erro;

    if (!erro.registradoEmLog) logger.erro(erro);

    return { status: RespostaErro.status(erro), ...RespostaErro.paraUsuario(erro) };
  }

  /**
   * Guarda o erro como aviso na sessao, para exibi-lo depois do redirecionamento.
   *
   * @param {import('express').Request} req
   * @param {Error} erro
   * @returns {void}
   * @throws {Error} Quando o erro nao e causado pelos dados do usuario.
   */
  static avisarErro(req, erro) {
    const { mensagem, itens } = Controlador.erroDoUsuario(erro);
    req.avisar('erro', mensagem, itens);
  }

  /**
   * Endereco de retorno informado no formulario (campo oculto "voltar").
   * So aceita caminhos internos, evitando redirecionar para outro site.
   *
   * @param {*} valor Caminho recebido.
   * @param {string} padrao Caminho usado quando o valor e invalido.
   * @returns {string}
   */
  static destinoSeguro(valor, padrao) {
    const caminho = typeof valor === 'string' ? valor.trim() : '';

    return caminho.startsWith('/') && !caminho.startsWith('//') && !caminho.includes('\\') ? caminho : padrao;
  }

  /**
   * Caminho da pagina de uma conversa.
   *
   * @param {*} conversaId
   * @param {string} [ancora] Ancora na pagina (ex.: "fim").
   * @returns {string}
   */
  static caminhoConversa(conversaId, ancora = 'fim') {
    return `/conversas/${encodeURIComponent(String(conversaId ?? ''))}${ancora ? `#${ancora}` : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Sessao
  // ---------------------------------------------------------------------------

  /**
   * Cria a sessao autenticada do usuario.
   *
   * O identificador da sessao e regenerado no login, para que um identificador
   * obtido antes da autenticacao nao possa ser reaproveitado (session fixation).
   *
   * @param {import('express').Request} req
   * @param {import('../models/Usuario')} usuario Usuario autenticado.
   * @returns {Promise<void>}
   */
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

  /**
   * Grava a sessao antes do redirecionamento.
   *
   * @param {import('express').Request} req
   * @returns {Promise<void>}
   */
  static salvarSessao(req) {
    return new Promise((resolver, rejeitar) => req.session.save((erro) => (erro ? rejeitar(erro) : resolver())));
  }

  /**
   * Encerra a sessao (logout): apaga os dados no servidor e o cookie no navegador.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  static async encerrarSessao(req, res) {
    await new Promise((resolver, rejeitar) => req.session.destroy((erro) => (erro ? rejeitar(erro) : resolver())));

    res.clearCookie(Controlador.NOME_COOKIE_SESSAO);
  }
}

/** Nome do cookie que guarda o identificador da sessao. */
Controlador.NOME_COOKIE_SESSAO = 'zapchat.sid';

module.exports = Controlador;
