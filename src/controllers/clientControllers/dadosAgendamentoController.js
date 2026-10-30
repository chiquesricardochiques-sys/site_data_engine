
const salaoApi = require('../../services/salaoApi.service');

// ============================================================
// Helpers
// ============================================================

function verificarLogin(req) {
    return Boolean(
        req.session?.cliente?.auth_user_id
    );
}

function dadosView(req, dados = {}) {
    return {
        styleClient: 'styleScheduleDetails.css',
        client: true,
        logado: verificarLogin(req),
        ...dados
    };
}

// ID interno do cliente em clientes_auth_vinculos.
// Mantém o ID na sessão para evitar uma nova consulta
// ao Go a cada acesso à tela.
async function obterIdClienteSessao(req) {
    const cliente = req.session.cliente;

    if (cliente.id_cliente) {
        return cliente.id_cliente;
    }

    const idCliente =
        await salaoApi.obterIdCliente(
            cliente.auth_user_id
        );

    cliente.id_cliente = idCliente;

    return idCliente;
}

function formatarPreco(valor) {
    return Number(valor || 0)
        .toFixed(2)
        .replace('.', ',');
}

// "2026-10-26" -> "26/10/2026"
function formatarData(iso) {
    const partes =
        String(iso || '').split('-');

    if (partes.length !== 3) {
        return '';
    }

    const [ano, mes, dia] = partes;

    if (!ano || !mes || !dia) {
        return '';
    }

    return `${dia}/${mes}/${ano}`;
}

// "2026-10-24 17:30"
// -> "24/10/2026 às 17:30"
function formatarDataHora(texto) {
    const partes =
        String(texto || '').split(' ');

    const data = partes[0];
    const hora = partes[1];

    if (!data) {
        return '';
    }

    const dataFormatada =
        formatarData(data);

    return (
        dataFormatada +
        (hora ? ` às ${hora}` : '')
    );
}

// 90 -> "1h 30min"
// 45 -> "45 min"
// 60 -> "1h"
function formatarDuracao(minutos) {
    const total =
        Number(minutos) || 0;

    if (total <= 0) {
        return '0 min';
    }

    const horas =
        Math.floor(total / 60);

    const resto =
        total % 60;

    if (horas && resto) {
        return `${horas}h ${resto}min`;
    }

    if (horas) {
        return `${horas}h`;
    }

    return `${resto} min`;
}

function soDigitos(valor) {
    return String(valor || '')
        .replace(/\D/g, '');
}

// Número para WhatsApp com DDI 55.
function numeroWhatsapp(valor) {
    const digitos =
        soDigitos(valor);

    if (
        digitos.length === 10 ||
        digitos.length === 11
    ) {
        return `55${digitos}`;
    }

    if (digitos.length >= 12) {
        return digitos;
    }

    return '';
}

// ============================================================
// Preparação dos dados para a View
// ============================================================

function montarView(agendamento) {
    const ag =
        agendamento || {};

    const profissional =
        ag.profissional || {};

    const salao =
        ag.salao || {};

    const diaSemana =
        String(
            ag.dia_semana || ''
        );

    const whatsapp =
        numeroWhatsapp(
            salao.whatsapp
        );

    const telefone =
        soDigitos(
            salao.telefone
        );

    const local = [
        salao.endereco,
        [
            salao.cidade,
            salao.estado
        ]
            .filter(Boolean)
            .join(' - ')
    ]
        .filter(Boolean)
        .join(', ');

    /*
     * O backend já entrega:
     *
     * hora       = hora_marcada
     * hora_fim   = hora_marcada + duracao_minutos
     *
     * O Node apenas formata para a tela.
     */
    return {
        id: ag.id,

        status: ag.status,

        status_label:
            ag.status_label,

        dia_semana:
            diaSemana
                ? (
                    diaSemana
                        .charAt(0)
                        .toUpperCase() +
                    diaSemana.slice(1)
                )
                : '',

        data_fmt:
            formatarData(
                ag.data
            ),

        hora:
            ag.hora || '',

        hora_fim:
            ag.hora_fim || '',

        duracao_minutos:
            Number(
                ag.duracao_minutos
            ) || 0,

        duracao_fmt:
            formatarDuracao(
                ag.duracao_minutos
            ),

        preco_total:
            Number(
                ag.preco_total
            ) || 0,

        preco_total_fmt:
            formatarPreco(
                ag.preco_total
            ),

        observacao:
            ag.observacao || '',

        criado_em:
            ag.criado_em || '',

        criado_em_fmt:
            formatarDataHora(
                ag.criado_em
            ),

        profissional: {
            ...profissional,

            nome:
                profissional.nome || '',

            especialidade:
                profissional.especialidade || '',

            foto_url:
                profissional.foto_url || '',

            inicial:
                String(
                    profissional.nome || '?'
                )
                    .charAt(0)
                    .toUpperCase()
        },

        salao: {
            nome:
                salao.nome || '',

            local,

            telefone:
                salao.telefone || '',

            telefone_link:
                telefone
                    ? `tel:${telefone}`
                    : '',

            whatsapp:
                salao.whatsapp || '',

            whatsapp_link:
                whatsapp
                    ? `https://wa.me/${whatsapp}`
                    : ''
        },

        servicos:
            Array.isArray(ag.servicos)
                ? ag.servicos.map(
                    servico => ({
                        ...servico,

                        qtd_label:
                            Number(
                                servico.quantidade
                            ) > 1
                                ? `${servico.quantidade}x `
                                : '',

                        duracao_fmt:
                            formatarDuracao(
                                servico.duracao_minutos
                            ),

                        subtotal:
                            Number(
                                servico.subtotal
                            ) || 0,

                        subtotal_fmt:
                            formatarPreco(
                                servico.subtotal
                            ),

                        preco_unitario_fmt:
                            formatarPreco(
                                servico.preco_unitario
                            )
                    })
                )
                : []
    };
}

// ============================================================
// GET /client/my-schedules/details/:id
// ============================================================

async function mostrarDados(req, res) {

    if (!verificarLogin(req)) {
        return res.redirect('/login');
    }

    const agendamentoId =
        Number(req.params.id);

    if (
        !Number.isInteger(
            agendamentoId
        ) ||
        agendamentoId <= 0
    ) {
        return res
            .status(400)
            .render(
                'client/schedule-details',
                dadosView(req, {
                    erro: 'Agendamento inválido.'
                })
            );
    }

    try {

        const idCliente =
            await obterIdClienteSessao(req);

        const result =
            await salaoApi.dadosAgendamento({
                auth_user_id:
                    req.session.cliente.auth_user_id,

                id_cliente:
                    idCliente,

                agendamento_id:
                    agendamentoId
            });

        /*
         * O Go já validou:
         *
         * - salão
         * - cliente
         * - agendamento
         * - status pendente
         *
         * Aqui apenas preparamos os dados
         * para a View.
         */
        return res.render(
            'client/schedule-details',
            dadosView(req, {
                agendamento:
                    montarView(
                        result.data
                    )
            })
        );

    } catch (error) {

        console.error(
            'Erro ao carregar dados do agendamento:',
            error
        );

        let status = 500;

        let mensagem =
            'Não foi possível carregar os dados do agendamento. Tente novamente.';

        if (error.status === 400) {

            status = 400;

            mensagem =
                'Agendamento inválido.';

        } else if (error.status === 404) {

            status = 404;

            mensagem =
                'Agendamento não encontrado.';

        } else if (error.status === 409) {

            status = 409;

            mensagem =
                error.message ||
                'Só é possível ver os detalhes de agendamentos pendentes.';
        }

        return res
            .status(status)
            .render(
                'client/schedule-details',
                dadosView(req, {
                    erro: mensagem
                })
            );
    }
}

module.exports = {
    mostrarDados
};
