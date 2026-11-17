'use strict';

// Apaga todos os documentos (os indices continuam). Uso: npm run reset

const executar = require('./executar');
const Manutencao = require('../src/database/Manutencao');
const config = require('../src/config/config');

executar('reset', async () => {
  console.log(`Limpando o banco "${config.mongo.banco}"...`);
  console.table(await Manutencao.limparColecoes());
  console.log('Banco de dados limpo.');
});
