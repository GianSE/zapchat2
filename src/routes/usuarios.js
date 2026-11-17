'use strict';

/**
 * Rotas de usuarios e do perfil do usuario logado. Todas protegidas.
 */

const express = require('express');
const UsuarioController = require('../controllers/UsuarioController');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = express.Router();

// Este router e montado em "/": o middleware e aplicado rota a rota para nao
// interceptar enderecos inexistentes (que devem responder 404).
// Usuarios cadastrados (GET com parametros ?busca= e ?pagina=)
router.get('/usuarios', exigirLogin, UsuarioController.listar);
router.get('/usuarios/:id', exigirLogin, UsuarioController.detalhar);

// Meu perfil (POST com os dados do formulario)
router.get('/perfil', exigirLogin, UsuarioController.exibirPerfil);
router.post('/perfil/atualizar', exigirLogin, UsuarioController.atualizarPerfil);
router.post('/perfil/status', exigirLogin, UsuarioController.alterarStatus);
router.post('/perfil/senha', exigirLogin, UsuarioController.alterarSenha);
router.post('/perfil/excluir', exigirLogin, UsuarioController.excluirConta);

module.exports = router;
