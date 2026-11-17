'use strict';

/**
 * Middleware de avisos (mensagens "flash").
 *
 * Depois de um POST a aplicacao redireciona o navegador (padrao
 * Post/Redirect/Get). Para que a mensagem de sucesso ou de erro sobreviva ao
 * redirecionamento, ela e guardada na SESSAO e exibida uma unica vez na
 * proxima pagina renderizada.
 *
 * Tambem disponibiliza para todas as views o usuario guardado na sessao.
 */

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function avisos(req, res, next) {
  // Avisos gravados na requisicao anterior: exibidos agora e descartados.
  res.locals.avisos = req.session.avisos ?? [];
  if (req.session.avisos) delete req.session.avisos;

  // Dados basicos do usuario logado (o middleware de autenticacao os atualiza).
  res.locals.usuarioLogado = req.session.usuario ?? null;
  res.locals.caminhoAtual = req.path;

  /**
   * Registra um aviso para a proxima pagina.
   *
   * @param {'sucesso'|'erro'|'info'} tipo Tipo do aviso.
   * @param {string} texto Mensagem exibida.
   * @param {string[]} [itens] Detalhes (por exemplo, cada campo invalido).
   */
  req.avisar = (tipo, texto, itens = []) => {
    req.session.avisos = [...(req.session.avisos ?? []), { tipo, texto, itens }];
  };

  next();
}

module.exports = avisos;
