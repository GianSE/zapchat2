'use strict';

// Agenda de contatos do usuario logado.

const { ObjectId } = require('mongodb');
const Controlador = require('./Controlador');
const ChatService = require('../services/ChatService');
const { Contato, Usuario } = require('../models');
const Formulario = require('../utils/Formulario');
const Validador = require('../utils/Validador');

// Filtros aceitos pelo parametro GET "filtro".
const FILTROS = Object.freeze(['todos', 'favoritos', 'bloqueados']);

class ContatoController {
  // GET /contatos
  static async listar(req, res) {
    const filtro = Formulario.texto(req.query.filtro) ?? 'todos';

    const erros = [];
    Validador.enumerado(erros, filtro, FILTROS, 'filtro');
    Validador.lancarSeHouverErros(erros, 'Contato', 'ContatoController.listar');

    let agenda = await Contato.listarAgenda(req.usuario.id, {
      somenteFavoritos: filtro === 'favoritos',
      incluirBloqueados: true
    });

    if (filtro === 'bloqueados') agenda = agenda.filter((contato) => contato.bloqueado);

    res.render('contatos/lista', { titulo: 'Contatos', agenda, filtro, filtros: FILTROS, dados: {} });
  }

  // POST /contatos - adiciona pelo e-mail digitado ou pelo id (botao na lista
  // de usuarios).
  static async adicionar(req, res) {
    const corpo = Formulario.corpo(req);
    const contatoId = Formulario.texto(corpo.contatoId);
    const email = Formulario.texto(corpo.email);
    const dados = { apelido: Formulario.texto(corpo.apelido), favorito: Formulario.booleano(corpo.favorito) };
    const voltar = Controlador.destinoSeguro(corpo.voltar, '/contatos');

    try {
      const contato = contatoId
        ? await ChatService.adicionarContato(req.usuario.id, contatoId, dados)
        : await ChatService.adicionarContatoPorEmail(req.usuario.id, email, dados);

      const usuario = await Usuario.buscarPorId(contato.contatoId);
      req.avisar('sucesso', `${usuario?.nome ?? 'Contato'} foi adicionado(a) a sua agenda.`);
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(voltar);
  }

  // GET /contatos/:id/editar
  static async exibirEdicao(req, res) {
    const contato = await Contato.obterDoUsuario(req.params.id, req.usuario.id);
    const usuario = await Usuario.obterPorId(contato.contatoId);

    res.render('contatos/editar', {
      titulo: 'Editar contato',
      contato: { ...contato.paraJSON(), contatoId: String(contato.contatoId) },
      usuario: usuario.paraJSON()
    });
  }

  // POST /contatos/atualizar
  static async atualizar(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);

    try {
      const contato = await Contato.obterDoUsuario(id, req.usuario.id);

      await Contato.atualizarPorId(contato.id, {
        apelido: Formulario.texto(corpo.apelido),
        favorito: Formulario.booleano(corpo.favorito),
        bloqueado: Formulario.booleano(corpo.bloqueado)
      });

      req.avisar('sucesso', 'Contato atualizado.');
      return res.redirect('/contatos');
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(ObjectId.isValid(id ?? '') ? `/contatos/${id}/editar` : '/contatos');
  }

  // POST /contatos/excluir
  static async excluir(req, res) {
    const id = Formulario.texto(Formulario.corpo(req).id);

    try {
      const contato = await Contato.obterDoUsuario(id, req.usuario.id);
      await Contato.excluirPorId(contato.id);

      req.avisar('sucesso', 'Contato removido da agenda.');
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect('/contatos');
  }
}

module.exports = ContatoController;
