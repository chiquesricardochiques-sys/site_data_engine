const salaoApi = require('../../services/salaoApi.service');

const URL_MEUS_AGENDAMENTOS = '/client/my-schedules';

const ROTULOS_STATUS = {
    pendente: 'Pendente',
    confirmado: 'Confirmado',
    cancelado: 'Cancelado',
    concluido: 'Concluído',
    nao_compareceu: 'Não compareceu'
};

const STATUS_VALIDOS = Object.keys(ROTULOS_STATUS);

// Botões de filtro da tela de histórico
const FILTROS_HISTORICO = [
    { valor: '', rotulo: 'Todos' },
    { valor: 'concluido', rotulo: 'Concluídos' },
    { valor: 'cancelado', rotulo: 'Cancelados' },
    { valor: 'nao_compareceu', rotulo: 'Não compareceu' }
];

// ============================================================
// Helpers
// ============================================================

function verificarLogin(req) {
    return Boolean(req.session?.cliente?.auth_user_id);
}

// Mensagem que sobrevive ao redirect e é lida uma vez só.
function guardarMensagem(req, tipo, texto) {
    if (req.session) {
        req.session.mensagemAgendamentos = { tipo, texto };
    }
}

function lerMensagem(req) {
    const mensagem = req.session?.mensagemAgendamentos || null;

    if (req.session) {
        delete req.session.mensagemAgendamentos;
    }

    return {
        success: mensagem?.tipo === 'success'
            ? mensagem.texto
            : null,

        error: mensagem?.tipo === 'error'
            ? mensagem.texto
            : null
    };
}

// "2026-10-19" -> "19/10/2026"
function formatarData(iso) {
    const [ano, mes, dia] = String(iso).split('-');

    return `${dia}/${mes}/${ano}`;
}

function formatarPreco(valor) {
    return Number(valor || 0)
        .toFixed(2)
        .replace('.', ',');
}

function prepararAgendamento(item) {
    return {
        ...item,

        // O Go manda data "YYYY-MM-DD"
        data: formatarData(item.data),

        // Usado pelo contador (data-date)
        dataTime: item.data,

        preco_total_fmt: formatarPreco(item.preco_total),

        status_label:
            ROTULOS_STATUS[item.status] || item.status,

        // Link de detalhes: só aparece para agendamentos pendentes
        pendente: item.status === 'pendente',
        url_detalhes: `${'my-schedules'}/details/${item.id}`
    };
}

function renderDeslogado(res, dados) {
    return res.render('client/mySchedules', {
        styleClient: 'styleMySchedules.css',
        client: true,
        logado: false,
        agendamentos: [],
        textos: null,
        success: null,
        error: null,
        ...dados
    });
}

// ============================================================
// Listagem
// ============================================================

async function listar(req, res, { historico }) {
    const dadosTela = {
        titulo: historico ? 'Histórico' : 'Meus horários',
        ehHistorico: historico
    };

    if (!verificarLogin(req)) {
        return renderDeslogado(res, dadosTela);
    }

    try {
        // Status inválido na URL é ignorado.
        const statusQuery = String(req.query.status || '');

        const status = STATUS_VALIDOS.includes(statusQuery)
            ? statusQuery
            : null;

        const filtro = {
            auth_user_id: req.session.cliente.auth_user_id,
            status
        };

        const result = historico
            ? await salaoApi.historicoAgendamentos(filtro)
            : await salaoApi.meusAgendamentos(filtro);

        const {
            textos = {},
            agendamentos = []
        } = result.data || {};

        return res.render('client/mySchedules', {
            styleClient: 'styleMySchedules.css',
            client: true,
            logado: true,

            agendamentos: agendamentos.map(
                prepararAgendamento
            ),

            textos,

            filtros: historico
                ? FILTROS_HISTORICO.map(f => ({
                    ...f,
                    ativo: f.valor === (status || '')
                }))
                : null,

            ...lerMensagem(req),
            ...dadosTela
        });

    } catch (error) {
        console.error(
            'Erro ao carregar agendamentos:',
            error
        );

        return res.status(500).send(
            'Erro ao carregar agendamentos'
        );
    }
}

// ============================================================
// GET /my-schedules
// Meus agendamentos
// ============================================================

async function meusAgendamentos(req, res) {
    return listar(req, res, {
        historico: false
    });
}

// ============================================================
// GET /my-schedules/history
// Histórico
// ============================================================

async function historicoAgendamentos(req, res) {
    return listar(req, res, {
        historico: true
    });
}

// ============================================================
// POST /my-schedules/delete
// Cancelar agendamento
// ============================================================

async function deletarAgendamento(req, res) {
    if (!verificarLogin(req)) {
        return res.redirect('/login');
    }

    const { agendamento_id } = req.body;

    try {
        const result = await salaoApi.cancelarAgendamento({
            auth_user_id: req.session.cliente.auth_user_id,
            agendamento_id
        });

        guardarMensagem(
            req,
            'success',
            result.message ||
                'Agendamento cancelado com sucesso!'
        );

    } catch (error) {
        console.error(
            'Erro ao cancelar agendamento:',
            error
        );

        // Erros de negócio.
        if ([400, 404, 409].includes(error.status)) {
            guardarMensagem(
                req,
                'error',
                error.message
            );
        } else {
            guardarMensagem(
                req,
                'error',
                'Erro ao cancelar agendamento.'
            );
        }
    }

    return res.redirect(URL_MEUS_AGENDAMENTOS);
}

module.exports = {
    meusAgendamentos,
    historicoAgendamentos,
    deletarAgendamento
};