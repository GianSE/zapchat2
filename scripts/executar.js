'use strict';

// Conecta no banco, executa a rotina do script e fecha a conexao.

const Database = require('../src/database/Database');
const logger = require('../src/utils/Logger');
const config = require('../src/config/config');
const { ErroAplicacao, ErroConexao } = require('../src/errors');

async function executar(nome, rotina) {
  const banco = Database.obterInstancia();

  try {
    await banco.conectar();
    await rotina();
    logger.info(`Rotina "${nome}" finalizada com sucesso`, { operacao: `scripts/${nome}` });
  } catch (erro) {
    process.exitCode = 1;

    if (!erro.registradoEmLog) logger.erro(erro, { operacao: `scripts/${nome}` });

    if (erro instanceof ErroConexao) {
      console.error(`\nNao foi possivel conectar ao MongoDB em ${config.mongo.uri}.`);
      console.error('Verifique se o servico esta em execucao (Get-Service MongoDB / net start MongoDB).');
    } else if (erro instanceof ErroAplicacao) {
      console.error(`\n${erro.name}: ${erro.message}`);
    } else {
      console.error(`\nErro inesperado em "${nome}": ${erro.message}`);
    }

    console.error(`Detalhes registrados em: ${logger.arquivos.erros}`);
  } finally {
    await banco.desconectar();
  }
}

module.exports = executar;
