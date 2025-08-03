const venom = require('venom-bot');

let clientInstance = null;

// Inicializa o Venom apenas uma vez
function startVenom() {
  return venom
    .create({
      session: 'session-escola',
      multidevice: true, // ou false, dependendo do seu WhatsApp
    })
    .then((client) => {
      clientInstance = client;
      console.log('✅ Venom iniciado com sucesso!');
    })
    .catch((err) => {
      console.error('Erro ao iniciar Venom:', err);
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