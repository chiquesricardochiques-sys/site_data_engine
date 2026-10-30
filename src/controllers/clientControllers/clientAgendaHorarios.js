const salaoApi = require('../../services/salaoApi.service');

const REGEX_DATA = /^\d{4}-\d{2}-\d{2}$/;

// ============================================================
// Helpers
// ============================================================

function verificarLogin(req) {
    return Boolean(req.session?.cliente?.auth_user_id);
}

function dadosViewAgendamento(req, dados = {}) {
    return {
        styleClient: 'styleSchedule.css',
        client: true,
        logado: verificarLogin(req),
        ...dados
    };
}

// Mensagem de erro que sobrevive ao redirect (lida uma vez só).
function guardarErro(req, mensagem) {
    if (req.session) {
        req.session.erroAgendamento = mensagem;
    }
}

function lerErro(req) {
    const mensagem = req.session?.erroAgendamento || null;

    if (req.session) {
        delete req.session.erroAgendamento;
    }

    return mensagem;
}

// Monta /client/schedule?profissional_id=..&data=..&servico_id=..&servico_id=..
function urlAgendamento({
    profissional_id,
    data,
    servico_ids = []
} = {}) {
    const params = new URLSearchParams();

    if (profissional_id) {
        params.set('profissional_id', String(profissional_id));
    }

    if (data && REGEX_DATA.test(data)) {
        params.set('data', data);
    }

    servico_ids.forEach(id => {
        params.append('servico_id', String(id));
    });

    const query = params.toString();

    return `/client/schedule${query ? `?${query}` : ''}`;
}

function normalizarIds(valor) {
    if (!valor) return [];

    const lista = Array.isArray(valor) ? valor : [valor];

    return lista
        .map(Number)
        .filter(id => Number.isInteger(id) && id > 0);
}

function formatarPreco(valor) {
    return Number(valor || 0).toFixed(2).replace('.', ',');
}

// id_cliente interno (tabela clientes_auth_vinculos).
// Fica guardado na sessão para não consultar o Go a cada agendamento:
// só o primeiro agendamento de cada login faz a consulta.
async function obterIdClienteSessao(req) {
    const cliente = req.session.cliente;

    if (cliente.id_cliente) {
        return cliente.id_cliente;
    }

    const idCliente = await salaoApi.obterIdCliente(cliente.auth_user_id);

    cliente.id_cliente = idCliente;

    return idCliente;
}

// ============================================================
// AJAX - horários disponíveis
// Responde: { usa_horarios, horarios }
// ============================================================

async function horariosAjax(req, res) {
    const { profissional_id, data } = req.query;

    if (!profissional_id || !data || !REGEX_DATA.test(String(data))) {
        return res.status(400).json({
            erro: 'Informe profissional e data.'
        });
    }

    try {
        const result = await salaoApi.buscarHorarios(
            profissional_id,
            String(data)
        );

        return res.json({
            usa_horarios: result?.data?.usa_horarios ?? 1,
            horarios: result?.data?.horarios ?? []
        });

    } catch (error) {
        console.error('Erro ao buscar horários disponíveis:', error);

        return res.status(error.status === 400 ? 400 : 500).json({
            erro: 'Erro ao carregar horários.'
        });
    }
}

// ============================================================
// GET /schedule - mostrar tela de agendamento
// ============================================================

async function mostrarAgendamento(req, res) {
    const profissionalQuery = Number(req.query.profissional_id);

    const profissionalValido =
        Number.isInteger(profissionalQuery) && profissionalQuery > 0
            ? profissionalQuery
            : null;

    const dataQuery = String(req.query.data || '');

    const dataValida = REGEX_DATA.test(dataQuery)
        ? dataQuery
        : null;

    try {
        const result = await salaoApi.schedulePage(
            profissionalValido,
            dataValida
        );

        const dados = result?.data || {};

        const {
            textos = {},
            servicos = [],
            profissionais = [],
            currentDate = null,
            horariosDisponiveis = [],
            selectedProfissional = null,
            selectedData = null,
            usa_horarios = 1
        } = dados;

        const servicosSelecionados = normalizarIds(req.query.servico_id);

        // Campos prontos pra view (a tela usa "selecionado" para marcar os cards)
        const servicosView = servicos.map(servico => ({
            ...servico,
            preco_fmt: formatarPreco(servico.preco),
            selecionado: servicosSelecionados.includes(servico.id)
        }));

        const profissionaisView = profissionais.map(profissional => ({
            ...profissional,
            rotulo: profissional.especialidade
                ? `${profissional.nome} — ${profissional.especialidade}`
                : profissional.nome,
            selecionado: profissional.id === selectedProfissional
        }));

        return res.render(
            'client/schedule',
            dadosViewAgendamento(req, {
                error: lerErro(req),
                textos,
                servicos: servicosView,
                profissionais: profissionaisView,
                currentDate,
                horariosDisponiveis,
                selectedServicos: servicosSelecionados,
                selectedProfissional,
                selectedData,
                usa_horarios,
                semHorarios: Number(usa_horarios) === 0
            })
        );

    } catch (error) {
        console.error('Erro ao carregar tela de agendamento:', error);

        // Profissional/data da URL inválidos:
        // tenta novamente sem parâmetros.
        if (
            (error.status === 400 || error.status === 404) &&
            (profissionalValido || dataValida)
        ) {
            return res.redirect('/client/schedule');
        }

        return res.status(500).send('Erro ao carregar agendamento');
    }
}

// ============================================================
// POST /schedule - criar agendamento
// ============================================================

async function agendarHorario(req, res) {
    const {
        servico_id,
        profissional_id,
        data,
        hora,
        observacoes
    } = req.body;

    const servico_ids = normalizarIds(servico_id);

    // Para onde voltar se algo der errado
    const voltar = urlAgendamento({
        profissional_id,
        data,
        servico_ids
    });

    try {
        // O Go identifica o cliente pelo id interno (id_cliente)
        const id_cliente = await obterIdClienteSessao(req);

        const result = await salaoApi.agendarHorario({
            auth_user_id: req.session.cliente.auth_user_id,
            id_cliente,
            servico_ids,
            profissional_id,
            data,
            hora: hora || null,
            observacoes: observacoes || null
        });

        if (!result || result.success !== true) {
            guardarErro(
                req,
                'Não foi possível concluir o agendamento.'
            );

            return res.redirect(voltar);
        }

        return res.redirect('/client/my-schedules');

    } catch (error) {
        console.error('Erro ao criar agendamento:', error);

        // 400 / 404 / 409:
        // mensagem de negócio para o cliente.
        if ([400, 404, 409].includes(error.status)) {
            guardarErro(req, error.message);
        } else {
            guardarErro(
                req,
                'Erro ao criar agendamento. Tente novamente.'
            );
        }

        return res.redirect(voltar);
    }
}

// ============================================================
// AJAX - serviços do profissional selecionado
// Responde: { success: true, servicos: [...] }
// ============================================================

async function servicosAjax(req, res) {
    const { profissional_id } = req.body;

    const profissionalId = Number(profissional_id);

    if (!Number.isInteger(profissionalId) || profissionalId <= 0) {
        return res.status(400).json({
            success: false,
            erro: 'Informe um profissional válido.'
        });
    }

    try {
        const servicos = await salaoApi.servicosProfissional(profissionalId);

        // Formata o preço para exibição correta (ex: 50,00)
        const servicosView = servicos.map(servico => ({
            ...servico,
            preco_fmt: formatarPreco(servico.preco)
        }));

        return res.json({
            success: true,
            servicos: servicosView
        });

    } catch (error) {
        console.error('Erro ao buscar serviços do profissional via AJAX:', error);

        return res.status(500).json({
            success: false,
            erro: 'Erro ao carregar serviços.'
        });
    }
}

module.exports = {
    horariosAjax,
    mostrarAgendamento,
    agendarHorario,
    servicosAjax
};