'use strict';

/**
 * Executa uma rotina de manutencao do banco (setup, seed, reset) com o mesmo
 * cuidado do Projeto 1: conecta, executa, trata as excecoes, registra no log
 * e sempre fecha a conexao.
 */

const Database = require('../src/database/Database');
const logger = require('../src/utils/Logger');
const config = require('../src/config/config');
const { ErroAplicacao, ErroConexao } = require('../src/errors');

/**
 * @param {string} nome Nome da rotina (para o log).
 * @param {() => Promise<void>} rotina Rotina a executar.
 * @returns {Promise<void>}
 */
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
