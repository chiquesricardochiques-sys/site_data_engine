// ervices/authApi.service.js

const AUTH_API_URL = 'http://auth.ricardo-site.tech:8081';
const AUTH_API_PREFIX = '/api/auth';


// Faz requisições à API central de autenticação.
async function authRequest(endpoint, {
    method = 'POST',
    body,
    accessToken
} = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    };

    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
    }

    const options = {
        method,
        headers
    };

    if (body !== undefined) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(
        `${AUTH_API_URL}${AUTH_API_PREFIX}${endpoint}`,
        options
    );

    const responseText = await response.text();

    let data = null;

    if (responseText) {
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { message: responseText };
        }
    }

    if (!response.ok) {
        const error = new Error(
            data?.message ||
            data?.error ||
            `Erro na API Auth: HTTP ${response.status}`
        );

        error.status = response.status;
        error.data = data;

        throw error;
    }

    return data;
}

// Cadastro

// Cadastro
async function registrar(nome, email, telefone, senha) {
    const body = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        telefone: telefone?.trim() || '',
        senha
    };

    return authRequest('/register', {
        method: 'POST',
        body
    });
}


// Login
async function login(email, senha) {
    console.log('[AUTH] Iniciando login');
    console.log('[AUTH] URL:', `${AUTH_API_URL}${AUTH_API_PREFIX}/login`);
    console.log('[AUTH] Email:', email);

    try {
        const resultado = await authRequest('/login', {
            body: {
                email,
                senha
            }
        });

        console.log('[AUTH] Resposta:', resultado);

        return resultado;
    } catch (erro) {
        console.error('[AUTH] Erro:', {
            message: erro.message,
            status: erro.status,
            data: erro.data
        });

        throw erro;
    }
}

// Consultar usuário autenticado
async function meuPerfil(accessToken) {
    return authRequest('/me', {
        method: 'GET',
        accessToken
    });
}

// Renovar access token
async function renovarToken(refresh_token) {
    return authRequest('/refresh', {
        body: { refresh_token }
    });
}

// Logout na API central
async function logout(accessToken, refresh_token) {
    return authRequest('/logout', {
        accessToken,
        body: { refresh_token }
    });
}

// Solicitar recuperação de senha
// Solicitar recuperação e cadastrar a nova senha
async function recuperarSenha(email, senha, confirmarSenha) {
    return authRequest('/recovery', {
        method: 'POST',
        body: {
            email: email.trim().toLowerCase(),
            senha,
            confirmar_senha: confirmarSenha
        }
    });
}

// Validar o código enviado por e-mail
async function confirmarRecuperacao(email, codigo) {
    return authRequest('/recovery/verify', {
        method: 'POST',
        body: {
            email: email.trim().toLowerCase(),
            codigo: codigo.trim()
        }
    });
}


// Redefinir senha
async function redefinirSenha(token, new_password) {
    return authRequest('/reset-password', {
        body: { token, new_password }
    });
}
 
// Confirmar e-mail
async function confirmarEmail(email, codigo) {
    return authRequest('/verify', {
        method: 'POST',
        body: {
            email: email.trim().toLowerCase(),
            codigo: codigo.trim()
        }
    });
}

// Alterar dados do perfil
async function atualizarPerfil(id, nome, telefone) {
    return authRequest('/account', {
        method: 'PUT',
        body: {
            id,
            nome: nome.trim(),
            telefone: telefone?.trim() || ''
        }
    });
}

module.exports = {
    registrar,
    login,
    meuPerfil,
    renovarToken,
    logout,
    recuperarSenha,
    redefinirSenha,
    confirmarEmail,
    confirmarRecuperacao,
    atualizarPerfil
};