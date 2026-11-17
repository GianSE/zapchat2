'use strict';

/**
 * Camada MODEL (MVC) - servico de aplicacao do ZapChat.
 *
 * Enquanto cada classe de entidade cuida da sua propria colecao, este servico
 * coordena os casos de uso que envolvem mais de uma colecao ao mesmo tempo -
 * por exemplo, enviar uma mensagem (grava em "mensagens" e atualiza o resumo em
 * "conversas") ou excluir um usuario (remove os vinculos nas demais colecoes).
 *
 * Essa separacao mantem as entidades simples e concentra as regras de fluxo em
 * um unico lugar.
 */

const { Usuario, Contato, Conversa, Mensagem, Reacao } = require('../models');
const Database = require('../database/Database');
const logger = require('../utils/Logger');
const Seguranca = require('../utils/Seguranca');
const Validador = require('../utils/Validador');
const { ErroRegraNegocio, ErroNaoEncontrado, ErroAutenticacao, ErroPermissao } = require('../errors');

class ChatService {
  // ---------------------------------------------------------------------------
  // Usuarios e contatos
  // ---------------------------------------------------------------------------

  /**
   * Cadastra um novo usuario.
   *
   * @param {object} dados Dados do usuario (nome, email, senha...).
   * @returns {Promise<Usuario>}
   */
  static async cadastrarUsuario(dados) {
    return Usuario.inserir(dados);
  }

  /**
   * Adiciona um contato a agenda de um usuario.
   *
   * @param {string} usuarioId Dono da agenda.
   * @param {string} contatoId Usuario adicionado.
   * @param {object} [dados] Apelido e demais campos opcionais.
   * @returns {Promise<Contato>}
   */
  static async adicionarContato(usuarioId, contatoId, dados = {}) {
    return Contato.adicionar(usuarioId, contatoId, dados);
  }

  /**
   * Adiciona um contato a partir do e-mail digitado no formulario (Projeto 2).
   *
   * @param {string} usuarioId Dono da agenda (usuario logado).
   * @param {string} email E-mail do usuario que sera adicionado.
   * @param {object} [dados] Apelido e favorito.
   * @returns {Promise<Contato>}
   * @throws {ErroValidacao} Quando o e-mail nao foi informado ou e invalido.
   * @throws {ErroNaoEncontrado} Quando nao existe usuario com o e-mail.
   */
  static async adicionarContatoPorEmail(usuarioId, email, dados = {}) {
    const operacao = 'ChatService.adicionarContatoPorEmail';

    Contato.validarComLog(() => {
      Validador.exigirCampos({ email }, ['email'], Contato.entidade, operacao);

      const erros = [];
      Validador.email(erros, email, 'email');
      Validador.lancarSeHouverErros(erros, Contato.entidade, operacao);
    });

    const usuario = await Usuario.buscarPorEmail(email);

    if (!usuario) {
      const erro = new ErroNaoEncontrado('Usuario', email, { operacao });
      logger.erro(erro);
      throw erro;
    }

    return Contato.adicionar(usuarioId, usuario.id, dados);
  }

  /**
   * Exclui a conta do usuario logado depois de conferir a senha (Projeto 2).
   *
   * @param {string} usuarioId Usuario autenticado.
   * @param {string} senha Senha digitada para confirmar a exclusao.
   * @returns {Promise<object>} Resumo das exclusoes realizadas.
   * @throws {ErroValidacao} Quando a senha nao foi informada.
   * @throws {ErroAutenticacao} Quando a senha nao confere.
   */
  static async excluirConta(usuarioId, senha) {
    const operacao = 'ChatService.excluirConta';

    Usuario.validarComLog(() => Validador.exigirCampos({ senha }, ['senha'], Usuario.entidade, operacao));

    const usuario = await Usuario.obterPorId(usuarioId);

    if (!Seguranca.verificarSenha(senha, usuario.senhaHash)) {
      const erro = new ErroAutenticacao('Senha incorreta: a conta nao foi excluida', {
        operacao,
        detalhes: { usuarioId: usuario.id }
      });

      logger.erro(erro);
      throw erro;
    }

    return this.excluirUsuario(usuario.id);
  }

  // ---------------------------------------------------------------------------
  // Conversas
  // ---------------------------------------------------------------------------

  /**
   * Abre (ou reaproveita) uma conversa privada entre dois usuarios,
   * respeitando eventuais bloqueios registrados na agenda.
   *
   * @param {string} remetenteId Usuario que inicia a conversa.
   * @param {string} destinatarioId Outro participante.
   * @returns {Promise<Conversa>}
   * @throws {ErroRegraNegocio} Quando o destinatario bloqueou o remetente.
   */
  static async abrirConversaPrivada(remetenteId, destinatarioId) {
    const operacao = 'ChatService.abrirConversaPrivada';

    if (await Contato.estaBloqueado(destinatarioId, remetenteId)) {
      const erro = new ErroRegraNegocio('Nao e possivel conversar: voce foi bloqueado por este usuario', {
        operacao,
        detalhes: { remetenteId: String(remetenteId), destinatarioId: String(destinatarioId) }
      });

      logger.erro(erro);
      throw erro;
    }

    return Conversa.abrirPrivada(remetenteId, destinatarioId);
  }

  /**
   * Cria um grupo e envia a mensagem de sistema de boas-vindas.
   *
   * @param {object} dados Dados do grupo (nome, criadoPor, participantes...).
   * @returns {Promise<{conversa: Conversa, aviso: Mensagem}>}
   */
  static async criarGrupo(dados) {
    const grupo = await Conversa.criarGrupo(dados);

    const resultado = await this.enviarMensagem({
      conversaId: grupo.id,
      autorId: grupo.criadoPor,
      conteudo: `Grupo "${grupo.nome}" criado com ${grupo.quantidadeParticipantes} participantes`,
      tipo: 'sistema'
    });

    return { conversa: resultado.conversa, aviso: resultado.mensagem };
  }

  /**
   * Adiciona um participante ao grupo. Somente administradores podem fazer isso.
   *
   * @param {string} conversaId Identificador do grupo.
   * @param {string} administradorId Administrador responsavel.
   * @param {string} novoParticipanteId Usuario convidado.
   * @returns {Promise<{conversa: Conversa, aviso: Mensagem}>}
   * @throws {ErroPermissao} Quando quem solicita nao e administrador.
   */
  static async adicionarAoGrupo(conversaId, administradorId, novoParticipanteId) {
    const operacao = 'ChatService.adicionarAoGrupo';

    const grupo = await Conversa.obterPorId(conversaId);
    const administrador = Conversa.converterId(administradorId, operacao, 'administradorId');

    if (!grupo.administradores.some((id) => id.equals(administrador))) {
      const erro = new ErroPermissao('Somente administradores podem adicionar participantes ao grupo', {
        operacao,
        detalhes: { conversaId: grupo.id, usuarioId: String(administradorId) }
      });

      logger.erro(erro);
      throw erro;
    }

    const atualizado = await Conversa.adicionarParticipante(grupo.id, novoParticipanteId);
    const convidado = await Usuario.obterPorId(novoParticipanteId);

    const resultado = await this.enviarMensagem({
      conversaId: atualizado.id,
      autorId: administradorId,
      conteudo: `${convidado.nome} entrou no grupo`,
      tipo: 'sistema'
    });

    return { conversa: resultado.conversa, aviso: resultado.mensagem };
  }

  /**
   * Atualiza nome, descricao e icone de um grupo. Somente administradores
   * podem alterar (Projeto 2).
   *
   * @param {string} conversaId Identificador do grupo.
   * @param {string} usuarioId Usuario autenticado.
   * @param {object} dados Campos informados no formulario.
   * @returns {Promise<Conversa>}
   */
  static async atualizarGrupo(conversaId, usuarioId, dados) {
    const grupo = await Conversa.garantirAdministrador(conversaId, usuarioId, 'ChatService.atualizarGrupo');

    return Conversa.atualizarPorId(grupo.id, dados);
  }

  /**
   * Remove um participante do grupo. O proprio usuario pode sair do grupo;
   * para remover outra pessoa e preciso ser administrador (Projeto 2).
   *
   * @param {string} conversaId Identificador do grupo.
   * @param {string} solicitanteId Usuario autenticado.
   * @param {string} alvoId Participante que sera removido.
   * @returns {Promise<{conversa: Conversa, saiu: boolean}>}
   */
  static async removerDoGrupo(conversaId, solicitanteId, alvoId) {
    const operacao = 'ChatService.removerDoGrupo';
    const saiu = String(solicitanteId) === String(alvoId);

    if (saiu) {
      await Conversa.garantirParticipante(conversaId, solicitanteId, operacao);
    } else {
      await Conversa.garantirAdministrador(conversaId, solicitanteId, operacao);
    }

    const removido = await Usuario.obterPorId(alvoId);
    let conversa = await Conversa.removerParticipante(conversaId, alvoId);

    // Um grupo nunca fica sem administrador: o primeiro participante assume.
    if (conversa.administradores.length === 0 && conversa.participantes.length > 0) {
      conversa = await Conversa.promoverAdministrador(conversa.id, conversa.participantes[0]);
    }

    const autorDoAviso = saiu ? conversa.participantes[0] : solicitanteId;

    const resultado = await this.enviarMensagem({
      conversaId: conversa.id,
      autorId: autorDoAviso,
      conteudo: saiu ? `${removido.nome} saiu do grupo` : `${removido.nome} foi removido(a) do grupo`,
      tipo: 'sistema'
    });

    return { conversa: resultado.conversa, saiu };
  }

  // ---------------------------------------------------------------------------
  // Mensagens
  // ---------------------------------------------------------------------------

  /**
   * Envia a mensagem digitada pelo usuario no formulario (Projeto 2). Impede
   * que o usuario envie mensagens do tipo "sistema", reservadas aos avisos
   * gerados pela aplicacao.
   *
   * @param {object} dados Dados da mensagem (conversaId, autorId, conteudo...).
   * @returns {Promise<{mensagem: Mensagem, conversa: Conversa}>}
   * @throws {ErroValidacao} Quando o tipo informado nao e permitido.
   */
  static async enviarMensagemDoUsuario(dados) {
    const operacao = 'ChatService.enviarMensagemDoUsuario';

    Mensagem.validarComLog(() => {
      const erros = [];
      Validador.enumerado(erros, dados.tipo, Mensagem.tiposDoUsuario, 'tipo');
      Validador.lancarSeHouverErros(erros, Mensagem.entidade, operacao);
    });

    return this.enviarMensagem(dados);
  }

  /**
   * Fixa ou desafixa uma mensagem. Qualquer participante da conversa pode
   * fixar mensagens (Projeto 2).
   *
   * @param {string} mensagemId Identificador da mensagem.
   * @param {string} usuarioId Usuario autenticado.
   * @returns {Promise<Mensagem>}
   */
  static async fixarMensagem(mensagemId, usuarioId) {
    const mensagem = await Mensagem.obterPorId(mensagemId);
    await Conversa.garantirParticipante(mensagem.conversaId, usuarioId, 'ChatService.fixarMensagem');

    return Mensagem.alternarFixada(mensagem.id);
  }

  /**
   * Envia uma mensagem e atualiza o resumo da conversa.
   *
   * @param {object} dados Dados da mensagem (conversaId, autorId, conteudo...).
   * @returns {Promise<{mensagem: Mensagem, conversa: Conversa}>}
   */
  static async enviarMensagem(dados) {
    const mensagem = await Mensagem.enviar(dados);
    const autor = await Usuario.buscarPorId(mensagem.autorId);

    const conversa = await Conversa.registrarUltimaMensagem(mensagem.conversaId, {
      texto: mensagem.previa,
      autorId: mensagem.autorId,
      autorNome: autor?.nome ?? 'Usuario removido',
      enviadaEm: mensagem.enviadaEm
    });

    return { mensagem, conversa };
  }

  /**
   * Envia uma mensagem direta para outro usuario, abrindo a conversa privada
   * quando ela ainda nao existir.
   *
   * @param {string} remetenteId Autor da mensagem.
   * @param {string} destinatarioId Destinatario da mensagem.
   * @param {string} conteudo Texto da mensagem.
   * @param {object} [extras] Campos adicionais (tipo, anexo, respostaA).
   * @returns {Promise<{mensagem: Mensagem, conversa: Conversa}>}
   */
  static async enviarMensagemDireta(remetenteId, destinatarioId, conteudo, extras = {}) {
    const conversa = await this.abrirConversaPrivada(remetenteId, destinatarioId);

    return this.enviarMensagem({ ...extras, conversaId: conversa.id, autorId: remetenteId, conteudo });
  }

  /**
   * Abre uma conversa: retorna o historico detalhado e marca as mensagens
   * pendentes como lidas pelo usuario.
   *
   * @param {string} conversaId Identificador da conversa.
   * @param {string} usuarioId Usuario que esta abrindo a conversa.
   * @param {object} [opcoes]
   * @param {number} [opcoes.limite] Quantidade maxima de mensagens.
   * @returns {Promise<{conversa: Conversa, mensagens: object[], marcadasComoLidas: number}>}
   */
  static async abrirConversa(conversaId, usuarioId, { limite = 50 } = {}) {
    const operacao = 'ChatService.abrirConversa';

    const conversa = await Conversa.garantirParticipante(conversaId, usuarioId, operacao);
    const marcadasComoLidas = await Mensagem.marcarConversaComoLida(conversa.id, usuarioId);
    const mensagens = await Mensagem.historicoDetalhado(conversa.id, { limite });

    return { conversa, mensagens, marcadasComoLidas };
  }

  /**
   * Adiciona ou remove uma reacao em uma mensagem.
   *
   * @param {string} mensagemId Mensagem que recebe a reacao.
   * @param {string} usuarioId Autor da reacao.
   * @param {string} emoji Emoji escolhido.
   * @returns {Promise<{acao: string, resumo: Array<{emoji: string, total: number}>}>}
   */
  static async reagir(mensagemId, usuarioId, emoji) {
    const { acao } = await Reacao.alternar(mensagemId, usuarioId, emoji);
    const resumo = await Reacao.resumoPorMensagem(mensagemId);

    return { acao, resumo };
  }

  // ---------------------------------------------------------------------------
  // Exclusoes com dependencias entre colecoes
  // ---------------------------------------------------------------------------

  /**
   * Exclui uma mensagem definitivamente: remove as reacoes vinculadas, apaga o
   * documento e recalcula o resumo da conversa.
   *
   * @param {string} mensagemId Identificador da mensagem.
   * @param {string} solicitanteId Usuario que solicitou a exclusao.
   * @returns {Promise<{reacoesRemovidas: number, conversaId: string}>}
   * @throws {ErroPermissao} Quando o solicitante nao e o autor da mensagem.
   */
  static async excluirMensagemDefinitivamente(mensagemId, solicitanteId) {
    const operacao = 'ChatService.excluirMensagemDefinitivamente';

    const mensagem = await Mensagem.obterPorId(mensagemId);
    const solicitante = Mensagem.converterId(solicitanteId, operacao, 'solicitanteId');

    if (!mensagem.autorId.equals(solicitante)) {
      const erro = new ErroPermissao('Somente o autor pode excluir definitivamente a mensagem', {
        operacao,
        detalhes: { mensagemId: mensagem.id, solicitanteId: String(solicitanteId) }
      });

      logger.erro(erro);
      throw erro;
    }

    const reacoesRemovidas = await Reacao.removerDaMensagem(mensagem.id);
    await Mensagem.excluirPorId(mensagem.id);
    await this.sincronizarResumoConversa(mensagem.conversaId);

    logger.info(`Mensagem ${mensagem.id} excluida definitivamente (${reacoesRemovidas} reacao(oes) removida(s))`, {
      operacao
    });

    return { reacoesRemovidas, conversaId: String(mensagem.conversaId) };
  }

  /**
   * Recalcula o total de mensagens e o resumo da ultima mensagem de uma conversa.
   *
   * @param {string} conversaId Identificador da conversa.
   * @returns {Promise<Conversa>}
   */
  static async sincronizarResumoConversa(conversaId) {
    const total = await Mensagem.contar({
      conversaId: Conversa.converterId(conversaId, 'ChatService.sincronizarResumoConversa', 'conversaId'),
      excluida: false
    });

    const ultima = await Mensagem.ultimaDaConversa(conversaId);
    let resumo = null;

    if (ultima) {
      const autor = await Usuario.buscarPorId(ultima.autorId);

      resumo = {
        texto: ultima.previa,
        autorId: ultima.autorId,
        autorNome: autor?.nome ?? 'Usuario removido',
        enviadaEm: ultima.enviadaEm
      };
    }

    return Conversa.sincronizarResumo(conversaId, resumo, total);
  }

  /**
   * Exclui uma conversa e todo o seu conteudo (mensagens e reacoes).
   *
   * @param {string} conversaId Identificador da conversa.
   * @param {string} solicitanteId Usuario que solicitou a exclusao.
   * @returns {Promise<{mensagensRemovidas: number, reacoesRemovidas: number}>}
   * @throws {ErroPermissao} Quando o solicitante nao pode excluir a conversa.
   */
  static async excluirConversa(conversaId, solicitanteId) {
    const operacao = 'ChatService.excluirConversa';

    const conversa = await Conversa.garantirParticipante(conversaId, solicitanteId, operacao);
    const solicitante = Conversa.converterId(solicitanteId, operacao, 'solicitanteId');

    const podeExcluir = conversa.ehGrupo
      ? conversa.administradores.some((id) => id.equals(solicitante))
      : true;

    if (!podeExcluir) {
      const erro = new ErroPermissao('Somente administradores podem excluir o grupo', {
        operacao,
        detalhes: { conversaId: conversa.id, solicitanteId: String(solicitanteId) }
      });

      logger.erro(erro);
      throw erro;
    }

    const mensagens = await Mensagem.listar({ conversaId: conversa._id }, { projecao: { _id: 1 } });

    let reacoesRemovidas = 0;
    for (const mensagem of mensagens) {
      reacoesRemovidas += await Reacao.removerDaMensagem(mensagem.id);
    }

    const mensagensRemovidas = await Mensagem.excluirMuitos({ conversaId: conversa._id }, operacao);
    await Conversa.excluirPorId(conversa.id);

    logger.info(
      `Conversa ${conversa.id} excluida (${mensagensRemovidas} mensagem(ns), ${reacoesRemovidas} reacao(oes))`,
      { operacao }
    );

    return { mensagensRemovidas, reacoesRemovidas };
  }

  /**
   * Exclui um usuario e todos os seus vinculos:
   *   - remove as reacoes que ele registrou;
   *   - remove os contatos em que ele aparece (nas duas direcoes);
   *   - retira o usuario dos grupos em que participava;
   *   - exclui as conversas privadas dele, com as mensagens e reacoes;
   *   - por fim, exclui o proprio usuario.
   *
   * @param {string} usuarioId Identificador do usuario.
   * @returns {Promise<object>} Resumo das exclusoes realizadas.
   */
  static async excluirUsuario(usuarioId) {
    const operacao = 'ChatService.excluirUsuario';

    const usuario = await Usuario.obterPorId(usuarioId);
    const identificador = usuario._id;

    const reacoesRemovidas = await Reacao.excluirMuitos({ usuarioId: identificador }, operacao);

    const contatosRemovidos = await Contato.excluirMuitos(
      { $or: [{ usuarioId: identificador }, { contatoId: identificador }] },
      operacao
    );

    // Conversas privadas sao excluidas junto com o usuario.
    const privadas = await Conversa.listar({ tipo: 'privada', participantes: identificador });

    let mensagensRemovidas = 0;
    let conversasRemovidas = 0;

    for (const conversa of privadas) {
      const mensagens = await Mensagem.listar({ conversaId: conversa._id }, { projecao: { _id: 1 } });

      for (const mensagem of mensagens) await Reacao.removerDaMensagem(mensagem.id);

      mensagensRemovidas += await Mensagem.excluirMuitos({ conversaId: conversa._id }, operacao);
      await Conversa.excluirPorId(conversa.id);
      conversasRemovidas += 1;
    }

    // Nos grupos, o usuario apenas deixa de participar e o historico e mantido.
    const gruposAtualizados = await Conversa.atualizarMuitos(
      { tipo: 'grupo', participantes: identificador },
      { $pull: { participantes: identificador, administradores: identificador } },
      operacao
    );

    await Usuario.excluirPorId(usuario.id);

    const resumo = {
      usuario: usuario.nome,
      reacoesRemovidas,
      contatosRemovidos,
      conversasRemovidas,
      mensagensRemovidas,
      gruposAtualizados
    };

    logger.info(`Usuario ${usuario.nome} excluido: ${JSON.stringify(resumo)}`, { operacao });

    return resumo;
  }

  // ---------------------------------------------------------------------------
  // Paineis e estatisticas
  // ---------------------------------------------------------------------------

  /**
   * Monta o painel inicial de um usuario: perfil, conversas, mensagens nao
   * lidas e agenda de contatos (incluindo os contatos bloqueados).
   *
   * @param {string} usuarioId Identificador do usuario.
   * @returns {Promise<object>}
   */
  static async painelDoUsuario(usuarioId) {
    const usuario = await Usuario.obterPorId(usuarioId);

    const [conversas, naoLidas, agenda, totalNaoLidas] = await Promise.all([
      Conversa.listarPainelDoUsuario(usuario.id),
      Mensagem.resumoNaoLidas(usuario.id),
      // Os contatos bloqueados tambem aparecem na agenda (marcados como tal),
      // caso contrario nao haveria como desbloquea-los.
      Contato.listarAgenda(usuario.id, { incluirBloqueados: true }),
      Mensagem.contarNaoLidas(usuario.id)
    ]);

    return { usuario, conversas, naoLidas, agenda, totalNaoLidas };
  }

  /**
   * Estatisticas gerais da aplicacao, usadas no menu do terminal.
   *
   * @returns {Promise<object>}
   */
  static async estatisticasGerais() {
    const [colecoes, totalUsuarios, totalConversas, totalGrupos, totalMensagens, excluidas, ranking, emojis] =
      await Promise.all([
        Database.obterInstancia().estatisticas(),
        Usuario.contar(),
        Conversa.contar(),
        Conversa.contar({ tipo: 'grupo' }),
        Mensagem.contar(),
        Mensagem.contar({ excluida: true }),
        Mensagem.rankingRemetentes(5),
        Reacao.maisUsados(5)
      ]);

    return {
      colecoes,
      totalUsuarios,
      totalConversas,
      totalGrupos,
      totalMensagens,
      mensagensExcluidas: excluidas,
      ranking,
      emojis
    };
  }
}

module.exports = ChatService;
