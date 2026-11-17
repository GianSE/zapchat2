'use strict';

/**
 * Aplicacao Express do ZapChat 2.
 *
 * Estrutura baseada no projeto gerado pelo express-generator
 * (app.js + bin/www + routes + views + public), organizada em MVC:
 *   - Model:      src/models e src/services   (reaproveitados do Projeto 1)
 *   - View:       src/views                   (templates EJS)
 *   - Controller: src/controllers             (recebem a requisicao e chamam o Model)
 *   - Rotas:      src/routes                  (ligam URL + metodo HTTP ao controller)
 *
 * O servidor HTTP e iniciado em bin/www.
 */

const path = require('node:path');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const config = require('./src/config/config');
const Formatacao = require('./src/utils/Formatacao');
const avisos = require('./src/middlewares/avisos');
const garantirConexao = require('./src/middlewares/banco');
const { rotaNaoEncontrada, tratarErros } = require('./src/middlewares/erros');
const Controlador = require('./src/controllers/Controlador');

const rotasIndex = require('./src/routes/index');
const rotasAutenticacao = require('./src/routes/autenticacao');
const rotasUsuarios = require('./src/routes/usuarios');
const rotasContatos = require('./src/routes/contatos');
const rotasConversas = require('./src/routes/conversas');
const rotasMensagens = require('./src/routes/mensagens');

const app = express();

// --- Templates (View) ---------------------------------------------------------
app.set('views', path.join(__dirname, 'src', 'views'));
app.set('view engine', 'ejs');

// Funcoes de formatacao disponiveis em todos os templates.
app.locals.formatar = Formatacao;
app.locals.nomeApp = 'ZapChat 2';

// --- Middlewares ---------------------------------------------------------------
app.use(morgan('dev')); // registra cada requisicao no terminal
app.use(express.json()); // corpo POST em JSON (ferramentas de teste de API)
app.use(express.urlencoded({ extended: false })); // corpo POST de formularios HTML
app.use(cookieParser()); // req.cookies
app.use(express.static(path.join(__dirname, 'public')));

// Sessao: o navegador guarda apenas o cookie "zapchat.sid" com o identificador;
// os dados da sessao (usuario logado, avisos) ficam no servidor.
app.use(
  session({
    name: Controlador.NOME_COOKIE_SESSAO,
    secret: config.sessao.segredo,
    resave: false, // nao regrava a sessao se nada mudou
    saveUninitialized: false, // so cria a sessao quando algo e gravado nela
    rolling: true, // renova o prazo a cada requisicao
    cookie: {
      httpOnly: true, // inacessivel ao JavaScript da pagina
      sameSite: 'lax', // nao e enviado em POST vindo de outro site
      maxAge: config.sessao.duracaoMinutos * 60 * 1000
    }
  })
);

app.use(avisos);
app.use(garantirConexao);

// --- Rotas ---------------------------------------------------------------------
app.use('/', rotasIndex);
app.use('/', rotasAutenticacao);
app.use('/', rotasUsuarios);
app.use('/contatos', rotasContatos);
app.use('/conversas', rotasConversas);
app.use('/mensagens', rotasMensagens);

// --- Erros ---------------------------------------------------------------------
app.use(rotaNaoEncontrada); // 404
app.use(tratarErros); // tratamento centralizado + log

module.exports = app;
