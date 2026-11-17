'use strict';

// Lista de usuarios, perfil publico e meu perfil.

const Controlador = require('./Controlador');
const ChatService = require('../services/ChatService');
const { Usuario, Contato, Conversa } = require('../models');
const Formulario = require('../utils/Formulario');
const { ErroValidacao } = require('../errors');

// Quantidade de usuarios por pagina na listagem.
const POR_PAGINA = 10;

class UsuarioController {
  // GET /usuarios - lista paginada ou busca por nome, apelido ou e-mail.
  static async listar(req, res) {
    const busca = Formulario.texto(req.query.busca);
    const pagina = Formulario.inteiro(req.query.pagina, 'pagina', { padrao: 1, min: 1, max: 1000 });
    const eu = req.usuario._id;

    let usuarios;
    let totalPaginas = 1;

    if (busca) {
      usuarios = (await Usuario.pesquisar(busca, 50)).filter((usuario) => !usuario._id.equals(eu));
    } else {
      const filtro = { _id: { $ne: eu } };
      const total = await Usuario.contar(filtro);

      totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
      usuarios = await Usuario.listar(filtro, {
        ordenar: { nome: 1 },
        limite: POR_PAGINA,
        pular: (pagina - 1) * POR_PAGINA
      });
    }

    // Marca quem ja esta na agenda do usuario logado.
    const agenda = await Contato.listarAgenda(eu, { incluirBloqueados: true });
    const naAgenda = new Set(agenda.map((contato) => String(contato.contatoId)));

    res.render('usuarios/lista', {
      titulo: 'Usuários',
      busca: busca ?? '',
      pagina,
      totalPaginas,
      usuarios: usuarios.map((usuario) => ({ ...usuario.paraJSON(), naAgenda: naAgenda.has(usuario.id) }))
    });
  }

  // GET /usuarios/:id - perfil publico de um usuario.
  static async detalhar(req, res) {
    const usuario = await Usuario.obterPorId(req.params.id);

    if (usuario.id === req.usuario.id) return res.redirect('/perfil');

    const [agenda, privada] = await Promise.all([
      Contato.listarAgenda(req.usuario.id, { incluirBloqueados: true }),
      Conversa.buscarPrivadaEntre(req.usuario.id, usuario.id)
    ]);

    res.render('usuarios/detalhe', {
      titulo: usuario.nomeExibicao,
      perfil: usuario.paraJSON(),
      contato: agenda.find((item) => String(item.contatoId) === usuario.id) ?? null,
      conversaId: privada?.id ?? null
    });
  }

  // Meu perfil

  // Renderiza a pagina "Meu perfil".
  static renderizarPerfil(res, usuario, { dados = null, erro = null, status = 200 } = {}) {
    res.status(status).render('usuarios/perfil', {
      titulo: 'Meu perfil',
      perfil: usuario.paraJSON(),
      dados: dados ?? usuario.paraJSON(),
      statusValidos: Usuario.statusValidos,
      erro
    });
  }

  // GET /perfil
  static exibirPerfil(req, res) {
    UsuarioController.renderizarPerfil(res, req.usuario);
  }

  // POST /perfil/atualizar - nome, apelido, telefone, avatar e recado.
  static async atualizarPerfil(req, res) {
    const corpo = Formulario.corpo(req);

    const dados = {
      nome: Formulario.texto(corpo.nome),
      apelido: Formulario.texto(corpo.apelido),
      telefone: Formulario.texto(corpo.telefone),
      avatar: Formulario.texto(corpo.avatar) ?? '👤',
      recado: Formulario.texto(corpo.recado)
    };

    let atualizado;

    try {
      atualizado = await Usuario.atualizarPorId(req.usuario.id, dados);
    } catch (erro) {
      const falha = Controlador.erroDoUsuario(erro);
      return UsuarioController.renderizarPerfil(res, req.usuario, { dados, erro: falha, status: falha.status });
    }

    // Mantem a sessao em dia com o novo nome e avatar.
    req.session.usuario = {
      ...req.session.usuario,
      nome: atualizado.nome,
      nomeExibicao: atualizado.nomeExibicao,
      avatar: atualizado.avatar
    };

    req.avisar('sucesso', 'Perfil atualizado.');
    res.redirect('/perfil');
  }

  // POST /perfil/status - online, ausente, ocupado ou offline.
  static async alterarStatus(req, res) {
    const status = Formulario.texto(Formulario.corpo(req).status);

    try {
      await Usuario.alterarStatus(req.usuario.id, status);
      req.avisar('sucesso', `Status alterado para "${status}".`);
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect(Controlador.destinoSeguro(Formulario.corpo(req).voltar, '/perfil'));
  }

  // POST /perfil/senha - confere a senha atual antes de gravar a nova.
  static async alterarSenha(req, res) {
    const corpo = Formulario.corpo(req);
    const senhaAtual = Formulario.senha(corpo.senhaAtual);
    const novaSenha = Formulario.senha(corpo.novaSenha);
    const confirmacao = Formulario.senha(corpo.confirmacao);

    try {
      if (novaSenha && novaSenha !== confirmacao) {
        throw new ErroValidacao('A confirmacao da nova senha nao confere', ['Campo "confirmacao" deve ser igual a "novaSenha"'], {
          operacao: 'UsuarioController.alterarSenha',
          detalhes: { usuarioId: req.usuario.id }
        });
      }

      await Usuario.alterarSenha(req.usuario.id, senhaAtual, novaSenha);
      req.avisar('sucesso', 'Senha alterada com sucesso.');
    } catch (erro) {
      Controlador.avisarErro(req, erro);
    }

    res.redirect('/perfil#senha');
  }

  // POST /perfil/excluir - exclui a conta (com confirmacao de senha) e encerra a sessao.
  static async excluirConta(req, res) {
    const senha = Formulario.senha(Formulario.corpo(req).senha);

    try {
      await ChatService.excluirConta(req.usuario.id, senha);
    } catch (erro) {
      Controlador.avisarErro(req, erro);
      return res.redirect('/perfil#excluir');
    }

    await Controlador.encerrarSessao(req, res);
    res.redirect('/login?motivo=conta-excluida');
  }
}

module.exports = UsuarioController;
