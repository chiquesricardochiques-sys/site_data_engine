// src/controllers/publicController.js

const salaoApi = require('../services/salaoApi.service');
const authService = require('../services/authApi.service');


// ============================================================
// LOGOUT
// ============================================================

function logoutCliente(req, res) {
    req.session.destroy(() => {
        res.redirect('/');
    });
}


// ============================================================
// CADASTRO
// ============================================================

async function mostrarCadastro(req, res) {
    return res.render('public/register', {
        styleClient: 'publicRegister.css',
        page: 'login',
        layout: 'client',
        register: true,
        navbarPublic: true
    });
}


async function registrarCliente(req, res) {
    const { nome, email, telefone, senha } = req.body;

    const dadosCadastro = {
        nome: nome || '',
        email: email || '',
        telefone: telefone || ''
    };

    try {
        if (
            !nome?.trim() ||
            !email?.trim() ||
            !senha ||
            nome.trim().length < 3 ||
            senha.length < 8
        ) {
            return res.status(400).render('public/register', {
                page: 'login',
                error: 'Informe um nome com pelo menos 3 caracteres, um e-mail e uma senha com pelo menos 8 caracteres.',
                ...dadosCadastro,
                register: true,
                navbarPublic: true
            });
        }

        const emailNormalizado = email.trim().toLowerCase();

        const result = await authService.registrar(
            nome.trim(),
            emailNormalizado,
            telefone,
            senha
        );

        if (!result || result.success === false) {
            return res.status(400).render('public/register', {
                page: 'login',
                error: result?.message || 'Não foi possível realizar o cadastro.',
                ...dadosCadastro,
                register: true,
                navbarPublic: true
            });
        }

        req.session.cadastroPendente = {
            nome: nome.trim(),
            email: emailNormalizado,
            telefone: telefone?.trim() || ''
        };

        return res.redirect('/verify-email');

    } catch (error) {
        console.error('Erro ao registrar cliente:', {
            status: error.status,
            message: error.message,
            data: error.data
        });

        return res.status(
            error.status === 409 ? 409 : 400
        ).render('public/register', {
            page: 'login',
            error: error.message ||
                'Erro ao realizar cadastro. Tente novamente.',
            ...dadosCadastro,
            register: true,
            navbarPublic: true
        });
    }
}


// ============================================================
// VERIFICAÇÃO DE E-MAIL
// ============================================================

// GET /verify-email
async function mostrarVerificacaoEmail(req, res) {
    try {
        const cadastro = req.session.cadastroPendente;

        if (!cadastro?.email) {
            return res.redirect('/register');
        }

        return res.render('public/verify-email', {
            layout: 'main',
            page: 'login',
            email: cadastro.email,
            navbarPublic: true
        });

    } catch (error) {
        console.error(
            'Erro ao mostrar confirmação de e-mail:',
            error
        );

        return res.status(500).send(
            'Erro ao carregar a tela de confirmação.'
        );
    }
}


// POST /verify-email
async function validarEmail(req, res) {
    try {
        const cadastro = req.session.cadastroPendente;

        if (!cadastro?.email) {
            return res.redirect('/register');
        }

        const codigo = String(
            req.body.codigo || ''
        ).trim();

        if (!codigo) {
            return res.status(400).render(
                'public/verify-email',
                {
                    layout: 'main',
                    page: 'login',
                    email: cadastro.email,
                    error: 'Informe o código recebido por e-mail.',
                    navbarPublic: true
                }
            );
        }

        const result = await authService.confirmarEmail(
            cadastro.email,
            codigo
        );

        if (!result || result.success === false) {
            return res.status(400).render(
                'public/verify-email',
                {
                    layout: 'main',
                    page: 'login',
                    email: cadastro.email,
                    error:
                        result?.message ||
                        'Não foi possível confirmar o código.',
                    navbarPublic: true
                }
            );
        }

        delete req.session.cadastroPendente;

        return res.redirect(
            '/login?cadastro=confirmado'
        );

    } catch (error) {
        console.error(
            'Erro ao validar código de e-mail:',
            {
                status: error.status,
                message: error.message,
                data: error.data
            }
        );

        const cadastro =
            req.session.cadastroPendente;

        if (!cadastro?.email) {
            return res.redirect('/register');
        }

        return res.status(
            error.status === 401
                ? 400
                : (error.status || 500)
        ).render('public/verify-email', {
            layout: 'main',
            page: 'login',
            email: cadastro.email,
            error:
                error.message ||
                'Erro ao validar o código. Tente novamente.',
            navbarPublic: true
        });
    }
}


// ============================================================
// LOGIN
// ============================================================

async function mostrarLogin(req, res) {
    return res.render('public/login', {
        page: 'login',
        register: true,
        navbarPublic: true
    });
}


async function loginCliente(req, res) {
    const email = String(
        req.body.email || ''
    ).trim().toLowerCase();

    const senha = String(
        req.body.senha || ''
    );

    try {
        if (!email || !senha) {
            return res.status(400).render(
                'public/login',
                {
                    layout: 'client',
                    page: 'login',
                    error: 'Informe seu e-mail e sua senha.',
                    navbarPublic: true
                }
            );
        }

        // ----------------------------------------------------
        // 1. Autentica na API central de autenticação
        // ----------------------------------------------------

        const result = await authService.login(
            email,
            senha
        );

        if (
            !result ||
            result.success !== true ||
            !result.user
        ) {
            return res.status(401).render(
                'public/login',
                {
                    layout: 'client',
                    page: 'login',
                    error:
                        'Não foi possível entrar. Verifique seus dados.',
                    navbarPublic: true
                }
            );
        }

        const usuario = result.user;

        // ----------------------------------------------------
        // 2. Verifica o estado da conta
        // ----------------------------------------------------

        if (
            usuario.status !== 'ativo' ||
            usuario.email_verificado !== true
        ) {
            return res.status(403).render(
                'public/login',
                {
                    layout: 'client',
                    page: 'login',
                    error:
                        'Sua conta precisa estar ativa e com o e-mail confirmado.',
                    navbarPublic: true
                }
            );
        }

        // ----------------------------------------------------
        // 3. Cria uma nova sessão
        // ----------------------------------------------------

        await new Promise((resolve, reject) => {
            req.session.regenerate((erro) => {
                if (erro) {
                    return reject(erro);
                }

                resolve();
            });
        });

        // ----------------------------------------------------
        // 4. Guarda os dados do usuário na sessão
        //
        // A API Auth atualmente retorna:
        //
        // user.id
        // user.nome
        // user.email
        // user.telefone
        // user.status
        // user.email_verificado
        //
        // Não inventamos access_token nem id_cliente,
        // porque eles não vieram na resposta apresentada.
        // ----------------------------------------------------

        req.session.cliente = {
            auth_user_id: usuario.id,
            nome: usuario.nome,
            email: usuario.email,
            telefone: usuario.telefone || '',
            status: usuario.status,
            email_verificado: usuario.email_verificado
        };

        // ----------------------------------------------------
        // 5. Salva a sessão
        // ----------------------------------------------------

        await new Promise((resolve, reject) => {
            req.session.save((erroSalvar) => {
                if (erroSalvar) {
                    return reject(erroSalvar);
                }

                resolve();
            });
        });

        // ----------------------------------------------------
        // 6. Login concluído
        // ----------------------------------------------------

        return res.redirect('/');

    } catch (error) {
        console.error(
            'Erro ao autenticar cliente:',
            {
                status: error.status,
                message: error.message,
                data: error.data
            }
        );

        const status =
            error.status === 401
                ? 401
                : 500;

        return res.status(status).render(
            'public/login',
            {
                layout: 'client',
                page: 'login',
                error:
                    error.status === 401
                        ? 'E-mail ou senha inválidos.'
                        : 'Erro ao realizar login. Tente novamente.',
                navbarPublic: true
            }
        );
    }
}


// ============================================================
// RECUPERAÇÃO DE SENHA
// ============================================================

// GET /forgot-password
async function mostrarEsqueciSenha(req, res) {
    return res.render(
        'public/forgot-password',
        {
            layout: 'main',
            page: 'login',
            navbarPublic: true
        }
    );
}


// POST /forgot-password
async function solicitarRecuperacao(req, res) {
    const email = String(
        req.body.email || ''
    ).trim().toLowerCase();

    const senha = String(
        req.body.senha || ''
    );

    const confirmarSenha = String(
        req.body.confirmar_senha || ''
    );

    const dados = {
        email
    };

    if (
        !email ||
        !senha ||
        !confirmarSenha
    ) {
        return res.status(400).render(
            'public/forgot-password',
            {
                layout: 'main',
                page: 'login',
                error: 'Preencha todos os campos.',
                ...dados,
                navbarPublic: true
            }
        );
    }

    if (senha.length < 8) {
        return res.status(400).render(
            'public/forgot-password',
            {
                layout: 'main',
                page: 'login',
                error:
                    'A nova senha deve ter pelo menos 8 caracteres.',
                ...dados,
                navbarPublic: true
            }
        );
    }

    if (senha !== confirmarSenha) {
        return res.status(400).render(
            'public/forgot-password',
            {
                layout: 'main',
                page: 'login',
                error: 'As senhas não coincidem.',
                ...dados,
                navbarPublic: true
            }
        );
    }

    try {
        const result =
            await authService.recuperarSenha(
                email,
                senha,
                confirmarSenha
            );

        if (
            !result ||
            result.success === false
        ) {
            return res.status(400).render(
                'public/forgot-password',
                {
                    layout: 'main',
                    page: 'login',
                    error:
                        result?.message ||
                        'Não foi possível solicitar a recuperação.',
                    ...dados,
                    navbarPublic: true
                }
            );
        }

        req.session.recuperacaoPendente = {
            email
        };

        return res.redirect(
            '/verify-recovery'
        );

    } catch (error) {
        console.error(
            'Erro ao solicitar recuperação:',
            {
                status: error.status,
                message: error.message,
                data: error.data
            }
        );

        return res.status(
            error.status || 500
        ).render(
            'public/forgot-password',
            {
                layout: 'main',
                page: 'login',
                error:
                    error.message ||
                    'Erro ao solicitar recuperação.',
                ...dados,
                navbarPublic: true
            }
        );
    }
}


// GET /verify-recovery
async function mostrarValidacaoRecuperacao(
    req,
    res
) {
    const recuperacao =
        req.session.recuperacaoPendente;

    if (!recuperacao?.email) {
        return res.redirect(
            '/forgot-password'
        );
    }

    return res.render(
        'public/verify-recovery',
        {
            layout: 'main',
            page: 'login',
            email: recuperacao.email,
            navbarPublic: true
        }
    );
}


// POST /verify-recovery
async function validarRecuperacao(
    req,
    res
) {
    const recuperacao =
        req.session.recuperacaoPendente;

    if (!recuperacao?.email) {
        return res.redirect(
            '/forgot-password'
        );
    }

    const codigo = String(
        req.body.codigo || ''
    ).trim();

    if (!codigo) {
        return res.status(400).render(
            'public/verify-recovery',
            {
                layout: 'main',
                page: 'login',
                email: recuperacao.email,
                error:
                    'Digite o código recebido por e-mail.',
                navbarPublic: true
            }
        );
    }

    try {
        const result =
            await authService.confirmarRecuperacao(
                recuperacao.email,
                codigo
            );

        if (
            !result ||
            result.success === false
        ) {
            return res.status(400).render(
                'public/verify-recovery',
                {
                    layout: 'main',
                    page: 'login',
                    email: recuperacao.email,
                    error:
                        result?.message ||
                        'Código inválido ou expirado.',
                    navbarPublic: true
                }
            );
        }

        delete req.session.recuperacaoPendente;

        return res.redirect(
            '/login?senha=alterada'
        );

    } catch (error) {
        console.error(
            'Erro ao validar recuperação:',
            {
                status: error.status,
                message: error.message,
                data: error.data
            }
        );

        return res.status(
            error.status || 500
        ).render(
            'public/verify-recovery',
            {
                layout: 'main',
                page: 'login',
                email: recuperacao.email,
                error:
                    error.message ||
                    'Não foi possível validar o código.',
                navbarPublic: true
            }
        );
    }
}


// ============================================================
// HOME PÚBLICA
// ============================================================

async function home(req, res) {
    try {
        const resposta =
            await salaoApi.home();

        const {
            textos
        } = resposta.data;

        return res.render(
            'public/home',
            {
                page: 'home',
                textos
            }
        );

    } catch (error) {
        console.error(
            'Erro ao carregar home:',
            error
        );

        return res.status(500).send(
            'Erro ao carregar a página inicial'
        );
    }
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
    home,

    mostrarCadastro,
    registrarCliente,

    mostrarLogin,
    loginCliente,
    logoutCliente,

    mostrarVerificacaoEmail,
    validarEmail,

    mostrarEsqueciSenha,
    solicitarRecuperacao,

    mostrarValidacaoRecuperacao,
    validarRecuperacao
};