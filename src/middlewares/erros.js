'use strict';

// Tratamento de erros: grava no log e responde com o status de cada tipo de erro.

const createError = require('http-errors');
const logger = require('../utils/Logger');
const RespostaErro = require('../utils/RespostaErro');
const { ErroAplicacao } = require('../errors');

// Rota inexistente: gera um erro 404 (igual ao projeto criado pelo
// express-generator).
function rotaNaoEncontrada(req, _res, next) {
  next(createError(404, `Rota nao encontrada: ${req.method} ${req.originalUrl}`));
}

// Indica se o cliente prefere JSON (ex.: Postman/Thunder Client com
// "Accept: application/json") em vez de uma pagina HTML.
function querJson(req) {
  return req.accepts(['html', 'json']) === 'json';
}

// Tratador de erros (4 parametros: e assim que o Express o identifica).
function tratarErros(erro, req, res, next) {
  if (res.headersSent) return next(erro);

  const rota = `${req.method} ${req.originalUrl}`;
  const status = RespostaErro.status(erro);

  // 1. Registro em log
  if (status === 404 && !(erro instanceof ErroAplicacao)) {
    logger.aviso(`Rota inexistente acessada: ${rota}`, { operacao: 'Express.rotaNaoEncontrada' });
  } else if (!erro.registradoEmLog) {
    const operacao = erro instanceof ErroAplicacao ? `${erro.operacao} | ${rota}` : rota;
    logger.erro(erro, { operacao });
  }

  const resposta = RespostaErro.paraUsuario(erro);

  // 2. Sem sessao: volta para o login (apos o login, retorna a pagina pedida)
  if (status === 401 && !querJson(req) && req.session) {
    if (req.method === 'GET') req.session.voltarPara = req.originalUrl;
    req.avisar?.('erro', resposta.mensagem);

    return res.redirect('/login');
  }

  // 3. Resposta em JSON ou em pagina HTML
  if (querJson(req)) {
    return res.status(status).json({ erro: resposta.titulo, mensagem: resposta.mensagem, detalhes: resposta.itens });
  }

  // O erro pode ter ocorrido antes do middleware de avisos (ex.: JSON malformado).
  res.locals.avisos ??= [];
  res.locals.usuarioLogado ??= req.session?.usuario ?? null;
  res.locals.caminhoAtual ??= req.path;

  res.status(status).render('erro', { titulo: resposta.titulo, status, erro: resposta });
}

module.exports = { rotaNaoEncontrada, tratarErros };
