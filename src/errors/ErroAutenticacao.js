'use strict';

const ErroAplicacao = require('./ErroAplicacao');

/**
 * Erro lancado quando a identificacao do usuario falha: credenciais
 * incorretas no login ou tentativa de acessar uma funcionalidade protegida
 * sem uma sessao autenticada.
 *
 * Adicionado no Projeto 2 para diferenciar a falha de login (HTTP 401) das
 * demais regras de negocio.
 *
 * @extends ErroAplicacao
 */
class ErroAutenticacao extends ErroAplicacao {}

module.exports = ErroAutenticacao;
