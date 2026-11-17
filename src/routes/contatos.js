'use strict';

// Rotas de /contatos (todas exigem login).

const express = require('express');
const ContatoController = require('../controllers/ContatoController');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = express.Router();

router.use(exigirLogin);

router.get('/', ContatoController.listar);
router.post('/', ContatoController.adicionar);
router.get('/:id/editar', ContatoController.exibirEdicao);
router.post('/atualizar', ContatoController.atualizar);
router.post('/excluir', ContatoController.excluir);

module.exports = router;
