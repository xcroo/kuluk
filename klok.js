const axios = require('axios'); // Untuk permintaan HTTP
const readline = require('readline'); // Untuk input pengguna
const fs = require('fs'); // Untuk membaca/menulis file
const https = require('https'); // Untuk konfigurasi HTTPS
const { SocksProxyAgent } = require('socks-proxy-agent'); // Untuk proxy SOCKS
const HttpsProxyAgent = require('https-proxy-agent'); // Untuk proxy HTTP

// Membuat interface untuk readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Pengaturan dasar
const settings = {
  BASE_URL: '', // Akan diisi dari config.json
  SESSION_TOKEN: '', // Akan diisi dari config.json
  USE_PROXY: false,
  PROXY_LIST: [],
  DELAY_BETWEEN_REQUESTS: [5000, 9000],
  QUESTIONS_FILE: 'questions.txt',
  CHAT_LIMIT: 50,
  STATE_FILE: 'bot_state.json',
  CHAT_ID: '', // Akan diisi dari config.json
  MODEL: 'llama-3.3-70b-instruct',
  CONFIG_FILE: 'config.json' // File konfigurasi
};

// Memuat konfigurasi dari config.json
function loadConfig() {
  if (fs.existsSync(settings.CONFIG_FILE)) {
    const config = JSON.parse(fs.readFileSync(settings.CONFIG_FILE, 'utf8'));
    settings.BASE_URL = config.BASE_URL;
    settings.SESSION_TOKEN = config.SESSION_TOKEN;
    settings.CHAT_ID = config.CHAT_ID;
  } else {
    console.log(`File ${settings.CONFIG_FILE} tidak ditemukan. Membuat file default...`);
    const defaultConfig = {
      BASE_URL: 'https://api1-pp.klokapp.ai/v1',
      SESSION_TOKEN: '2EdsbAklmODdxzg01KGTzkM9NNGwa0UCttTk6CFaASY',
      CHAT_ID: 'd7b12a7e-aacd-4c8e-9901-7474ff4edefe'
    };
    fs.writeFileSync(settings.CONFIG_FILE, JSON.stringify(defaultConfig, null, 2));
    console.log(`File ${settings.CONFIG_FILE} telah dibuat. Silakan periksa dan sesuaikan jika perlu.`);
    settings.BASE_URL = defaultConfig.BASE_URL;
    settings.SESSION_TOKEN = defaultConfig.SESSION_TOKEN;
    settings.CHAT_ID = defaultConfig.CHAT_ID;
  }
}

// Memuat pertanyaan dari file
function loadQuestions() {
  if (fs.existsSync(settings.QUESTIONS_FILE)) {
    return fs.readFileSync(settings.QUESTIONS_FILE, 'utf8').split('\n').filter(Boolean);
  } else {
    console.log(`File ${settings.QUESTIONS_FILE} tidak ditemukan. Membuat file default...`);
    const defaultQuestions = ['What is Bitcoin?', 'How does Ethereum work?'];
    fs.writeFileSync(settings.QUESTIONS_FILE, defaultQuestions.join('\n'));
    return defaultQuestions;
  }
}

const QUESTIONS = loadQuestions();

// Memuat status bot dari file
function loadState() {
  if (fs.existsSync(settings.STATE_FILE)) {
    return JSON.parse(fs.readFileSync(settings.STATE_FILE, 'utf8'));
  }
  return { chatCount: 0, lastReset: Date.now() };
}

// Menyimpan status bot ke file
function saveState(state) {
  fs.writeFileSync(settings.STATE_FILE, JSON.stringify(state));
}

// Fungsi untuk menunda eksekusi
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fungsi untuk mendapatkan angka acak dalam rentang tertentu
function getRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Fungsi untuk mendapatkan pertanyaan acak
function getRandomQuestion() {
  return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
}

// Fungsi untuk parsing proxy dan membuat agent
function getProxyAgent(proxy) {
  const match = proxy.match(/^(socks[45]h?|http):\/\/(?:([^:]+):([^@]+)@)?([^:]+):(\d+)/);
  if (!match) {
    console.error(`Format proxy salah: ${proxy}`);
    return null;
  }

  const [_, protocol, username, password, host, port] = match;
  console.log(`Menggunakan proxy: ${protocol}://${host}:${port}${username ? ` dengan username ${username}` : ''}`);

  if (protocol.startsWith('socks')) {
    console.log(`Membuat SOCKS proxy agent dengan string: ${proxy}`);
    try {
      return new SocksProxyAgent(proxy, { timeout: 10000 });
    } catch (error) {
      console.error('Gagal membuat SOCKS proxy agent:', error.message);
      return null;
    }
  } else if (protocol === 'http') {
    try {
      return new HttpsProxyAgent(proxy);
    } catch (error) {
      console.error('Gagal membuat HTTP proxy agent:', error.message);
      return null;
    }
  } else {
    console.error(`Protokol proxy tidak didukung: ${protocol}`);
    return null;
  }
}

// Fungsi untuk mendapatkan proxy acak dari daftar
function getRandomProxy() {
  if (!settings.USE_PROXY || settings.PROXY_LIST.length === 0) return null;
  const proxy = settings.PROXY_LIST[Math.floor(Math.random() * settings.PROXY_LIST.length)];
  return getProxyAgent(proxy);
}

// Fungsi untuk menguji proxy
async function testProxy(proxyAgent) {
  if (!proxyAgent) return false;
  try {
    const config = {
      httpsAgent: proxyAgent,
      timeout: 10000
    };
    const response = await axios.get('https://api.ipify.org?format=json', config);
    console.log(`Proxy berhasil! IP yang terdeteksi: ${response.data.ip}`);
    return true;
  } catch (error) {
    console.error(`Gagal menguji proxy:`, error.message);
    if (error.code) console.error(`Kode kesalahan: ${error.code}`);
    return false;
  }
}

// Fungsi untuk mengirim pesan
async function sendMessage() {
  const message = getRandomQuestion();
  const proxyAgent = getRandomProxy();
  try {
    const config = {
      headers: {
        'x-session-token': settings.SESSION_TOKEN,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://klokapp.ai',
        'Referer': 'https://klokapp.ai/app',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
      },
      httpsAgent: proxyAgent || new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true
      }),
      timeout: 30000
    };
    const payload = {
      messages: [
        {
          role: "user",
          content: message
        }
      ],
      chat_id: settings.CHAT_ID,
      model: settings.MODEL
    };
    const response = await axios.post(
      `${settings.BASE_URL}/chat`,
      payload,
      config
    );
    console.log(`Pesan terkirim: "${message}"`, response.data);
    return true;
  } catch (error) {
    console.error(`Gagal mengirim pesan:`, error.response ? error.response.data : error.message);
    if (error.response && error.response.data.detail) {
      error.response.data.detail.forEach(detail => {
        console.error(`Field yang hilang:`, detail.loc);
      });
    }
    if (error.code) console.error(`Kode kesalahan: ${error.code}`);
    return false;
  }
}

// Fungsi untuk mengecek dan menunggu jeda 24 jam
async function waitForNextCycle(state) {
  const now = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000;
  const timeSinceLastReset = now - state.lastReset;

  if (timeSinceLastReset < oneDayInMs) {
    const timeToWait = oneDayInMs - timeSinceLastReset;
    console.log(`Menunggu ${Math.round(timeToWait / (1000 * 60 * 60))} jam sebelum siklus berikutnya...`);
    await sleep(timeToWait);
  }

  state.chatCount = 0;
  state.lastReset = Date.now();
  saveState(state);
}

// Fungsi utama untuk menjalankan bot
async function runBot() {
  console.log('Memulai bot...');
  console.log(`Loaded ${QUESTIONS.length} questions from ${settings.QUESTIONS_FILE}`);

  // Uji proxy sebelum memulai
  if (settings.USE_PROXY) {
    const proxyAgent = getRandomProxy();
    if (proxyAgent) {
      console.log('Menguji proxy sebelum memulai...');
      const proxyWorks = await testProxy(proxyAgent);
      if (!proxyWorks) {
        console.error('Proxy tidak berfungsi. Bot akan berhenti. Silakan ganti proxy dan coba lagi.');
        process.exit(1);
      }
    }
  }

  let state = loadState();

  while (true) {
    if (state.chatCount >= settings.CHAT_LIMIT) {
      await waitForNextCycle(state);
      state = loadState();
    }

    while (state.chatCount < settings.CHAT_LIMIT) {
      const success = await sendMessage();
      if (success) {
        state.chatCount++;
        saveState(state);
      }
      const delay = getRandomNumber(settings.DELAY_BETWEEN_REQUESTS[0], settings.DELAY_BETWEEN_REQUESTS[1]);
      console.log(`Menunggu ${delay / 1000} detik sebelum pesan berikutnya...`);
      await sleep(delay);
    }

    console.log(`Selesai mengirim ${settings.CHAT_LIMIT} pesan hari ini.`);
  }
}

// Fungsi untuk mengatur konfigurasi
async function configureSettings() {
  // Muat konfigurasi dari config.json
  loadConfig();

  const useProxy = await new Promise(resolve => rl.question('Gunakan proxy? (y/n): ', resolve));
  settings.USE_PROXY = useProxy.toLowerCase() === 'y';
  
  if (settings.USE_PROXY) {
    const proxyFile = await new Promise(resolve => rl.question('Masukkan nama file proxy (contoh: proxy.txt): ', resolve));
    if (fs.existsSync(proxyFile)) {
      settings.PROXY_LIST = fs.readFileSync(proxyFile, 'utf8').split('\n').filter(Boolean);
      console.log(`Loaded ${settings.PROXY_LIST.length} proxies.`);
    } else {
      console.log('File proxy tidak ditemukan. Bot akan berjalan tanpa proxy.');
      settings.USE_PROXY = false;
    }
  }

  console.log('Pengaturan selesai:', settings);
}

// Fungsi untuk memulai program
async function start() {
  console.log('Selamat datang di Bot Tugas Otomatis');
  await configureSettings();
  await runBot();
}

start().catch(error => {
  console.error('Terjadi kesalahan:', error.message);
  rl.close();
});
