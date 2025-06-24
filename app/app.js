const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const path = require('path');

// Configurar o body-parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configurar o EJS como motor de visualização
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Configurar a conexão com o MySQL
const db = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'Landia2025@',
    database: 'crud_db'
});

// Conectar ao MySQL
//db.connect((err) => {
   // if (err) throw err;
    //console.log('Conectado ao MySQL Workbanch!');
//});

// Rota para exibir todos os alunos
app.get('/', (req, res) => {
    db.query('SELECT * FROM alunos', (err, results) => {
        if (err) throw err;
        res.render('index', { alunos: results });
    });
});

// Rota para adicionar um novo aluno
app.post('/add', (req, res) => {
    const { nome, ra, data_nascimento } = req.body;
    db.query('INSERT INTO alunos (nome, ra, data_nascimento) VALUES (?, ?, ?)', [nome, ra, data_nascimento], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Rota para editar um aluno
app.get('/edit/:id', (req, res) => {
    const id = req.params.id;
    db.query('SELECT * FROM alunos WHERE id = ?', [id], (err, result) => {
        if (err) throw err;
        res.render('edit', { aluno: result[0] });
    });
});

// Rota para atualizar um aluno
app.post('/update/:id', (req, res) => {
    const id = req.params.id;
    const { nome, ra, data_nascimento } = req.body;
    db.query('UPDATE alunos SET nome = ?, ra = ?, data_nascimento = ? WHERE id = ?', [nome, ra, data_nascimento, id], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});

// Rota para deletar um aluno
app.post('/delete/:id', (req, res) => {
    const id = req.params.id;
    db.query('DELETE FROM alunos WHERE id = ?', [id], (err) => {
        if (err) throw err;
        res.redirect('/');
    });
});








// Rota para exibir o formulário de busca
app.get('/buscar', async (req, res) => {
    res.render('buscar'); // Renderiza a view de busca
});
// Rota para buscar aluno

app.post('/buscar', async (req, res) => {
    const { nome, ra } = req.body;
    console.log(`Buscando aluno: Nome = ${nome}, RA = ${ra}`);

    // Validação do RA
    const raRegex = /^\d+$/; // Regex para permitir apenas números
    if (ra && !raRegex.test(ra)) {
        return res.render('resultado', { aluno: null, horaAtual: null, erro: 'O RA deve conter apenas números.' });
    }

    const query = `SELECT * FROM alunos WHERE nome = ? && ra = ?`;

    try {
        const [results] = await db.promise().query(query, [nome, ra]);
        console.log('Resultados encontrados:', results);

        if (results.length > 0) {
            const aluno = results[0];
            const horaAtual = new Date().toLocaleTimeString();
            res.render('resultado', { aluno, horaAtual, erro: null });
        } else {
            // Aqui, adicionamos uma mensagem de erro se nenhum aluno for encontrado
            res.render('resultado', { aluno: null, horaAtual: null, erro: 'Nenhum aluno encontrado com esse nome ou RA.' });
        }
    } catch (error) {
        console.error('Erro ao buscar aluno:', error);
        res.status(500).send('Erro ao buscar aluno.');
    }
});









// Iniciar o servidor
app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});