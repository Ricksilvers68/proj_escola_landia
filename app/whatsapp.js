const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: './whatsapp-session' }),
  puppeteer: {
    headless: true, // Não abre janela do navegador
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  },
});

client.on('qr', (qr) => {
  console.log('Escaneie este QR Code para autenticar:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ WhatsApp conectado!');
});

async function sendMessage(numero, mensagem) {
  const numeroFormatado = numero.endsWith('@c.us') ? numero : `${numero}@c.us`;
  try {
    const registrado = await client.isRegisteredUser(numeroFormatado);
    if (!registrado) {
      console.log(`❌ Número não registrado no WhatsApp: ${numeroFormatado}`);
      return;
    }
    await client.sendMessage(numeroFormatado, mensagem);
    console.log(`📨 Mensagem enviada para ${numeroFormatado}`);
  } catch (err) {
    console.error(`❌ Erro ao enviar mensagem para ${numeroFormatado}:`, err);
  }
}

module.exports = client;

