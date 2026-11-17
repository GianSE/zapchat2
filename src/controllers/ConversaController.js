'use strict';

/**
 * CONTROLLER - conversas privadas e grupos (CRUD de Conversa).
 *
 *   GET  /conversas                         consultar as conversas
 *   GET  /conversas/:id?limite=&responder=  abrir uma conversa
 *   POST /conversas/privada                 abrir conversa privada
 *   GET  /conversas/novo                    formulario de novo grupo
 *   POST /conversas                         cadastrar grupo
 *   GET  /conversas/:id/editar              formulario do grupo (administrador)
 *   POST /conversas/atualizar               atualizar nome, descricao e icone
 *   POST /conversas/participantes           adicionar participante
 *   POST /conversas/participantes/remover   remover participante / sair do grupo
 *   POST /conversas/excluir                 excluir conversa
 */

const { ObjectId } = require('mongodb');
const Controlador = require('./Controlador');
const ChatService = require('../services/ChatService');
const { Usuario, Contato, Conversa, Mensagem, Reacao } = require('../models');
const Formulario = require('../utils/Formulario');
const logger = require('../utils/Logger');
const { ErroValidacao } = require('../errors');

/** Quantidade de mensagens exibidas ao abrir uma conversa. */
const LIMITE_PADRAO = 30;

class ConversaController {
  /** GET /conversas */
  static async listar(req, res) {
    const [conversas, naoLidas, agenda] = await Promise.all([
      Conversa.listarPainelDoUsuario(req.usuario.id),
      Mensagem.resumoNaoLidas(req.usuario.id),
      Contato.listarAgenda(req.usuario.id)
    ]);

    const naoLidasPorConversa = new Map(naoLidas.map((item) => [String(item.conversaId), item.naoLidas]));

    res.render('conversas/lista', {
      titulo: 'Conversas',
      conversas: conversas.map((conversa) => ({
        ...conversa,
        id: String(conversa._id),
        naoLidas: naoLidasPorConversa.get(String(conversa._id)) ?? 0
      })),
      agenda
    });
  }

  /** GET /conversas/:id - historico, formulario de envio e reacoes. */
  static async detalhar(req, res) {
    const limite = Formulario.inteiro(req.query.limite, 'limite', { padrao: LIMITE_PADRAO, min: 1, max: 200 });
    const responder = Formulario.texto(req.query.responder);
    const eu = req.usuario.id;

    // Confere a participacao, marca como lidas e traz o historico ($lookup).
    const { conversa, mensagens, marcadasComoLidas } = await ChatService.abrirConversa(req.params.id, eu, { limite });

    const participantes = await Usuario.listar({ _id: { $in: conversa.participantes } }, { ordenar: { nome: 1 } });
    const outro = participantes.find((pessoa) => pessoa.id !== eu);

    // Parametro GET "responder": mensagem desta conversa que sera respondida.
    let respondendo = null;

    if (responder) {
      const mensagem = await Mensagem.obterPorId(responder);

      if (!mensagem.conversaId.equals(conversa._id)) {
        throw new ErroValidacao('A mensagem escolhida para resposta pertence a outra conversa', [], {
          operacao: 'ConversaController.detalhar',
          detalhes: { conversaId: conversa.id, responder }
        });
      }

      respondendo = { id: mensagem.id, previa: mensagem.previa };
    }

    // Rascunho guardado na sessao quando o envio anterior falhou.
    const rascunho = req.session.rascunho?.conversaId === conversa.id ? req.session.rascunho : null;
    if (req.session.rascunho) delete req.session.rascunho;

    if (marcadasComoLidas > 0) {
      logger.debug(`${marcadasComoLidas} mensagem(ns) lida(s) por ${eu}`, { operacao: 'ConversaController.detalhar' });
    }

    res.render('conversas/detalhe', {
      titulo: conversa.ehGrupo ? conversa.nome : outro?.nomeExibicao ?? 'Conversa',
      conversa: {
        ...conversa.paraJSON(),
        ehGrupo: conversa.ehGrupo,
        souAdministrador: conversa.ehAdministrador(eu)
      },
      outro: outro ? outro.paraJSON() : null,
      participantes: participantes.map((pessoa) => ({
        ...pessoa.paraJSON(),
        administrador: conversa.ehAdministrador(pessoa.id)
      })),
      mensagens,
      limite,
      haMais: mensagens.length >= limite && conversa.totalMensagens > mensagens.length,
      respondendo,
      rascunho,
      tipos: Mensagem.tiposDoUsuario,
      emojis: Reacao.emojisValidos
    });
  }

  /** POST /conversas/privada - abre (ou reaproveita) a conversa com outro usuario. */
  static async abrirPrivada(req, res) {
    const corpo = Formulario.corpo(req);
    const destinatarioId = Formulario.texto(corpo.destinatarioId);

    try {
      const conversa = await ChatService.abrirConversaPrivada(req.usuario.id, destinatarioId);
      return res.redirect(Controlador.caminhoConversa(conversa.id));
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(Controlador.destinoSeguro(corpo.voltar, '/conversas'));
  }

  // ---------------------------------------------------------------------------
  // Grupos
  // ---------------------------------------------------------------------------

  /**
   * Renderiza o formulario de novo grupo.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @param {object} [extras]
   * @returns {Promise<void>}
   */
  static async renderizarNovoGrupo(req, res, { dados = {}, erro = null, status = 200 } = {}) {
    const agenda = await Contato.listarAgenda(req.usuario.id);

    res.status(status).render('conversas/novo-grupo', {
      titulo: 'Novo grupo',
      agenda,
      dados: { participantes: [], ...dados },
      erro
    });
  }

  /** GET /conversas/novo */
  static async exibirNovoGrupo(req, res) {
    await ConversaController.renderizarNovoGrupo(req, res);
  }

  /** POST /conversas - cadastra o grupo e envia a mensagem de boas-vindas. */
  static async criarGrupo(req, res) {
    const corpo = Formulario.corpo(req);

    const dados = {
      nome: Formulario.texto(corpo.nome),
      descricao: Formulario.texto(corpo.descricao),
      icone: Formulario.texto(corpo.icone) ?? '👥',
      participantes: Formulario.lista(corpo.participantes)
    };

    try {
      const { conversa } = await ChatService.criarGrupo({ ...dados, criadoPor: req.usuario.id });

      req.avisar('sucesso', `Grupo "${conversa.nome}" criado.`);
      return res.redirect(Controlador.caminhoConversa(conversa.id));
    } catch (erro) {
      const falha = Controlador.erroDoUsuario(erro);
      return ConversaController.renderizarNovoGrupo(req, res, { dados, erro: falha, status: falha.status });
    }
  }

  /** GET /conversas/:id/editar - somente administradores. */
  static async exibirEdicao(req, res) {
    const conversa = await Conversa.garantirAdministrador(req.params.id, req.usuario.id, 'ConversaController.exibirEdicao');

    const [participantes, agenda] = await Promise.all([
      Usuario.listar({ _id: { $in: conversa.participantes } }, { ordenar: { nome: 1 } }),
      Contato.listarAgenda(req.usuario.id)
    ]);

    const ids = new Set(conversa.participantes.map(String));

    res.render('conversas/editar', {
      titulo: `Editar ${conversa.nome}`,
      conversa: conversa.paraJSON(),
      participantes: participantes.map((pessoa) => ({
        ...pessoa.paraJSON(),
        administrador: conversa.ehAdministrador(pessoa.id)
      })),
      candidatos: agenda.filter((contato) => !ids.has(String(contato.contatoId)))
    });
  }

  /** POST /conversas/atualizar */
  static async atualizar(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);

    try {
      await ChatService.atualizarGrupo(id, req.usuario.id, {
        nome: Formulario.texto(corpo.nome),
        descricao: Formulario.texto(corpo.descricao),
        icone: Formulario.texto(corpo.icone) ?? '👥'
      });

      req.avisar('sucesso', 'Grupo atualizado.');
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(ConversaController.caminhoEdicao(id));
  }

  /** POST /conversas/participantes - administrador adiciona um contato ao grupo. */
  static async adicionarParticipante(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);

    try {
      await ChatService.adicionarAoGrupo(id, req.usuario.id, Formulario.texto(corpo.usuarioId));
      req.avisar('sucesso', 'Participante adicionado.');
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(ConversaController.caminhoEdicao(id));
  }

  /** POST /conversas/participantes/remover - remove alguem ou sai do grupo. */
  static async removerParticipante(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);
    const usuarioId = Formulario.texto(corpo.usuarioId) ?? req.usuario.id;

    try {
      const { saiu } = await ChatService.removerDoGrupo(id, req.usuario.id, usuarioId);

      req.avisar('sucesso', saiu ? 'Voce saiu do grupo.' : 'Participante removido.');
      return res.redirect(saiu ? '/conversas' : ConversaController.caminhoEdicao(id));
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(Controlador.destinoSeguro(corpo.voltar, ConversaController.caminhoEdicao(id)));
  }

  /** POST /conversas/excluir - exclui a conversa com mensagens e reacoes. */
  static async excluir(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);

    try {
      const resumo = await ChatService.excluirConversa(id, req.usuario.id);

      req.avisar('sucesso', `Conversa excluída (${resumo.mensagensRemovidas} mensagem(ns) removida(s)).`);
      return res.redirect('/conversas');
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(ObjectId.isValid(id ?? '') ? Controlador.caminhoConversa(id) : '/conversas');
  }

  /**
   * Caminho da pagina de edicao do grupo (ou da lista, se o id for invalido).
   *
   * @param {string|null} id
   * @returns {string}
   */
  static caminhoEdicao(id) {
    return ObjectId.isValid(id ?? '') ? `/conversas/${id}/editar` : '/conversas';
  }
}

module.exports = ConversaController;
