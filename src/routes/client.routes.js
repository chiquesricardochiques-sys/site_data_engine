const express = require('express');

const router = express.Router();

const publicRouters = require('./public.routes');

const clientController = require('../controllers/clientController');
// const authClient = require('../middlewares/authClient');

// Todas as rotas do cliente precisam de autenticação
// router.use(authClient);

router.use('/', publicRouters);

// Home do cliente
router.get('/', clientController.home);

// AJAX - horários disponíveis
router.get('/ajax/horarios', clientController.horariosAjax);
router.post('/client/schedule/servicos', clientController.servicosAjax);

// Agendamento
router.get('/schedule', clientController.mostrarAgendamento);
router.post('/schedule', clientController.agendarHorario);

// Meus agendamentos
router.get('/my-schedules', clientController.meusAgendamentos);
router.get('/my-schedules/history', clientController.historicoAgendamentos);
router.post('/my-schedules/delete', clientController.deletarAgendamento);
router.get('/my-schedules/details/:id', clientController.mostrarDados);

// Perfil
router.get('/profile', clientController.mostrarPerfil);

// Perfil — tela de alteração
router.get('/profile/edit', clientController.mostrarAlterarPerfil);

router.post('/profile', clientController.atualizarPerfil);

module.exports = router;