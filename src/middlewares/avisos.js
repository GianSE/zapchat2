'use strict';

// Avisos que aparecem depois de um redirect (ficam guardados na sessao).

function avisos(req, res, next) {
  // Avisos gravados na requisicao anterior: exibidos agora e descartados.
  res.locals.avisos = req.session.avisos ?? [];
  if (req.session.avisos) delete req.session.avisos;

  // Dados basicos do usuario logado (o middleware de autenticacao os atualiza).
  res.locals.usuarioLogado = req.session.usuario ?? null;
  res.locals.caminhoAtual = req.path;

  // Registra um aviso para a proxima pagina.
  req.avisar = (tipo, texto, itens = []) => {
    req.session.avisos = [...(req.session.avisos ?? []), { tipo, texto, itens }];
  };

  next();
}

module.exports = avisos;
