const authService = require('../../services/authApi.service');

// ============================================================
// Verificar sessão do cliente
// ============================================================
function verificarLogin(req) {
    return Boolean(
        req.session?.cliente?.auth_user_id
    );
}

// ============================================================
// GET /profile - mostrar perfil
// ============================================================
async function mostrarPerfil(req, res) {

    const logado = verificarLogin(req);

    // --------------------------------------------------------
    // Não autenticado
    // --------------------------------------------------------
    if (!logado) {

        return res.render('client/profile', {

            styleClient:
                'cssConponenteClient/stylePerfil.css',

            cliente: null,

            logado: false,

            success: null,

            error: null,

            textos: null,

            client: true

        });
    }

    try {

        const clienteSession =
            req.session.cliente;

        // ----------------------------------------------------
        // Usuário salvo durante o login
        // ----------------------------------------------------
        const cliente =
            clienteSession.user ||
            clienteSession.usuario ||
            clienteSession;

        console.log(
            '[PROFILE] Cliente:',
            cliente
        );

        return res.render('client/profile', {

            styleClient:
                'cssConponenteClient/stylePerfil.css',

            cliente,

            logado: true,

            success:
                req.query.success || null,

            error:
                req.query.error || null,

            textos: null,

            client: true

        });

    } catch (error) {

        console.error(
            'Erro ao carregar perfil:',
            error
        );

        return res.status(500).render(
            'client/profile',
            {

                styleClient:
                    'cssConponenteClient/stylePerfil.css',

                cliente: null,

                logado: true,

                success: null,

                error:
                    'Erro ao carregar perfil.',

                textos: null,

                client: true

            }
        );
    }
}

// ============================================================
// GET /profile/edit - tela de alteração do perfil
// ============================================================
async function mostrarAlterarPerfil(req, res) {

    // --------------------------------------------------------
    // Verificar login
    // --------------------------------------------------------
    if (!verificarLogin(req)) {
        return res.redirect('/login');
    }

    try {

        const clienteSession =
            req.session.cliente;

        // ----------------------------------------------------
        // Usuário salvo durante o login
        // ----------------------------------------------------
        const cliente =
            clienteSession.user ||
            clienteSession.usuario ||
            clienteSession;

        console.log(
            '[PROFILE EDIT] Cliente:',
            cliente
        );

        return res.render('client/edit', {

            styleClient:
                'cssConponenteClient/stylePerfil.css',

            cliente,

            logado: true,

            success:
                req.query.success || null,

            error:
                req.query.error || null,

            textos: null,

            client: true

        });

    } catch (error) {

        console.error(
            'Erro ao carregar tela de alteração do perfil:',
            error
        );

        return res.status(500).render(
            'client/edit',
            {

                styleClient:
                    'cssConponenteClient/stylePerfil.css',

                cliente: null,

                logado: true,

                success: null,

                error:
                    'Erro ao carregar perfil.',

                textos: null,

                client: true

            }
        );
    }
}

// ============================================================
// POST /profile - atualizar perfil
// ============================================================
async function atualizarPerfil(req, res) {

    // --------------------------------------------------------
    // Verificar login
    // --------------------------------------------------------
    if (!verificarLogin(req)) {
        return res.redirect('/login');
    }

    try {

        const clienteSession = req.session.cliente;

        // ----------------------------------------------------
        // Descobrir o ID da conta
        // ----------------------------------------------------
        const id =
            clienteSession.auth_user_id ||
            clienteSession.user?.id ||
            clienteSession.usuario?.id ||
            clienteSession.id;

        if (!id) {

            console.error(
                '[PROFILE UPDATE] ID da conta não encontrado na sessão:',
                clienteSession
            );

            return res.redirect(
                '/profile/edit?error=' +
                encodeURIComponent(
                    'Não foi possível identificar sua conta.'
                )
            );
        }

        // ----------------------------------------------------
        // Dados enviados pelo formulário
        // ----------------------------------------------------
        const {
            nome,
            telefone
        } = req.body;

        // ----------------------------------------------------
        // Validação
        // ----------------------------------------------------
        if (!nome || !nome.trim()) {

            return res.redirect(
                '/profile/edit?error=' +
                encodeURIComponent(
                    'Informe seu nome completo.'
                )
            );
        }

        // ----------------------------------------------------
        // Dados que a API AUTH aceita
        // PUT /api/auth/account
        // ----------------------------------------------------
        const dados = {
            id: Number(id),
            nome: nome.trim(),
            telefone: telefone
                ? telefone.trim()
                : ''
        };

        console.log(
            '[PROFILE UPDATE] Enviando para API:',
            dados
        );

        // ====================================================
        // ATUALIZAR CONTA NA API AUTH
        // ====================================================
        const resultado =
            await authService.atualizarPerfil(
                dados.id,
                dados.nome,
                dados.telefone
            );

        console.log(
            '[PROFILE UPDATE] Resposta da API:',
            resultado
        );

        // ----------------------------------------------------
        // Verificar resposta
        // ----------------------------------------------------
        if (!resultado || resultado.success === false) {

            throw new Error(
                resultado?.message ||
                'Não foi possível atualizar os dados da conta.'
            );
        }

        // ====================================================
        // Atualizar a sessão local
        // ====================================================

        clienteSession.auth_user_id = Number(id);
        clienteSession.nome = dados.nome;
        clienteSession.telefone = dados.telefone;

        // Caso os dados estejam dentro de user
        if (clienteSession.user) {

            clienteSession.user.id = Number(id);
            clienteSession.user.nome = dados.nome;
            clienteSession.user.telefone = dados.telefone;
        }

        // Caso os dados estejam dentro de usuario
        if (clienteSession.usuario) {

            clienteSession.usuario.id = Number(id);
            clienteSession.usuario.nome = dados.nome;
            clienteSession.usuario.telefone = dados.telefone;
        }

        req.session.cliente = clienteSession;

        // ----------------------------------------------------
        // Garantir persistência da sessão antes do redirect
        // ----------------------------------------------------
        req.session.save((sessionError) => {

            if (sessionError) {

                console.error(
                    '[PROFILE UPDATE] Erro ao salvar sessão:',
                    sessionError
                );

                return res.redirect(
                    '/profile/edit?error=' +
                    encodeURIComponent(
                        'Os dados foram atualizados, mas houve um erro ao atualizar a sessão.'
                    )
                );
            }

            console.log(
                '[PROFILE UPDATE] Sessão atualizada:',
                req.session.cliente
            );

            return res.redirect(
                '/profile?success=' +
                encodeURIComponent(
                    'Perfil atualizado com sucesso.'
                )
            );
        });

    } catch (error) {

        console.error(
            '[PROFILE UPDATE] Erro:',
            error
        );

        return res.redirect(
            '/profile/edit?error=' +
            encodeURIComponent(
                error.message ||
                'Erro ao atualizar perfil.'
            )
        );
    }
}
// ============================================================
// EXPORTS
// ============================================================
module.exports = {
    mostrarPerfil,
    mostrarAlterarPerfil,
    atualizarPerfil
};