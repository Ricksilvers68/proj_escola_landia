const express = require('express');
const app = express();
require('dotenv').config();
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const {startVenom, sendMessage} = require('./whatsapp');

// 🟢 Configurações iniciais
const port = 3000;

// 🔐 Lista de IPs com acesso completo
const ipsComAcessoTotal = [
  '127.0.0.1',
  '::1',
  '192.168.2.100', // servidor meu/ou escola pc2 a direita
  '192.168.2.101', // secretaria pc1 a esquerda
];

// 🎓 IP do terminal dos alunos (com acesso restrito)
const ipTerminalAluno = 'xxx.xxx.x.xxx'; //por enquanto está o pc a esquerda

// 🔄 Arquivos estáticos (CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

// 🔐 Middleware para controle de acesso por IP
app.use((req, res, next) => {
  const ipBruto = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const ipCliente = ipBruto.replace('::ffff:', '');

  console.log(`📡 IP detectado: ${ipCliente} | Rota: ${req.path}`);

  // Terminal do aluno → só pode acessar /buscar e /resultado
  if (ipCliente === ipTerminalAluno) {
    const rotasPermitidas = ['/buscar', '/resultado'];
    const rotaLiberada = rotasPermitidas.includes(req.path) || req.path.startsWith('/public');
    if (rotaLiberada) return next();

    return res.status(403).send('<h3 style="font-family: sans-serif;">Acesso restrito: Essa página não está liberada neste terminal.</h3>');
  }

  // IP com acesso total
  if (ipsComAcessoTotal.includes(ipCliente)) {
    return next();
  }

  // Dispositivo não autorizado
  return res.status(403).send('<h3 style="font-family: sans-serif;">Acesso negado: Este dispositivo não está autorizado.</h3>');
});

// 🔐 Sessões
app.use(session({
  secret: 'segredo-supersecreto',
  resave: false,
  saveUninitialized: true,
}));

// 🔐 Middleware de autenticação
function autenticar(req, res, next) {
  const rotasLivres = ['/buscar', '/login', '/resultado'];
  if (rotasLivres.includes(req.path) || req.path.startsWith('/public')) return next();
  if (req.session.usuarioLogado) return next();

  return res.redirect('/login');
}
app.use(autenticar);

// 🧠 Body parser
app.use(bodyParser.urlencoded({ extended: true }));

// 🔧 EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// 🔌 Conexão MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// --- ROTAS ---

app.get('/', (req, res) => {
  db.query('SELECT * FROM alunos ORDER BY nome ASC', (err, results) => {
    if (err) throw err;
    res.render('index', { alunos: results });
  });
});

app.post('/add', (req, res) => {
  const { nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2 } = req.body;

  const queryVerifica = 'SELECT * FROM alunos WHERE nome = ? AND ra = ?';
  db.query(queryVerifica, [nome, ra], (err, resultados) => {
    if (err) throw err;
    if (resultados.length > 0) {
      return res.render('index', {
        alunos: resultados,
        erro: 'Aluno com este nome e RA já está cadastrado!'
      });
    }

    const queryInsere = `
      INSERT INTO alunos (nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2)
      VALUES (?, ?, ?, ?, ?)
    `;
    db.query(queryInsere, [nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2], (err) => {
      if (err) throw err;
      res.redirect('/');
    });
  });
});

app.get('/edit/:id', (req, res) => {
  const id = req.params.id;
  db.query('SELECT * FROM alunos WHERE id = ?', [id], (err, result) => {
    if (err) throw err;
    res.render('edit', { aluno: result[0] });
  });
});

app.post('/update/:id', (req, res) => {
  const id = req.params.id;
  const { nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2 } = req.body;

  const queryAtualiza = `
    UPDATE alunos
    SET nome = ?, ra = ?, data_nascimento = ?, tel_responsavel_1 = ?, tel_responsavel_2 = ?
    WHERE id = ?
  `;
  db.query(queryAtualiza, [nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2, id], (err) => {
    if (err) throw err;
    res.redirect('/');
  });
});

app.post('/delete/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM alunos WHERE id = ?', [id], (err) => {
    if (err) throw err;
    res.redirect('/');
  });
});

// 📆 Relatório por data
app.get('/relatorio_data', (req, res) => {
  res.render('relatorio_data', { entradas: [] });
});

app.post('/relatorio_data', async (req, res) => {
  const { inicio, fim } = req.body;
  if (!inicio || !fim) return res.render('relatorio_data', { entradas: [] });

  const data_inicio_completa = `${inicio} 00:00:00`;
  const data_fim_completa = `${fim} 23:59:59`;

  const sql = `
    SELECT entradas.*, alunos.nome, alunos.ra, alunos.tel_responsavel_1, alunos.tel_responsavel_2
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

// 🧍 Rota buscar
app.get('/buscar', (req, res) => {
  res.render('buscar');
});

app.post('/buscar', async (req, res) => {
  const { nome, ra, justificativa } = req.body;
  const nomeLimpo = nome.trim().replace(/\s+/g, ' ');
  const raLimpo = parseInt(ra.trim());

  console.log('📥 Dados recebidos:', JSON.stringify({ nome: nomeLimpo, ra: raLimpo, justificativa }));

  const [results] = await db.promise().query(
    'SELECT * FROM alunos WHERE nome = ? AND ra = ?', [nomeLimpo, raLimpo]
  );

  if (results.length > 0) {
    const aluno = results[0];
    const horaAtual = new Date();
    await db.promise().query(
      'INSERT INTO entradas (aluno_id, data_hora, justificativa) VALUES (?, ?, ?)',
      [aluno.id, horaAtual, justificativa || null]
    );

    // Só envia se o horário for após o permitido
const horaLimite = new Date();
horaLimite.setHours(7, 3, 0); // exemplo: limite 07:03

if (horaAtual > horaLimite) {
  console.log('⏰ Hora atual:', horaAtual.toLocaleTimeString());
  console.log('⏰ Hora limite:', horaLimite.toLocaleTimeString());

  const mensagem = `Olá, ${aluno.nome} (RA: ${aluno.ra}) registrou entrada após o horário.\nJustificativa: ${justificativa || 'Nenhuma'}`;
  const telefone = aluno.tel_responsavel_1 || aluno.tel_responsavel_2;

  if (telefone) {
    const numeroLimpo = telefone.replace(/\D/g, '');
    console.log(`📨 Enviando para: ${numeroLimpo}`);
    console.log(`📨 Mensagem: ${mensagem}`);
    sendMessage(`${numeroLimpo}`, mensagem);
  } else {
    console.log('⚠️ Nenhum telefone cadastrado para este aluno.');
  }
} else {
  console.log('🟢 Entrada no horário permitido. Nenhuma mensagem enviada.');
}

    req.session.resultadoBusca = {
      aluno,
      horaAtual: horaAtual.toLocaleTimeString(),
      justificativa: justificativa?.trim() ? 'Sim' : 'Não',
      erro: null
    };
  } else {
    req.session.resultadoBusca = {
      aluno: null,
      horaAtual: null,
      justificativa: null,
      erro: 'Verifique se digitou corretamente seu Nome e RA.'
    };
  }

  res.redirect('/resultado');
});

app.get('/resultado', (req, res) => {
  const resultado = req.session.resultadoBusca;
  if (!resultado) return res.redirect('/buscar');
  req.session.resultadoBusca = null;
  res.render('resultado', resultado);
});

// 📆 Entradas do dia
app.get('/entradas', async (req, res) => {
  const hoje = new Date();
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59);
  const query = `
    SELECT alunos.nome, alunos.ra, entradas.data_hora, entradas.justificativa, alunos.tel_responsavel_1, alunos.tel_responsavel_2
    FROM entradas
    JOIN alunos ON entradas.aluno_id = alunos.id
    WHERE entradas.data_hora BETWEEN ? AND ?
    ORDER BY alunos.nome ASC, entradas.data_hora ASC
  `;
  const [entradas] = await db.promise().query(query, [inicio, fim]);
  res.render('entradas', { entradas });
});

// 📆 Entradas do mês
app.get('/entradas-mes', (req, res) => {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth() + 1;
  const mesFormatado = mes < 10 ? `0${mes}` : `${mes}`;
  const inicioDoMes = `${ano}-${mesFormatado}-01 00:00:00`;

  const proximoMes = mes + 1;
  const proximoAno = proximoMes > 12 ? ano + 1 : ano;
  const proximoMesFormatado = proximoMes > 12 ? '01' : (proximoMes < 10 ? `0${proximoMes}` : `${proximoMes}`);
  const inicioDoProximoMes = `${proximoAno}-${proximoMesFormatado}-01 00:00:00`;

  const sql = `
    SELECT entradas.*, alunos.nome, alunos.ra, alunos.tel_responsavel_1, alunos.tel_responsavel_2
    FROM entradas
    INNER JOIN alunos ON entradas.aluno_id = alunos.id
    WHERE entradas.data_hora >= ? AND entradas.data_hora < ?
    ORDER BY alunos.nome ASC, entradas.data_hora ASC
  `;

  db.query(sql, [inicioDoMes, inicioDoProximoMes], (err, resultados) => {
    if (err) {
      console.error('Erro ao buscar entradas do mês:', err);
      return res.status(500).send('Erro no servidor');
    }
    res.render('entradas_mes', { entradas: resultados });
  });
});

// 🔐 Login
app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

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

// 🔓 Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// 🚀 Inicia servidor
app.listen(port, () => {
  console.log(`Tudo ok! Servidor rodando em http://localhost:${port}`);

  //inicia o venom depois de subir o servidor
startVenom();
});

