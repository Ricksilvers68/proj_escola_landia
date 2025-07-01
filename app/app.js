const express = require('express');
const app = express();
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

// Configurar sessões
app.use(session({
    secret: 'segredo-supersecreto', // Pode trocar por algo mais forte
    resave: false,
    saveUninitialized: true
}));
app.use(autenticar);

const port = 3000;

// Configurar middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de proteção
function autenticar(req, res, next) {
    // permite o acesso livre à página de busca e ao login
    const rotasLivres = ['/buscar', '/login', '/resultado'];
    if (rotasLivres.includes(req.path) || req.path.startsWith('/public')) {
        return next();
    }

    if (req.session.usuarioLogado) {
        return next();
    }

    return res.redirect('/login');
}

app.use(autenticar);

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
    db.query('SELECT * FROM alunos ORDER BY nome ASC', (err, results) => {
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

    const query = `SELECT alunos.nome, alunos.ra, entradas.data_hora
        FROM entradas
        JOIN alunos ON entradas.aluno_id = alunos.id
        WHERE entradas.data_hora BETWEEN ? AND ?
        ORDER BY entradas.data_hora ASC`;

    
    const [entradas] = await db.promise().query(query, [inicio, fim]);

    res.render('entradas', { entradas });
});

//entradas mês
app.get('/entradas-mes', (req, res) => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;

  const mesFormatado = mes < 10 ? `0${mes}`: `${mes}`;
  const inicioDoMes = `${ano}-${mesFormatado}-01 00:00:00`;

  const proximoMes = mes + 1;
  const proximoAno = proximoMes > 12 ? ano + 1 : ano;
  const proximoMesFormatado = proximoMes > 12 ? '01' : (proximoMes < 10 ? `0${proximoMes}` : `${proximoMes}`);
  const inicioDoProximoMes = `${proximoAno}-${proximoMesFormatado}-01 00:00:00`;

  const sql = `SELECT entradas.*, alunos.nome, alunos.ra
    FROM entradas
    INNER JOIN alunos ON entradas.aluno_id = alunos.id
    WHERE entradas.data_hora >= ? AND entradas.data_hora < ?
    ORDER BY entradas.data_hora DESC`;

  db.query(sql, [inicioDoMes, inicioDoProximoMes], (err, resultados) => {
    if (err) {
      console.error('Erro ao buscar entradas do mês:', err);
      return res.status(500).send('Erro no servidor');
    }
    res.render('entradas_mes', { entradas: resultados });
  });
});



// Rota GET login
app.get('/login', (req, res) => {
    res.render('login', { erro: null });
});

// Rota POST login
app.post('/login', async (req, res) => {
    const { usuario, senha } = req.body;
    const [rows] = await db.promise().query(
        'SELECT * FROM usuarios WHERE usuario = ? AND senha = ?', [usuario, senha]
    );

    if (rows.length > 0) {
        req.session.usuarioLogado = rows[0].usuario;
        return res.redirect('/');
    } else {
        return res.render('login', { erro: 'Usuário ou senha inválidos.' });
    }
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// Iniciar servidor
app.listen(port, () => {
    console.log(`Tudo ok! Servidor rodando em http://localhost:${port}`);
});