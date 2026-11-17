'use strict';

/**
 * Rotas gerais: pagina inicial, painel e estatisticas.
 */

const express = require('express');
const PainelController = require('../controllers/PainelController');
const { exigirLogin } = require('../middlewares/autenticacao');

const router = express.Router();

router.get('/', PainelController.inicio);
router.get('/painel', exigirLogin, PainelController.exibir);
router.get('/estatisticas', exigirLogin, PainelController.estatisticas);

module.exports = router;
