'use strict';

/**
 * CONTROLLER - mensagens (CRUD de Mensagem) e reacoes.
 *
 *   POST /mensagens                       enviar mensagem
 *   GET  /mensagens/busca?termo=&conversaId=  pesquisar mensagens
 *   GET  /mensagens/:id/editar            formulario de edicao
 *   POST /mensagens/atualizar             editar o conteudo
 *   POST /mensagens/excluir               apagar para todos / excluir definitivamente
 *   POST /mensagens/fixar                 fixar ou desafixar
 *   POST /mensagens/reagir                adicionar ou remover reacao
 */

const { ObjectId } = require('mongodb');
const Controlador = require('./Controlador');
const ChatService = require('../services/ChatService');
const { Conversa, Mensagem } = require('../models');
const Formulario = require('../utils/Formulario');
const Validador = require('../utils/Validador');

/** Modos de exclusao aceitos pelo formulario. */
const MODOS_EXCLUSAO = Object.freeze(['todos', 'definitivo']);

class MensagemController {
  /** POST /mensagens - envia texto ou midia (anexo por URL). */
  static async enviar(req, res) {
    const corpo = Formulario.corpo(req);
    const conversaId = Formulario.texto(corpo.conversaId);
    const tipo = Formulario.texto(corpo.tipo) ?? 'texto';
    const conteudo = Formulario.texto(corpo.conteudo);
    const tamanho = Formulario.texto(corpo.anexoTamanho);

    const dados = {
      conversaId,
      autorId: req.usuario.id,
      conteudo,
      tipo,
      respostaA: Formulario.texto(corpo.respostaA),
      anexo:
        tipo === 'texto'
          ? null
          : {
              nome: Formulario.texto(corpo.anexoNome),
              url: Formulario.texto(corpo.anexoUrl),
              tamanhoKb: tamanho === null ? null : Number(tamanho.replace(',', '.'))
            }
    };

    try {
      // Sem uma conversa valida nao ha para onde voltar: valida antes de tudo.
      if (!ObjectId.isValid(conversaId ?? '')) {
        Mensagem.validarComLog(() => Mensagem.converterId(conversaId, 'MensagemController.enviar', 'conversaId'));
      }

      const { mensagem } = await ChatService.enviarMensagemDoUsuario(dados);
      return res.redirect(Controlador.caminhoConversa(conversaId, `m-${mensagem.id}`));
    } catch (erro) {
      Controlador.avisarErro(req, erro);

      if (!ObjectId.isValid(conversaId ?? '')) return res.redirect('/conversas');

      // Guarda o texto digitado para nao perder a mensagem.
      req.session.rascunho = { conversaId, conteudo: conteudo ?? '', tipo, respostaA: dados.respostaA };
    }

    res.redirect(Controlador.caminhoConversa(conversaId));
  }

  /** GET /mensagens/busca - pesquisa nas conversas do usuario logado. */
  static async buscar(req, res) {
    const eu = req.usuario.id;
    const termo = Formulario.texto(req.query.termo);
    const conversaId = Formulario.texto(req.query.conversaId);
    const enviado = req.query.termo !== undefined;

    const conversas = await Conversa.listarPainelDoUsuario(eu);
    const titulos = new Map(conversas.map((conversa) => [String(conversa._id), conversa.titulo]));

    let resultados = [];
    let erro = null;

    if (enviado) {
      try {
        if (conversaId) await Conversa.garantirParticipante(conversaId, eu, 'MensagemController.buscar');

        const encontradas = await Mensagem.pesquisar(termo, {
          conversaId,
          conversaIds: conversaId ? null : conversas.map((conversa) => conversa._id),
          limite: 30
        });

        resultados = encontradas.map((mensagem) => ({
          ...mensagem.paraJSON(),
          conversaId: String(mensagem.conversaId),
          conversaTitulo: titulos.get(String(mensagem.conversaId)) ?? 'Conversa'
        }));
      } catch (falha) {
        erro = Controlador.erroDoUsuario(falha);
      }
    }

    res.status(erro?.status ?? 200).render('mensagens/busca', {
      titulo: 'Buscar mensagens',
      termo: termo ?? '',
      conversaId: conversaId ?? '',
      conversas,
      resultados,
      enviado,
      erro
    });
  }

  /** GET /mensagens/:id/editar - somente o autor. */
  static async exibirEdicao(req, res) {
    const mensagem = await Mensagem.obterDoAutor(req.params.id, req.usuario.id);

    res.render('mensagens/editar', {
      titulo: 'Editar mensagem',
      mensagem: { ...mensagem.paraJSON(), conversaId: String(mensagem.conversaId) }
    });
  }

  /** POST /mensagens/atualizar */
  static async atualizar(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);

    try {
      const mensagem = await Mensagem.editar(id, req.usuario.id, Formulario.texto(corpo.conteudo));
      await ChatService.sincronizarResumoConversa(mensagem.conversaId);

      req.avisar('sucesso', 'Mensagem editada.');
      return res.redirect(Controlador.caminhoConversa(mensagem.conversaId, `m-${mensagem.id}`));
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(ObjectId.isValid(id ?? '') ? `/mensagens/${id}/editar` : '/conversas');
  }

  /** POST /mensagens/excluir - modo "todos" (logica) ou "definitivo" (remove do banco). */
  static async excluir(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);
    const modo = Formulario.texto(corpo.modo) ?? 'todos';
    let destino = '/conversas';

    try {
      const erros = [];
      Validador.enumerado(erros, modo, MODOS_EXCLUSAO, 'modo');
      Mensagem.validarComLog(() => Validador.lancarSeHouverErros(erros, 'Mensagem', 'MensagemController.excluir'));

      const mensagem = await Mensagem.obterPorId(id);
      destino = Controlador.caminhoConversa(mensagem.conversaId);

      if (modo === 'definitivo') {
        await ChatService.excluirMensagemDefinitivamente(mensagem.id, req.usuario.id);
        req.avisar('sucesso', 'Mensagem excluída definitivamente.');
      } else {
        await Mensagem.excluirParaTodos(mensagem.id, req.usuario.id);
        await ChatService.sincronizarResumoConversa(mensagem.conversaId);
        req.avisar('sucesso', 'Mensagem apagada para todos.');
      }
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(destino);
  }

  /** POST /mensagens/fixar */
  static async fixar(req, res) {
    const id = Formulario.texto(Formulario.corpo(req).id);
    let destino = '/conversas';

    try {
      const mensagem = await ChatService.fixarMensagem(id, req.usuario.id);
      destino = Controlador.caminhoConversa(mensagem.conversaId, `m-${mensagem.id}`);
      req.avisar('sucesso', mensagem.fixada ? 'Mensagem fixada.' : 'Mensagem desafixada.');
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(destino);
  }

  /** POST /mensagens/reagir - reagir de novo com o mesmo emoji remove a reacao. */
  static async reagir(req, res) {
    const corpo = Formulario.corpo(req);
    const id = Formulario.texto(corpo.id);
    let destino = '/conversas';

    try {
      const mensagem = await Mensagem.obterPorId(id);
      destino = Controlador.caminhoConversa(mensagem.conversaId, `m-${mensagem.id}`);

      await ChatService.reagir(mensagem.id, req.usuario.id, Formulario.texto(corpo.emoji));
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(destino);
  }
}

module.exports = MensagemController;
