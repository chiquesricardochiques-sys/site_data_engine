console.log("executando");

const express = require('express');
const exphbs = require('express-handlebars');
const bodyParser = require('body-parser');
require('dotenv').config();
const session = require('express-session');
const path = require('path');

const helpers = require('./utils/helpers');

const clientRoutes = require('./routes/client.routes');

// Rotas públicas ficam fora de circulação por enquanto
// const publicRoutes = require('./routes/public.routes');

const app = express();


// ========================================
// SESSÃO
// ========================================

app.use(session({
    secret: process.env.SESSION_SECRET || "chave123",
    resave: false,
    saveUninitialized: false
}));


// ========================================
// HANDLEBARS
// ========================================

const hbs = exphbs.create({
    defaultLayout: false,
    extname: '.handlebars',

    layoutsDir: path.join(__dirname, 'views/layouts'),

    partialsDir: path.join(__dirname, 'views/partials'),

    helpers: helpers
});

app.engine('handlebars', hbs.engine);

app.set('view engine', 'handlebars');

app.set('views', __dirname + '/views');


// ========================================
// BODY
// ========================================

app.use(express.urlencoded({
    extended: false
}));

app.use(express.json());


// ========================================
// ARQUIVOS ESTÁTICOS
// ========================================

app.use(
    express.static(
        path.join(__dirname, '..', 'public')
    )
);


// ========================================
// LAYOUT CLIENTE
// ========================================

const clientLayout = (req, res, next) => {

    res.locals.layout = 'client';

    next();

};


// ========================================
// ROTAS
// ========================================

// HOME PRINCIPAL DO SISTEMA
// Agora "/" é a Home do cliente

app.use(
    '/',
    clientLayout,
    clientRoutes
);


app.use(
    '/client',
    clientLayout,
    clientRoutes
);

// ========================================
// SERVIDOR
// ========================================

async function startServer() {

    const PORT = process.env.PORT || 4000;

    try {

        console.log("Banco inicializado");

    } catch (err) {

        console.error("Erro no banco:", err);

    }

    app.listen(PORT, () => {

        console.log(
            `Servidor rodando na porta HTTP://localhost:${PORT}`
        );

    });

}

startServer();