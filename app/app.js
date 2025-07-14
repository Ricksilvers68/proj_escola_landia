const express = require('express');
const app = express();
require('dotenv').config()//Para meu banco de dados não ficar visível a outras pessoas
console.log("Variáveis carregadas:");
console.log("DB_USER =", process.env.DB_USER);
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

// Lista de IPs permitidos
const ipsPermitidos = [
  '127.0.0.1', // localhost IPv4
  '::1',       // localhost IPv6
  '192.168.0.100', // IP local da sua máquina — substitua pelo correto!
  '192.168.0.106', // outro IP permitido (anap)
];

// Middleware para bloquear IPs não autorizados
app.use((req, res, next) => {
  const ipCliente = req.ip.replace('::ffff:', ''); // Limpa IPv4 no formato IPv6
  console.log('ip detectado', ipCliente)

  if (ipsPermitidos.includes(ipCliente)) {
    return next(); // Acesso autorizado
  }

  // Exibe página de acesso negado (pode personalizar)
  res.status(403).send('<h3 style="font-family: sans-serif;">Acesso negado: Este dispositivo não está autorizado.</h3>');
});

//
app.use(express.static(path.join(__dirname, 'public')));

// Configurar sessões
app.use(session({
    secret: 'segredo-supersecreto', // Pode trocar por algo mais forte
    resave: false,
    saveUninitialized: true
}));
app.use(autenticar);
// Configurar middlewares
app.use(bodyParser.urlencoded({ extended: true }));


const port = 3000;

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
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});


// Rota principal (listar alunos)
app.get('/', (req, res) => {
    db.query('SELECT * FROM alunos ORDER BY nome ASC', (err, results) => {
        if (err) throw err;
        res.render('index', { alunos: results });
    });
});

// Adicionar aluno (com verificação de duplicados)
app.post('/add', (req, res) => {
    const { nome, ra, data_nascimento } = req.body;

    // Verifica se já existe aluno com o mesmo nome e RA
    const queryVerifica = 'SELECT * FROM alunos WHERE nome = ? AND ra = ?';
    db.query(queryVerifica, [nome, ra], (err, resultados) => {
        if (err) throw err;

        if (resultados.length > 0) {
            // Já existe aluno com esse nome e RA — renderiza erro
            return res.render('index', {
                alunos: resultados, // ou envie a lista completa se quiser
                erro: 'Aluno com este nome e RA já está cadastrado!'
            });
        }

        // Se não existe, insere normalmente
        const queryInsere = 'INSERT INTO alunos (nome, ra, data_nascimento) VALUES (?, ?, ?)';
        db.query(queryInsere, [nome, ra, data_nascimento], (err) => {
            if (err) throw err;
            res.redirect('/');
        });
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

//Rota get para formulario de busca por data
app.get('/relatorio_data', (req, res) => {
  res.render('relatorio_data', {entradas: []});
});

//Para processar a busca por data
app.post('/relatorio_data', async (req, res) => {
  const { inicio, fim } = req.body;

  if (!inicio || !fim) {
    return res.render('relatorio_data', { entradas: [] });
  }

  const data_inicio_completa = `${inicio} 00:00:00`;
  const data_fim_completa = `${fim} 23:59:59`;

  const sql = `
    SELECT entradas.*, alunos.nome, alunos.ra
    FROM entradas
    JOIN alunos ON entradas.aluno_id = alunos.id
    WHERE entradas.data_hora BETWEEN ? AND ?
    ORDER BY entradas.data_hora ASC
  `;

  try {
    const [entradas] = await db.promise().query(sql, [data_inicio_completa, data_fim_completa]);
    res.render('relatorio_data', { entradas });
  } catch (error) {
    console.error('Erro ao buscar entradas por período:', error);
    res.render('relatorio_data', { entradas: [] });
  }
});

// Formulário de busca
app.get('/buscar', (req, res) => {
    res.render('buscar');
});

// Processar busca
app.post('/buscar', async (req, res) => {
    console.log(req.body)
    const { nome, ra, justificativa } = req.body;

    const [results] = await db.promise().query(
        'SELECT * FROM alunos WHERE nome = ? AND ra = ?', [nome, ra]
    );

    if (results.length > 0) {
        const aluno = results[0];
        const horaAtual = new Date();

        // Registra entrada
        await db.promise().query(
            'INSERT INTO entradas (aluno_id, data_hora, justificativa) VALUES (?, ?, ?)',
            [aluno.id, horaAtual, justificativa || null]
        );

        // Armazena resultado da busca na sessão
       const justificativaInformada = justificativa?.trim() ? 'Sim' : 'Não';

req.session.resultadoBusca = {
    aluno,
    horaAtual: horaAtual.toLocaleTimeString(),
    justificativa: justificativaInformada,
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
        erro: resultado.erro,
        justificativa: resultado.justificativa
    });
});

// Entradas do dia
app.get('/entradas', async (req, res) => {
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);

    const query = `SELECT alunos.nome, alunos.ra, entradas.data_hora, entradas.justificativa
    FROM entradas
    JOIN alunos ON entradas.aluno_id = alunos.id
    WHERE entradas.data_hora BETWEEN ? AND ?
    ORDER BY alunos.nome ASC, entradas.data_hora ASC`;

    
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
    ORDER BY alunos.nome ASC, entradas.data_hora ASC`;

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