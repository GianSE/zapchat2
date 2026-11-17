'use strict';

/**
 * Middleware que garante a conexao com o MongoDB antes de executar as rotas.
 *
 * Se o MongoDB estiver fora do ar quando o servidor iniciar, a aplicacao NAO
 * e encerrada: cada requisicao tenta reconectar. Enquanto o banco estiver
 * indisponivel, Database.conectar() lanca ErroConexao, que o tratador de
 * erros transforma em uma pagina "503 - Banco de dados indisponivel".
 */

const Database = require('../database/Database');

/**
 * @param {import('express').Request} _req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
async function garantirConexao(_req, _res, next) {
  const banco = Database.obterInstancia();

  if (!banco.conectado) await banco.conectar();

  next();
}

module.exports = garantirConexao;
