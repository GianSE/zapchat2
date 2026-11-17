'use strict';

const ErroAplicacao = require('./ErroAplicacao');

/**
 * Erro lancado quando o usuario esta autenticado, mas tenta agir sobre um
 * registro que nao lhe pertence (editar o contato de outra pessoa, alterar um
 * grupo sem ser administrador, editar a mensagem de outro autor...).
 *
 * Adicionado no Projeto 2: corresponde ao HTTP 403.
 *
 * @extends ErroAplicacao
 */
class ErroPermissao extends ErroAplicacao {}

module.exports = ErroPermissao;
