const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const port = 3000;

// Configurar middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sessões
app.use(session({
    secret: 'segredo-supersecreto', // Pode trocar por algo mais forte
    resave: false,
    saveUninitialized: true
}));

// Configurar EJS como engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Conexão com banco MySQL
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Landia2025@',
    database: 'crud_db'
});

// Rota principal (listar alunos)
app.get('/', (req, res) => {
    db.query('SELECT * FROM alunos', (err, results) => {
        if (err) throw err;
        res.render('index', { alunos: results });
    });
});

// Adicionar aluno
app.post('/add', (req, res) => {
    const { nome, ra, data_nascimento } = req.body;
    db.query('INSERT INTO alunos (nome, ra, data_nascimento) VALUES (?, ?, ?)', [nome, ra, data_nascimento], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Editar aluno
app.get('/edit/:id', (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM alunos WHERE id = ?', [id], (err, result) => {
        if (err) throw err;
        res.render('edit', { aluno: result[0] });
    });
});

// Atualizar aluno
app.post('/update/:id', (req, res) => {
    const id = req.params.id;
    const { nome, ra, data_nascimento } = req.body;
    db.query('UPDATE alunos SET nome = ?, ra = ?, data_nascimento = ? WHERE id = ?', [nome, ra, data_nascimento, id], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Deletar aluno
app.post('/delete/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM alunos WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Formulário de busca
app.get('/buscar', (req, res) => {
    res.render('buscar');
});

// Processar busca
app.post('/buscar', async (req, res) => {
    const { nome, ra } = req.body;

    const [results] = await db.promise().query(
        'SELECT * FROM alunos WHERE nome = ? AND ra = ?', [nome, ra]
    );

    if (results.length > 0) {
        const aluno = results[0];
        const horaAtual = new Date();

        // Registra entrada
        await db.promise().query(
            'INSERT INTO entradas (aluno_id, data_hora) VALUES (?, ?)',
            [aluno.id, horaAtual]
        );

        // Armazena resultado da busca na sessão
        req.session.resultadoBusca = {
            aluno,
            horaAtual: horaAtual.toLocaleTimeString(),
            erro: null
        };
    } else {
        // Caso não encontre o aluno
        req.session.resultadoBusca = {
            aluno: null,
            horaAtual: null,
            erro: 'Verifique se digitou corretamente seu Nome e RA.'
        };
    }

    // Redireciona para página de resultado
    res.redirect('/resultado');
});

// Página de resultado da busca
app.get('/resultado', (req, res) => {
    const resultado = req.session.resultadoBusca;

    if (!resultado) {
        return res.redirect('/buscar');
    }

    // Limpa a sessão após exibir
    req.session.resultadoBusca = null;

    res.render('resultado', {
        aluno: resultado.aluno,
        horaAtual: resultado.horaAtual,
        erro: resultado.erro
    });
});

// Entradas do dia
app.get('/entradas', async (req, res) => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

    const query = `
        SELECT alunos.nome, alunos.ra, entradas.data_hora
        FROM entradas
        JOIN alunos ON entradas.aluno_id = alunos.id
        WHERE entradas.data_hora BETWEEN ? AND ?
        ORDER BY entradas.data_hora ASC
    `;

    const [entradas] = await db.promise().query(query, [inicio, fim]);

    res.render('entradas', { entradas });
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});