const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const FormData = require('form-data');

// Configurações:
const URL_RAILWAY = "https://veritas-production-ba3a.up.railway.app/v3/predict/heatmap";
const SAUDACOES = ["oi", "olá", "ola", "oii", "oiii", "hey", "oi!", "olá!"];
const TIMEOUT_POST_API = 60000 // 60s

// Serviços externos
/**
 * Envia o buffer da imagem para a API do Veritas.
 * @param {Buffer} imageBuffer - O buffer da imagem baixada do WhatsApp.
 * @returns {Promise<{prediction: number, heatmapB64: string}>}
 */

async function analisarImagemNaAPI(imageBuffer) {
    const form = new FormData();
    form.append(
        'file', 
        imageBuffer,
        { filename: 'imagem.jpg', contentType: 'image/jpeg' }
    )

    const response = await axios.post(URL_RAILWAY, form, {
        headers: { ...form.getHeaders() },
        timeout: TIMEOUT_POST_API
    });

    return {
        prediction: response.data.prediction,
        heatmapB64: response.data.heatmap
    };
}

// Controllers

/**
 * Processa as mensagens de texto comuns.
 * @param {object} message - O objeto da mensagem original do wweb.js
 */

async function lidarComMensagemDeTexto(message) {
    const texto = message.body.trim().toLowerCase();
    
    if (SAUDACOES.includes(texto)) {
        await message.reply("Olá, tudo bem!? Por favor, envie uma foto para a gente analisar :)");
    } else {
        await message.reply("Por favor, envie uma imagem para eu analisar. 📸");
    }
}

/**
 * Processa as mensagens que contêm imagens.
 * @param {object} message - O objeto da mensagem original do wweb.js
 * @param {object} client - A instância do cliente do WhatsApp
 */

async function lidarComMensagemDeImagem(message, client) {
    await message.reply("Imagem recebida! Analisando... ⏳");

    try {
        // 1. Download e conversão da imagem
        const media = await message.downloadMedia();
        const imageBuffer = Buffer.from(media.data, 'base64');

        // 2. Chamada ao microsserviço de IA
        const { prediction, heatmapB64 } = await analisarImagemNaAPI(imageBuffer);

        // 3. Envio da predição em texto
        await message.reply(`✅ Análise concluída!\n\n📊 Resultado: *${prediction}% de chance de possuir manipulação.*\n\nAbaixo está o heatmap gerado:`);

        // 4. Montagem e envio do Heatmap como imagem
        const heatmapMedia = new MessageMedia('image/jpeg', heatmapB64, 'heatmap.jpg');
        await client.sendMessage(message.from, heatmapMedia, { caption: "Heatmap gerado pela análise" });

    } catch (error) {
        console.error("[ERRO API] Falha na integração:", error.message);
        await message.reply("❌ Ocorreu um erro ao processar a imagem no servidor. Tente novamente.");
    }
}

// Create a new client instance

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: '/app/session' // Diretório salvo no Volume do Railway
    }),
    puppeteer: {
        executablePath: '/usr/bin/chromium', // Força o uso do Chromium instalado no Dockerfile
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// Evento: Gera o QR Code no terminal do Railway
client.on('qr', (qr) => {
    console.log('Escaneie o QR Code abaixo com o WhatsApp do bot:');
    qrcode.generate(qr, { small: true });
});

// Evento: Confirmação de conexão
client.on('ready', () => {
    console.log('✅ Bot conectado e pronto para analisar imagens!');
});

// Evento: Escuta e roteia as mensagens
client.on('message', async (message) => {
    
    // Ignora atualizações de status ou mensagens de grupos
    if (message.isStatus || message.from.includes('@g.us')) return;

    if (message.type === 'chat') {
        await lidarComMensagemDeTexto(message);
    } 
    else if (message.type === 'image') {
        await lidarComMensagemDeImagem(message, client);
    } 
    else {
        // Trata áudios, vídeos, figurinhas ou documentos
        await message.reply("Notamos que você não enviou uma imagem. Por favor, tente novamente enviando apenas fotos. 📸");
    }
});

client.initialize();