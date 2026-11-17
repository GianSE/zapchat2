'use strict';

/**
 * Ponto unico de importacao das excecoes da aplicacao.
 *
 * Hierarquia:
 *   Error
 *     └── ErroAplicacao
 *           ├── ErroValidacao       (400 - dados ausentes ou invalidos)
 *           ├── ErroAutenticacao    (401 - login incorreto / sem sessao)   [Projeto 2]
 *           ├── ErroPermissao       (403 - registro de outro usuario)      [Projeto 2]
 *           ├── ErroNaoEncontrado   (404 - registro inexistente)
 *           ├── ErroRegraNegocio    (409 - regra da tematica violada)
 *           ├── ErroBanco           (500 - falha do MongoDB Driver)
 *           └── ErroConexao         (503 - MongoDB indisponivel)
 */

module.exports = {
  ErroAplicacao: require('./ErroAplicacao'),
  ErroValidacao: require('./ErroValidacao'),
  ErroAutenticacao: require('./ErroAutenticacao'),
  ErroPermissao: require('./ErroPermissao'),
  ErroNaoEncontrado: require('./ErroNaoEncontrado'),
  ErroRegraNegocio: require('./ErroRegraNegocio'),
  ErroBanco: require('./ErroBanco'),
  ErroConexao: require('./ErroConexao')
};
