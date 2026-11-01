const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');


router.get('/register', publicController.mostrarCadastro);
router.post('/register', publicController.registrarCliente);

// Confirmação de e-mail
router.get(
    '/verify-email',
    publicController.mostrarVerificacaoEmail
);

router.post(
    '/verify-email',
    publicController.validarEmail
);


router.get('/login', publicController.mostrarLogin);
router.post('/login', publicController.loginCliente);
router.get('/logout', publicController.logoutCliente);
// router.get('/forgot-password', publicController.mostrarRecuperarSenha);
// router.post('/forgot-password', publicController.enviarRecuperacao);

// router.get('/reset-senha', publicController.mostrarResetSenha);
// router.post('/reset-senha', publicController.resetarSenha);


// Esqueci minha senha: exibe o formulário
router.get(
    '/forgot-password',
    publicController.mostrarEsqueciSenha
);

// Envia e-mail, nova senha e confirmação para a API
router.post(
    '/forgot-password',
    publicController.solicitarRecuperacao
);

// Mostra a tela para digitar o código
router.get(
    '/verify-recovery',
    publicController.mostrarValidacaoRecuperacao
);

// Valida o código recebido
router.post(
    '/verify-recovery',
    publicController.validarRecuperacao
);



module.exports = router;
