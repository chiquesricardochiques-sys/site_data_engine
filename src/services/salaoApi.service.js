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

    const authUserID = idPositivo(
        auth_user_id,
        'Usuário inválido. Faça login novamente.'
    );

    // O /client-home trabalha com o id_cliente interno.
    // O vínculo Auth <-> cliente é resolvido aqui.
    const idCliente = await obterIdCliente(authUserID);

    return request('/client-home', {
        id_cliente: idCliente
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

// Descobre o id_cliente interno (tabela clientes_auth_vinculos) a partir do
// auth_user_id. Se a relação ainda não existe, ela é criada (é idempotente).
// Não envia telefone de propósito: um telefone fora do padrão não pode
// impedir o agendamento.
async function obterIdCliente(auth_user_id) {
    const resposta = await adicionarRelacaoCliente(auth_user_id);

    return idPositivo(
        resposta?.data?.id_cliente,
        'Não foi possível identificar seu cadastro. Faça login novamente.'
    );
}

async function agendarHorario({
    auth_user_id,
    id_cliente = null,
    servico_ids,
    profissional_id,
    data,
    hora,
    observacoes = null
}) {
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

    // O Go identifica o cliente pelo id interno (id_cliente).
    // Só consulta o Go se o id ainda não veio pronto da sessão.
    const idCliente = id_cliente
        ? idPositivo(id_cliente, 'Cliente inválido. Faça login novamente.')
        : await obterIdCliente(auth_user_id);

    return request('/agendar', {
        id_cliente: idCliente,
        servico_ids: servicos,
        profissional_id: profissionalID,
        data,
        hora,
        observacao: observacoes || null
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

// ============================================================
// RELAÇÃO DO CLIENTE (vínculo Auth <-> cliente do salão)
//
// Rotas do Go:
//   POST /auth/cliente/verificar
//   POST /auth/cliente/adicionar
//
// Retornam { success, message?, data: { id_cliente, telefone? } }
// Erro com status 404 = o cliente ainda não tem relação
// (ou o salão está inativo).
// ============================================================

// Só consulta a relação existente.
async function verificarRelacaoCliente(auth_user_id) {
    return request('/auth/cliente/verificar', {
        auth_user_id: idPositivo(auth_user_id, 'Usuário inválido. Faça login novamente.')
    });
}

// Cria a relação se ainda não existir.
// Se já existir, devolve a mesma e, quando o telefone é informado,
// atualiza o telefone dela. O Go normaliza e valida o número.
async function adicionarRelacaoCliente(auth_user_id, telefone = null) {
    const body = {
        auth_user_id: idPositivo(auth_user_id, 'Usuário inválido. Faça login novamente.')
    };

    const telefoneLimpo = String(telefone ?? '').trim();

    if (telefoneLimpo) {
        body.telefone = telefoneLimpo;
    }

    return request('/auth/cliente/adicionar', body);
}

// ============================================================
// DADOS DO AGENDAMENTO (tela de detalhes)
//
// Rota do Go: POST /dados-agendamento
//
// Retorna { success, data: { id, status, status_label, data, dia_semana,
//   hora, hora_fim, duracao_minutos, observacao, criado_em,
//   profissional: { id, nome, especialidade, foto_url },
//   salao: { nome, telefone, whatsapp, endereco, cidade, estado },
//   servicos: [{ id, nome, foto_url, quantidade, duracao_minutos,
//                preco_unitario, subtotal }],
//   preco_total } }
//
// Erros: 404 = não existe (ou é de outro cliente), 409 = não está pendente.
// ============================================================
async function dadosAgendamento({ auth_user_id, id_cliente = null, agendamento_id }) {
    const idCliente = id_cliente
        ? idPositivo(id_cliente, 'Cliente inválido. Faça login novamente.')
        : await obterIdCliente(auth_user_id);

    return request('/dados-agendamento', {
        id_cliente: idCliente,
        agendamento_id: idPositivo(agendamento_id, 'Agendamento inválido.')
    });
}
// Busca apenas os serviços vinculados a um profissional específico
async function servicosProfissional(profissional_id) {
    return request('/servicos-profissional', {
        profissional_id: idPositivo(profissional_id, 'Profissional inválido.')
    });
}

module.exports = {
    // home
    home,
    clientHome,
    // agendar
    buscarHorarios,
    schedulePage,
    servicosProfissional, // <-- Adicionado aqui
    agendarHorario,
    // meus agendamentos
    meusAgendamentos,
    historicoAgendamentos,
    cancelarAgendamento,
    dadosAgendamento,
    // relação do cliente
    verificarRelacaoCliente,
    adicionarRelacaoCliente,
    obterIdCliente
};