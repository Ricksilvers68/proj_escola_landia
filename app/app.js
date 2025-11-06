const express = require('express');
const app = express();
require('dotenv').config();
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

// 🟢 Configurações iniciais
const port = 3000;

// 🔐 Lista de IPs com acesso completo
const ipsComAcessoTotal = process.env.FULL_ACCESS_IPS.split(',').map(ip => ip.trim());

// 🎓 IP do terminal dos alunos (com acesso restrito)
const ipTerminalAluno = process.env.RESTRICTED_IPS.split(','); // por enquanto está o pc a esquerda

// 🔄 Arquivos estáticos (CSS, JS, imagens)
app.use(express.static(path.join(__dirname, 'public')));

// 🔐 Middleware para controle de acesso por IP
app.use((req, res, next) => {
  const ipBruto = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  const ipCliente = ipBruto.replace('::ffff:', '');

  console.log(`📡 IP detectado: ${ipCliente} | Rota: ${req.path}`);

  // Terminal do aluno → só pode acessar /buscar e /resultado
  if (ipTerminalAluno.includes(ipCliente)) {
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
  secret: process.env.SESSION_SECRET,
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

app.get('/', async (req, res) => {
  try {
    const [alunos] = await db.promise().query('SELECT * FROM alunos ORDER BY nome ASC');
    res.render('index', { alunos, erro: null });
  } catch (error) {
    console.error('Erro ao buscar alunos:', error);
    res.status(500).render('index', { alunos: [], erro: 'Falha ao carregar a lista de alunos.' });
  }
});

app.post('/add', async (req, res) => {
  try {
    const { nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2 } = req.body;

    const [existentes] = await db.promise().query('SELECT id FROM alunos WHERE nome = ? AND ra = ?', [nome, ra]);

    if (existentes.length > 0) {
      const [alunos] = await db.promise().query('SELECT * FROM alunos ORDER BY nome ASC');
      return res.render('index', {
        alunos: alunos,
        erro: 'Aluno com este nome e RA já está cadastrado!'
      });
    }

    const queryInsere = 'INSERT INTO alunos (nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2) VALUES (?, ?, ?, ?, ?)';
    await db.promise().query(queryInsere, [nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2]);
    res.redirect('/');
  } catch (error) {
    console.error('Erro ao adicionar aluno:', error);
    res.status(500).send('Erro ao processar a sua solicitação.');
  }
});

app.get('/edit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [results] = await db.promise().query('SELECT * FROM alunos WHERE id = ?', [id]);

    if (results.length === 0) {
      return res.status(404).send('Aluno não encontrado.');
    }
    res.render('edit', { aluno: results[0] });
  } catch (error) {
    console.error('Erro ao buscar aluno para edição:', error);
    res.status(500).send('Erro ao carregar página de edição.');
  }
});

app.post('/update/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2 } = req.body;
    const query = 'UPDATE alunos SET nome = ?, ra = ?, data_nascimento = ?, tel_responsavel_1 = ?, tel_responsavel_2 = ? WHERE id = ?';
    await db.promise().query(query, [nome, ra, data_nascimento, tel_responsavel_1, tel_responsavel_2, id]);
    res.redirect('/');
  } catch (error) {
    console.error('Erro ao atualizar aluno:', error);
    res.status(500).send('Erro ao atualizar os dados do aluno.');
  }
});

app.post('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Adicionar verificação de entradas associadas antes de deletar seria uma boa prática
    await db.promise().query('DELETE FROM alunos WHERE id = ?', [id]);
    res.redirect('/');
  } catch (error) {
    console.error('Erro ao deletar aluno:', error);
    // Se houver uma chave estrangeira, o erro será capturado aqui
    res.status(500).send('Erro ao deletar o aluno. Verifique se ele não possui registros de entrada associados.');
  }
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
  try {
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

      console.log('✅ Entrada registrada no banco.');

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
  } catch (error) {
    console.error('Erro ao buscar aluno e registrar entrada:', error);
    req.session.resultadoBusca = {
      erro: 'Ocorreu um erro interno. Por favor, tente novamente.'
    };
  } finally {
    res.redirect('/resultado');
  }
});

app.get('/resultado', (req, res) => {
  const resultado = req.session.resultadoBusca;
  if (!resultado) return res.redirect('/buscar');
  req.session.resultadoBusca = null;
  res.render('resultado', resultado);
});

// =====================================
// RELATÓRIO DE ATRASOS POR ALUNO (final, com formato bonito)
// =====================================
// Página inicial do relatório
app.get('/relatorio_atrasos', async (req, res) => {
  try {
    const { mes, ano } = req.query;
    const mesSelecionado = mes || (new Date().getMonth() + 1);
    const anoSelecionado = ano || new Date().getFullYear();

    const sql = `
      SELECT nome, total_minutos_atraso
      FROM (
        SELECT 
          a.nome,
          SUM(
            CASE 
              WHEN TIME(e.data_hora) BETWEEN '07:00:01' AND '08:00:00' THEN 
                TIMESTAMPDIFF(MINUTE,
                  CAST(CONCAT(DATE(e.data_hora), ' 07:00:00') AS DATETIME),
                  e.data_hora
                )
              WHEN TIME(e.data_hora) BETWEEN '14:20:01' AND '15:20:00' THEN 
                TIMESTAMPDIFF(MINUTE,
                  CAST(CONCAT(DATE(e.data_hora), ' 14:20:00') AS DATETIME),
                  e.data_hora
                )
              ELSE 0
            END
          ) AS total_minutos_atraso
        FROM entradas e
        JOIN alunos a ON e.aluno_id = a.id
        WHERE MONTH(e.data_hora) = ? 
          AND YEAR(e.data_hora) = ?
        GROUP BY a.nome
        HAVING total_minutos_atraso > 0
      ) AS sub
      ORDER BY total_minutos_atraso DESC;
    `;

    console.log('SQL executado:', sql);
    console.log('Parâmetros:', [mesSelecionado, anoSelecionado]);

    const [resultados] = await db.promise().query(sql, [mesSelecionado, anoSelecionado]);

    console.log('Resultados SQL:', resultados);

    res.render('relatorio_atrasos', { resultados, mes: mesSelecionado, ano: anoSelecionado, mensagem: null });
  } catch (error) {
    console.error('Erro ao gerar relatório de atrasos:', error.message);
    console.error('Stack completa:', error.stack);
    res.status(500).send('Erro ao gerar relatório de atrasos');
  }
});










// 📘 Manual do sistema
app.get('/manual', (req, res) => {
  res.render('manual');
});

// 📆 Entradas do dia
app.get('/entradas', async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Erro ao buscar as entradas do dia:', error);
    res.status(500).send('Falha ao carregar as entradas do dia.');
  }
});

// 📆 Entradas do mês
app.get('/entradas-mes', async (req, res) => {
  try {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth(); // Mês atual (0-11)

    // Cria datas para o início do mês atual e do próximo mês
    const inicioDoMes = new Date(ano, mes, 1);
    const inicioDoProximoMes = new Date(ano, mes + 1, 1);

    const sql = `
      SELECT 
        entradas.id,
        entradas.aluno_id,
        DATE_FORMAT(entradas.data_hora, '%Y-%m-%d %H:%i:%s') AS data_hora_local,
        alunos.nome,
        alunos.ra,
        alunos.tel_responsavel_1,
        alunos.tel_responsavel_2,
        entradas.justificativa
      FROM entradas
      INNER JOIN alunos ON entradas.aluno_id = alunos.id
      WHERE entradas.data_hora >= ? AND entradas.data_hora < ?
      ORDER BY alunos.nome ASC, entradas.data_hora ASC
    `;

    const [resultados] = await db.promise().query(sql, [inicioDoMes, inicioDoProximoMes]);
    res.render('entradas_mes', { entradas: resultados });
  } catch (error) {
    console.error('Erro ao buscar entradas do mês:', error);
    res.status(500).send('Ocorreu um erro ao gerar o relatório de entradas do mês.');
  }
});

// 🔐 Login
app.get('/login', (req, res) => {
  res.render('login', { erro: null });
});

app.post('/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;
    // 🚨 ALERTA DE SEGURANÇA CRÍTICO: As senhas estão sendo comparadas em texto plano.
    // Isso é uma vulnerabilidade grave. O correto é usar uma biblioteca como `bcrypt`
    // para gerar um "hash" da senha no momento do cadastro e comparar o hash no login.
    // Exemplo de comparação: const match = await bcrypt.compare(senha, usuarioDoBanco.senha_hash);
    const [rows] = await db.promise().query(
      'SELECT * FROM usuarios WHERE usuario = ? AND senha = ?', [usuario, senha]
    );
    if (rows.length > 0) {
      req.session.usuarioLogado = rows[0].usuario;
      return res.redirect('/');
    } else {
      return res.render('login', { erro: 'Usuário ou senha inválidos.' });
    }
  } catch (error) {
    console.error('Erro durante o login:', error);
    res.status(500).render('login', { erro: 'Ocorreu um erro no servidor. Tente novamente.' });
  }
});

// 🔓 Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

// 📊 API para dados do gráfico de entradas
app.get('/api/entradas-chart', async (req, res) => {
  try {
    // Consulta para contar as entradas por dia nos últimos 30 dias
    const sql = `
      SELECT DATE(data_hora) as dia, COUNT(*) as total
      FROM entradas
      WHERE data_hora >= CURDATE() - INTERVAL 30 DAY
      GROUP BY DATE(data_hora)
      ORDER BY dia ASC;
    `;
    const [results] = await db.promise().query(sql);

    // Filtra resultados onde a data possa ser nula ou inválida, evitando o erro NaN/NaN
    const validResults = results.filter(row => row && row.dia);

    // Formata os dados para serem usados pelo Chart.js
    const labels = validResults.map(row => {
      // O MySQL retorna a data no formato YYYY-MM-DD.
      // Vamos converter para um objeto Date para formatar corretamente em DD/MM.
      // Adicionar 'T00:00:00' para evitar problemas de fuso horário.
      const data = new Date(row.dia + 'T00:00:00');
      return `${data.getDate().toString().padStart(2, '0')}/${(data.getMonth() + 1).toString().padStart(2, '0')}`;
    });
    const data = validResults.map(row => row.total);

    res.json({ labels, data });
  } catch (error) {
    console.error('Erro ao buscar dados para o gráfico:', error);
    res.status(500).json({ error: 'Erro ao buscar dados para o gráfico' });
  }
});

// ��� Inicia servidor
app.listen(port, '0.0.0.0', () => {
  console.log(`Tudo ok! Servidor rodando ${port}`);
});