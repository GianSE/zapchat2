'use strict';

// Cria os indices. Opcional: o servidor ja faz isso ao iniciar. Uso: npm run setup

const executar = require('./executar');
const Manutencao = require('../src/database/Manutencao');
const config = require('../src/config/config');

executar('setup', async () => {
  console.log(`Banco: ${config.mongo.banco} | URI: ${config.mongo.uri}\n`);

  await Manutencao.criarIndices();
  console.table(await Manutencao.listarIndices());
  console.table(await Manutencao.contarDocumentos());

  console.log('Banco de dados preparado. Use "npm run seed" para carregar os dados de exemplo.');
});
