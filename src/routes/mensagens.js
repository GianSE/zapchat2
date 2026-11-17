'use strict';

/**
 * Rotas de mensagens e reacoes. Montadas em "/mensagens" e todas protegidas.
 */

const express = require('express');
const MensagemController = require('../controllers/MensagemController');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = express.Router();

router.use(exigirLogin);

router.post('/', MensagemController.enviar);
router.get('/busca', MensagemController.buscar);
router.post('/atualizar', MensagemController.atualizar);
router.post('/excluir', MensagemController.excluir);
router.post('/fixar', MensagemController.fixar);
router.post('/reagir', MensagemController.reagir);
router.get('/:id/editar', MensagemController.exibirEdicao);

module.exports = router;
