'use strict';

/**
 * Middlewares de autenticacao baseados em SESSAO (express-session).
 *
 * Ao fazer login, o controller grava em req.session.usuario os dados basicos
 * do usuario. O navegador recebe apenas um cookie com o identificador da
 * sessao (zapchat.sid); os dados ficam no servidor.
 *
 * Em cada requisicao a uma rota protegida, "exigirLogin" verifica se existe
 * usuario na sessao e se ele ainda existe no MongoDB. Caso contrario, lanca
 * ErroAutenticacao, que o tratador de erros transforma em redirecionamento
 * para a pagina de login (ou em HTTP 401 para clientes que pedem JSON).
 */

const { Usuario } = require('../models');
const { ErroAutenticacao } = require('../errors');

/**
 * Bloqueia o acesso de quem nao fez login.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 * @throws {ErroAutenticacao}
 */
async function exigirLogin(req, res, next) {
  const operacao = 'autenticacao.exigirLogin';
  const idDaSessao = req.session.usuario?.id;

  if (!idDaSessao) {
    throw new ErroAutenticacao('Voce precisa entrar no ZapChat para acessar esta funcionalidade', {
      operacao,
      detalhes: { rota: `${req.method} ${req.originalUrl}`, ip: req.ip }
    });
  }

  // A conta pode ter sido excluida em outra sessao: confere no banco.
  const usuario = await Usuario.buscarPorId(idDaSessao);

  if (!usuario) {
    delete req.session.usuario;

    throw new ErroAutenticacao('Sua sessao expirou porque a conta nao existe mais', {
      operacao,
      detalhes: { usuarioId: idDaSessao }
    });
  }

  // Disponibiliza o usuario para os controllers (req.usuario) e para as views.
  req.usuario = usuario;
  res.locals.usuarioLogado = { ...usuario.paraJSON(), id: usuario.id };

  next();
}

/**
 * Impede que um usuario ja logado abra as paginas de login e cadastro.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function somenteVisitante(req, res, next) {
  if (req.session.usuario) return res.redirect('/painel');
  next();
}

module.exports = { exigirLogin, somenteVisitante };
