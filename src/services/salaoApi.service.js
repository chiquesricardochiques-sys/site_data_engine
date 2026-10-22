// ============================================================
// salaoApi.service.js
//
// Único ponto de comunicação do site com a API Go do salão.
// Os controllers só chamam as funções daqui.
//
// Variáveis de ambiente (.env):
//   API_URL         URL base da API Go          (ex.: http://localhost:8080)
//   SALAO_ID        ID do salão deste site      (ex.: 1)
//   API_TIMEOUT_MS  tempo máximo por chamada    (opcional, padrão 10000)
// ============================================================
// ------------------------------------------------------------
// CONFIGURAÇÃO
// ------------------------------------------------------------

const EM_PRODUCAO = process.env.NODE_ENV === 'production';

const API_URL = (
    process.env.API_URL ||
    (EM_PRODUCAO ? '' : 'http://localhost:8080')
).replace(/\/+$/, '');

if (!API_URL) {
    throw new Error(
        'API_URL não foi configurada nas variáveis de ambiente.'
    );
}

const SALAO_ID = Number(process.env.SALAO_ID);

if (!Number.isInteger(SALAO_ID) || SALAO_ID <= 0) {
    throw new Error(
        'SALAO_ID não foi configurado corretamente nas variáveis de ambiente.'
    );
}

const TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS) > 0
    ? Number(process.env.API_TIMEOUT_MS)
    : 10000;

const STATUS_VALIDOS = [
    'pendente',
    'confirmado',
    'cancelado',
    'concluido',
    'nao_compareceu'
];

// ------------------------------------------------------------
// BASE
// ------------------------------------------------------------

// Erro de validação feito aqui no Node (antes de chamar o Go).
// Tem status 400 para o controller tratar igual aos erros do Go.
function erroValidacao(mensagem) {
    const error = new Error(mensagem);
    error.status = 400;
    return error;
}

function idPositivo(valor, mensagem) {
    const numero = Number(valor);

    if (!Number.isInteger(numero) || numero <= 0) {
        throw erroValidacao(mensagem);
    }

    return numero;
}

function statusOpcional(status) {
    if (!status) return null;

    if (!STATUS_VALIDOS.includes(status)) {
        throw erroValidacao('Status inválido.');
    }

    return status;
}

// POST na API Go. O salao_id vai sempre junto, os controllers
// não precisam se preocupar com ele.
async function request(endpoint, body = {}) {
    let response;

    try {
        response = await fetch(`${API_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ salao_id: SALAO_ID, ...body }),
            signal: AbortSignal.timeout(TIMEOUT_MS)
        });
    } catch (cause) {
        const error = new Error('Não foi possível falar com a API.');
        error.status = 503;
        error.cause = cause;
        throw error;
    }

    const responseText = await response.text();

    let data = null;

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { message: responseText };
        }
    }

    if (!response.ok || !data || data.success !== true) {
        const error = new Error(
            data?.message ||
            data?.error ||
            `Erro na API Go: HTTP ${response.status}`
        );

        error.status = response.ok ? 502 : response.status;
        error.data = data;

        throw error;
    }

    return data;
}

// ============================================================
// HOME
// ============================================================

// Home pública (sem login)
async function home() {
    return request('/home');
}

// Home do cliente logado (identificado pelo auth_user_id da sessão)
//
// Retorna { success, data: { textos, salao, profissionais,
//   proximo_agendamento } }
async function clientHome(auth_user_id) {
    return request('/client-home', {
        auth_user_id: idPositivo(auth_user_id, 'Usuário inválido. Faça login novamente.')
    });
}

// ============================================================
// AGENDAMENTO
// ============================================================

// Retorna { success, data: { usa_horarios, horarios: [
//   { hora, disponivel, motivo?, agendamento?, servicos? } ] } }
async function buscarHorarios(profissional_id, data) {
    if (!data) {
        throw erroValidacao('Data é obrigatória.');
    }

    return request('/horarios-disponiveis', {
        profissional_id: idPositivo(profissional_id, 'Profissional inválido.'),
        data
    });
}

// Dados da tela de agendamento (profissional e data são opcionais)
async function schedulePage(profissional_id = null, data = null) {
    const body = {};

    if (profissional_id) {
        body.profissional_id = idPositivo(profissional_id, 'Profissional inválido.');
    }

    if (data) {
        body.data = data;
    }

    return request('/schedule-page', body);
}

async function agendarHorario({
    auth_user_id,
    servico_ids,
    profissional_id,
    data,
    hora,
    observacoes = null
}) {
    const authUserID = idPositivo(auth_user_id, 'Usuário inválido. Faça login novamente.');

    if (!Array.isArray(servico_ids) || servico_ids.length === 0) {
        throw erroValidacao('Selecione pelo menos um serviço.');
    }

    const servicos = servico_ids
        .map(Number)
        .filter(id => Number.isInteger(id) && id > 0);

    if (servicos.length !== servico_ids.length) {
        throw erroValidacao('Serviços selecionados são inválidos.');
    }

    const profissionalID = idPositivo(profissional_id, 'Profissional inválido.');

    if (!data) {
        throw erroValidacao('Selecione uma data.');
    }

    if (!hora) {
        throw erroValidacao('Selecione um horário.');
    }

    return request('/agendar', {
        auth_user_id: authUserID,
        servico_ids: servicos,
        profissional_id: profissionalID,
        data,
        hora,
        observacoes: observacoes || null
    });
}

// ============================================================
// MEUS AGENDAMENTOS
//
// Retorna { success, data: { textos, cenario, status, agendamentos: [
//   { id, data, hora, hora_fim, status, observacoes, profissional,
//     servicos: [{ nome, preco, duracao_min, quantidade }],
//     duracao_total, preco_total, pode_cancelar } ] } }
// ============================================================

// De hoje em diante, ainda ativos
async function meusAgendamentos({ auth_user_id, status = null }) {
    return request('/my-schedules', {
        auth_user_id: idPositivo(auth_user_id, 'Usuário inválido. Faça login novamente.'),
        cenario: 'meus_agendamentos',
        status: statusOpcional(status)
    });
}

// Passados, concluídos, cancelados e não compareceu
async function historicoAgendamentos({ auth_user_id, status = null }) {
    return request('/historico-agendamentos', {
        auth_user_id: idPositivo(auth_user_id, 'Usuário inválido. Faça login novamente.'),
        status: statusOpcional(status)
    });
}

// A rota se chama "deletar", mas só muda o status para 'cancelado'
async function cancelarAgendamento({ auth_user_id, agendamento_id }) {
    return request('/deletar-agendamento', {
        auth_user_id: idPositivo(auth_user_id, 'Usuário inválido. Faça login novamente.'),
        agendamento_id: idPositivo(agendamento_id, 'Agendamento inválido.')
    });
}
module.exports = {
    // home
    home,
    clientHome,
    // agendar
    buscarHorarios,
    schedulePage,
    agendarHorario,
    // meus agendamentos
    meusAgendamentos,
    historicoAgendamentos,
    cancelarAgendamento
};