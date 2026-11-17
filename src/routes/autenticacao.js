'use strict';

// Login e cadastro sao publicos; logout exige sessao.

const express = require('express');
const AutenticacaoController = require('../controllers/AutenticacaoController');
const { exigirLogin, somenteVisitante } = require('../middlewares/autenticacao');

const router = express.Router();

router.get('/login', somenteVisitante, AutenticacaoController.exibirLogin);
router.post('/login', somenteVisitante, AutenticacaoController.entrar);

router.get('/cadastro', somenteVisitante, AutenticacaoController.exibirCadastro);
router.post('/cadastro', somenteVisitante, AutenticacaoController.cadastrar);

router.post('/logout', exigirLogin, AutenticacaoController.sair);

module.exports = router;
