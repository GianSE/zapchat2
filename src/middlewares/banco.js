'use strict';

// Conecta no MongoDB antes das rotas. Se o banco cair, tenta reconectar.

const Database = require('../database/Database');

async function garantirConexao(_req, _res, next) {
  const banco = Database.obterInstancia();

  if (!banco.conectado) await banco.conectar();

  next();
}

module.exports = garantirConexao;
