'use strict';

// Login, cadastro e logout.

const Controlador = require('./Controlador');
const ChatService = require('../services/ChatService');
const { Usuario } = require('../models');
const Formulario = require('../utils/Formulario');
const logger = require('../utils/Logger');
const { ErroValidacao } = require('../errors');

// Cookie que lembra o e-mail do ultimo login (30 dias).
const COOKIE_EMAIL = 'ultimoEmail';
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60 * 1000;

// Mensagens exibidas na tela de login conforme o parametro GET "motivo".
const MOTIVOS = Object.freeze({
  saiu: 'Voce saiu do ZapChat. Ate logo!',
  'conta-excluida': 'Sua conta foi excluida com sucesso.'
});

class AutenticacaoController {
  // GET /login - formulario de login.
  // O e-mail vem preenchido pelo cookie, quando o usuario marcou "lembrar".
  static exibirLogin(req, res) {
    const emailLembrado = req.cookies?.[COOKIE_EMAIL] ?? '';

    res.render('autenticacao/login', {
      titulo: 'Entrar',
      dados: { email: emailLembrado, lembrar: Boolean(emailLembrado) },
      aviso: MOTIVOS[req.query.motivo] ?? null,
      erro: null
    });
  }

  // POST /login - recebe as credenciais, confere no MongoDB e cria a sessao.
  static async entrar(req, res) {
    const corpo = Formulario.corpo(req);
    const email = Formulario.texto(corpo.email);
    const senha = Formulario.senha(corpo.senha);
    const lembrar = Formulario.booleano(corpo.lembrar);

    let usuario;

    try {
      usuario = await Usuario.autenticar(email, senha);
    } catch (erro) {
      const falha = Controlador.erroDoUsuario(erro);

      return res.status(falha.status).render('autenticacao/login', {
        titulo: 'Entrar',
        dados: { email: email ?? '', lembrar },
        aviso: null,
        erro: falha
      });
    }

    // Cookie: preferencia guardada no navegador, sem dados sensiveis.
    if (lembrar) {
      res.cookie(COOKIE_EMAIL, usuario.email, { maxAge: TRINTA_DIAS_MS, httpOnly: true, sameSite: 'lax' });
    } else {
      res.clearCookie(COOKIE_EMAIL);
    }

    // A pagina protegida que o usuario tentou abrir antes do login.
    const destino = Controlador.destinoSeguro(req.session.voltarPara, '/painel');

    await Controlador.iniciarSessao(req, usuario);
    req.avisar('sucesso', `Bem-vindo(a), ${usuario.nomeExibicao}!`);
    await Controlador.salvarSessao(req);

    logger.info(`Login realizado: ${usuario.email}`, { operacao: 'AutenticacaoController.entrar' });

    res.redirect(destino);
  }

  // GET /cadastro - formulario de criacao de conta.
  static exibirCadastro(req, res) {
    res.render('autenticacao/cadastro', { titulo: 'Criar conta', dados: {}, erro: null });
  }

  // POST /cadastro - cria o usuario (senha gravada como hash) e ja inicia a sessao.
  static async cadastrar(req, res) {
    const corpo = Formulario.corpo(req);

    const dados = {
      nome: Formulario.texto(corpo.nome),
      email: Formulario.texto(corpo.email),
      apelido: Formulario.texto(corpo.apelido),
      telefone: Formulario.texto(corpo.telefone),
      senha: Formulario.senha(corpo.senha)
    };

    let usuario;

    try {
      const confirmacao = Formulario.senha(corpo.confirmacao);

      if (dados.senha && dados.senha !== confirmacao) {
        throw new ErroValidacao('A confirmacao da senha nao confere', ['Campo "confirmacao" deve ser igual ao campo "senha"'], {
          operacao: 'AutenticacaoController.cadastrar',
          detalhes: { email: dados.email }
        });
      }

      usuario = await ChatService.cadastrarUsuario(dados);
      usuario = await Usuario.registrarAcesso(usuario.id);
    } catch (erro) {
      const falha = Controlador.erroDoUsuario(erro);
      const { senha, ...dadosSemSenha } = dados;

      return res.status(falha.status).render('autenticacao/cadastro', {
        titulo: 'Criar conta',
        dados: dadosSemSenha,
        erro: falha
      });
    }

    await Controlador.iniciarSessao(req, usuario);
    req.avisar('sucesso', `Conta criada! Bem-vindo(a) ao ZapChat, ${usuario.nomeExibicao}.`);
    await Controlador.salvarSessao(req);

    res.redirect('/painel');
  }

  // POST /logout - marca o usuario como offline e encerra a sessao.
  static async sair(req, res) {
    try {
      await Usuario.alterarStatus(req.usuario.id, 'offline');
    } catch (erro) {
      // Mesmo que o status nao possa ser gravado, o logout precisa acontecer.
      logger.erro(erro, { operacao: 'AutenticacaoController.sair' });
    }

    logger.info(`Logout realizado: ${req.usuario.email}`, { operacao: 'AutenticacaoController.sair' });

    await Controlador.encerrarSessao(req, res);

    res.redirect('/login?motivo=saiu');
  }
}

module.exports = AutenticacaoController;
