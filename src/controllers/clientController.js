// home
const {home} = require("./clientControllers/clientHome")

// agendamentos
const { mostrarAgendamento, agendarHorario, horariosAjax } = require("./clientControllers/clientAgendaHorarios")


// meusAgendamentos
const {
    meusAgendamentos,
    deletarAgendamento,
    historicoAgendamentos
} = require('./clientControllers/clientMeusAgendamentos');
// perfil
const { mostrarPerfil, atualizarPerfil, mostrarAlterarPerfil } = require("./clientControllers/clientPerfil")

module.exports = {
    deletarAgendamento,
    home,
    mostrarAgendamento,
    agendarHorario,
    meusAgendamentos,
    mostrarPerfil,
    mostrarAlterarPerfil,
    atualizarPerfil,
    horariosAjax,
    historicoAgendamentos
};

