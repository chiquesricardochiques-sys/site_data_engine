const salaoApi = require('../../services/salaoApi.service');

// Brasil não tem horário de verão desde 2019: horário de Brasília = -03:00.
// O contador usa o instante exato (epoch), então funciona
// mesmo se o aparelho do cliente estiver em outro fuso.
const FUSO_SALAO = '-03:00';

const ROTULOS_STATUS = {
    pendente: 'Pendente',
    confirmado: 'Confirmado'
};

// ============================================================
// Helpers
// ============================================================

function formatarData(iso) {
    const [ano, mes, dia] = String(iso).split('-');
    return `${dia}/${mes}/${ano}`;
}

function montarUrlMapa(salao) {
    if (!salao?.endereco) return null;

    const endereco = [
        salao.endereco,
        salao.cidade,
        salao.estado
    ].filter(Boolean).join(', ');

    return 'https://www.google.com/maps/search/?api=1&query=' +
        encodeURIComponent(endereco);
}

function montarUrlWhatsapp(salao) {
    if (!salao?.whatsapp) return null;

    let numero = String(salao.whatsapp).replace(/\D/g, '');

    if (!numero) return null;

    if (!numero.startsWith('55')) {
        numero = `55${numero}`;
    }

    const mensagem = encodeURIComponent(
        `Olá, ${salao.nome || 'gostaria de tirar uma dúvida'}!`
    );

    return `https://wa.me/${numero}?text=${mensagem}`;
}

// Profissional sem foto: a view mostra a inicial do nome no lugar
function prepararProfissionais(lista) {
    return (lista || []).map(profissional => ({
        ...profissional,
        inicial: String(profissional.nome || '?').trim().charAt(0).toUpperCase()
    }));
}

function prepararProximoAgendamento(item) {
    if (!item) return null;

    const inicio = new Date(item.inicio);
    const fim = new Date(item.fim);

    const inicioValido = !Number.isNaN(inicio.getTime());
    const fimValido = !Number.isNaN(fim.getTime());

    const dataBase = inicioValido
        ? inicio.toLocaleDateString('en-CA', {
            timeZone: 'America/Sao_Paulo'
        })
        : null;

    return {
        ...item,

        data_fmt: dataBase
            ? formatarData(dataBase)
            : null,

        hora: inicioValido
            ? inicio.toLocaleTimeString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit'
            })
            : null,

        hora_fim: fimValido
            ? fim.toLocaleTimeString('pt-BR', {
                timeZone: 'America/Sao_Paulo',
                hour: '2-digit',
                minute: '2-digit'
            })
            : null,

        status_label: ROTULOS_STATUS[item.status] || item.status,

        inicio_ms: inicioValido ? inicio.getTime() : null,
        fim_ms: fimValido ? fim.getTime() : null
    };
}
// Home do cliente logado. Se o /client-home falhar, a página ainda
// abre com a home pública (só fica sem o cartão do próximo agendamento).
async function carregarHomeCliente(authUserId) {
    try {
        return await salaoApi.clientHome(authUserId);
    } catch (error) {
        console.error(
            'Erro ao carregar /client-home, usando home pública:',
            error.data || error.message
        );

        return salaoApi.home();
    }
}

// ============================================================
// GET /home
// ============================================================

async function home(req, res) {
    try {
        const cliente = req.session?.cliente || null;
        const logado = Boolean(cliente?.auth_user_id);

        const result = logado
            ? await carregarHomeCliente(cliente.auth_user_id)
            : await salaoApi.home();

        const data = result.data || {};
        const salao = data.salao || null;

        const urlMapa = montarUrlMapa(salao);
        const urlWhatsapp = montarUrlWhatsapp(salao);

        return res.render('client/home', {
            styleClient: 'homeStyle.css',
            client: true,

            logado,
            cliente: logado ? cliente : null,

            textos: data.textos || {},
            salao,
            profissionais: prepararProfissionais(data.profissionais),
            proximoAgendamento: prepararProximoAgendamento(
                data.proximo_agendamento
            ),

            // cartão de localização e ações
            urlMapa,
            urlWhatsapp,
            temAcoes: Boolean(urlMapa || urlWhatsapp || logado)
        });

    } catch (error) {
        console.error(
            'Erro ao carregar Home:',
            error.data || error.message
        );

        return res.status(500).send('Erro ao carregar página inicial');
    }
}

module.exports = {
    home
};