'use strict';

// Converte os erros da aplicacao em status HTTP e mensagem para o usuario.
// Os detalhes tecnicos ficam so no log.

const {
  ErroAplicacao,
  ErroValidacao,
  ErroAutenticacao,
  ErroPermissao,
  ErroNaoEncontrado,
  ErroRegraNegocio,
  ErroBanco,
  ErroConexao
} = require('../errors');

// Erros do driver que indicam que o servidor do MongoDB esta fora do ar.
const FALHAS_DE_REDE = /MongoServerSelectionError|MongoNetworkError|MongoNetworkTimeoutError|MongoTopologyClosedError/;

class RespostaErro {
  // Indica se o erro do banco e uma queda de conexao com o MongoDB.
  static ehQuedaDoBanco(erro) {
    return erro instanceof ErroBanco && FALHAS_DE_REDE.test(erro.causa?.name ?? '');
  }

  // Indica se o erro do banco e a violacao de um indice unico (codigo 11000),
  // como um e-mail ja cadastrado.
  static ehDuplicidade(erro) {
    return erro instanceof ErroBanco && erro.detalhes?.codigo === 11000;
  }

  // Codigo HTTP correspondente a excecao.
  static status(erro) {
    if (erro instanceof ErroValidacao) return 400;
    if (erro instanceof ErroAutenticacao) return 401;
    if (erro instanceof ErroPermissao) return 403;
    if (erro instanceof ErroNaoEncontrado) return 404;
    if (erro instanceof ErroRegraNegocio) return 409;
    if (RespostaErro.ehDuplicidade(erro)) return 409;
    if (erro instanceof ErroConexao || RespostaErro.ehQuedaDoBanco(erro)) return 503;

    // Erros do Express/body-parser (JSON malformado, corpo grande demais...)
    // e da biblioteca http-errors ja trazem o status adequado.
    const statusHttp = Number(erro?.status ?? erro?.statusCode);
    if (statusHttp >= 400 && statusHttp < 600) return statusHttp;

    return 500;
  }

  // Indica se o erro foi causado pelos dados que o usuario enviou e, portanto,
  // pode ser mostrado de volta no proprio formulario.
  static ehErroDoUsuario(erro) {
    return (
      erro instanceof ErroValidacao ||
      erro instanceof ErroAutenticacao ||
      erro instanceof ErroPermissao ||
      erro instanceof ErroNaoEncontrado ||
      erro instanceof ErroRegraNegocio ||
      RespostaErro.ehDuplicidade(erro)
    );
  }

  // Mensagem segura para exibir ao usuario.
  static paraUsuario(erro) {
    const status = RespostaErro.status(erro);

    if (erro instanceof ErroValidacao) {
      return { titulo: 'Dados inválidos', mensagem: erro.message, itens: erro.erros ?? [] };
    }

    if (erro instanceof ErroConexao || RespostaErro.ehQuedaDoBanco(erro)) {
      return {
        titulo: 'Banco de dados indisponível',
        mensagem: 'Não foi possível acessar o MongoDB no momento. Verifique se o serviço está em execução e tente novamente.',
        itens: []
      };
    }

    if (RespostaErro.ehDuplicidade(erro)) {
      return { titulo: 'Registro duplicado', mensagem: erro.message, itens: [] };
    }

    if (erro instanceof ErroAplicacao && !(erro instanceof ErroBanco)) {
      const titulos = { 401: 'Acesso negado', 403: 'Sem permissão', 404: 'Não encontrado', 409: 'Operação não permitida' };
      return { titulo: titulos[status] ?? 'Não foi possível concluir', mensagem: erro.message, itens: [] };
    }

    if (status === 404) {
      return { titulo: 'Página não encontrada', mensagem: 'O endereço acessado não existe.', itens: [] };
    }

    if (status >= 400 && status < 500) {
      return { titulo: 'Requisição inválida', mensagem: 'Os dados enviados não puderam ser processados.', itens: [] };
    }

    // Falhas inesperadas e erros do driver: mensagem generica, detalhes so no log.
    return {
      titulo: 'Erro interno',
      mensagem: 'Ocorreu um erro inesperado ao processar a requisição. O problema foi registrado no log.',
      itens: []
    };
  }
}

module.exports = RespostaErro;
