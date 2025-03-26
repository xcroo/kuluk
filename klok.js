const axios = require('axios'); // Untuk permintaan HTTP
const readline = require('readline'); // Untuk input pengguna
const fs = require('fs'); // Untuk membaca/menulis file
const https = require('https'); // Untuk konfigurasi HTTPS

// Membuat interface untuk readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Pengaturan dasar
const settings = {
  BASE_URL: 'https://api1-pp.klokapp.ai/v1', // URL API yang benar
  SESSION_TOKEN: '', // Session token untuk autentikasi
  USE_PROXY: false, // Gunakan proxy atau tidak
  PROXY_LIST: [], // Daftar proxy dari file
  DELAY_BETWEEN_REQUESTS: [5000, 9000], // Penundaan antar permintaan (dalam milidetik)
  QUESTIONS_FILE: 'questions.txt', // File tempat pertanyaan disimpan
  CHAT_LIMIT: 50, // Batas chat per hari
  STATE_FILE: 'bot_state.json', // File untuk menyimpan status bot
  CHAT_ID: '', // Chat ID akan diminta dari pengguna
  MODEL: 'llama-3.3-70b-instruct' // Model yang digunakan
};

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

// Fungsi untuk mendapatkan proxy acak dari daftar
function getRandomProxy() {
  if (!settings.USE_PROXY || settings.PROXY_LIST.length === 0) return null;
  const proxy = settings.PROXY_LIST[Math.floor(Math.random() * settings.PROXY_LIST.length)];
  const match = proxy.match(/http:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
  if (!match) {
    console.error(`Format proxy salah: ${proxy}`);
    return null;
  }
  const [, username, password, host, port] = match;
  return {
    host: host,
    port: parseInt(port),
    auth: {
      username: username,
      password: password
    }
  };
}

// Fungsi untuk mengirim pesan
async function sendMessage() {
  const message = getRandomQuestion();
  const proxyConfig = getRandomProxy();
  try {
    const config = {
      headers: {
        'x-session-token': settings.SESSION_TOKEN,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Origin': 'https://klokapp.ai',
        'Referer': 'https://klokapp.ai/app'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true
      }),
      timeout: 30000
    };
    if (proxyConfig) {
      config.proxy = proxyConfig;
    }
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
  settings.BASE_URL = await new Promise(resolve => rl.question('Masukkan URL API: ', resolve));
  settings.SESSION_TOKEN = await new Promise(resolve => rl.question('Masukkan Session Token: ', resolve));
  settings.CHAT_ID = await new Promise(resolve => rl.question('Masukkan Chat ID: ', resolve));
  
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
