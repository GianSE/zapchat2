'use strict';

// Rotas de /conversas (todas exigem login).
// As rotas fixas ficam antes de /:id para nao serem confundidas com um id.

const express = require('express');
const ConversaController = require('../controllers/ConversaController');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = express.Router();

router.use(exigirLogin);

router.get('/', ConversaController.listar);
router.post('/', ConversaController.criarGrupo);
router.get('/novo', ConversaController.exibirNovoGrupo);
router.post('/privada', ConversaController.abrirPrivada);
router.post('/atualizar', ConversaController.atualizar);
router.post('/participantes', ConversaController.adicionarParticipante);
router.post('/participantes/remover', ConversaController.removerParticipante);
router.post('/excluir', ConversaController.excluir);

router.get('/:id', ConversaController.detalhar);
router.get('/:id/editar', ConversaController.exibirEdicao);

module.exports = router;
