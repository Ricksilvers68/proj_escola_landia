const venom = require('venom-bot');
const path = require('path');

let clientInstance = null;

// Inicializa o Venom apenas uma vez
function startVenom() {
  return venom
    .create({
      session: 'session-escola',
      multidevice: true,
      headless: true,
      sessionPath:path.join(__dirname, 'session-escola'),
      args: [
        '--headless=new',
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ]
    })
    .then((client) => {
      clientInstance = client;
      console.log('✅ Venom iniciado com sucesso!');

      // Verificação de conexão a cada 60 segundos
      setInterval(async () => {
        try {
          const conectado = await clientInstance.isConnected();
          if (!conectado) {
            console.warn('⚠️ Conexão Venom perdida. Reiniciando...');
            process.exit(1); // PM2 reiniciará automaticamente
          } else {
            console.log('🔄 Venom ainda conectado:', new Date().toLocaleTimeString());
          }
        } catch (erro) {
          console.error('Erro ao verificar conexão Venom:', erro);
          process.exit(1);
        }
      }, 60000); // verifica a cada 1 minuto
    })
    .catch((err) => {
      console.error('❌ Erro ao iniciar Venom:', err);
    });
}

// Exporta função para envio de mensagem
async function sendMessage(numero, mensagem) {
  if (!clientInstance) {
    console.error('❌ Cliente Venom não iniciado.');
    return;
  }

  const numeroComDDI = numero.includes('@c.us') ? numero : `${numero}@c.us`;

  try {
    await clientInstance.sendText(numeroComDDI, mensagem);
    console.log('📤 Mensagem enviada para:', numero);
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
  }
}

module.exports = { startVenom, sendMessage };