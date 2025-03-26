const axios = require('axios'); // Untuk permintaan HTTP
const { HttpsProxyAgent } = require('http-proxy-agent'); // Untuk proxy HTTP
const readline = require('readline'); // Untuk input pengguna
const fs = require('fs'); // Untuk membaca/menulis file

// Membuat interface untuk readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Pengaturan dasar
const settings = {
  BASE_URL: 'https://klokapp.ai/app.txt?c=073c529d-8078-4ca7-a635-b65836497983&_rsc=1m4kk', // Ganti dengan URL API target
  SESSION_TOKEN: '', // Session token untuk autentikasi
  USE_PROXY: false, // Gunakan proxy atau tidak
  PROXY_LIST: [], // Daftar proxy dari file
  DELAY_BETWEEN_REQUESTS: [5000, 9000], // Penundaan antar permintaan (dalam milidetik)
  TASKS: ['task1', 'task2'], // Daftar tugas
  QUESTIONS_FILE: 'questions.txt', // File tempat pertanyaan disimpan
  CHAT_LIMIT: 50, // Batas chat per hari
  STATE_FILE: 'bot_state.json', // File untuk menyimpan status bot
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
  return new HttpsProxyAgent(`http://${proxy}`);
}

// Fungsi untuk mengirim pesan
async function sendMessage() {
  const message = getRandomQuestion();
  const proxyAgent = getRandomProxy();
  try {
    const response = await axios.post(
      `${settings.BASE_URL}/chat`,
      { message: message }, // Kirim pertanyaan acak
      {
        headers: { 'x-session-token': settings.SESSION_TOKEN }, // Gunakan session token
        httpsAgent: proxyAgent // Gunakan proxy jika aktif
      }
    );
    console.log(`Pesan terkirim: "${message}"`, response.data);
    return true;
  } catch (error) {
    console.error(`Gagal mengirim pesan:`, error.message);
    return false;
  }
}

// Fungsi untuk mengecek dan menunggu jeda 24 jam
async function waitForNextCycle(state) {
  const now = Date.now();
  const oneDayInMs = 24 * 60 * 60 * 1000; // 24 jam dalam milidetik
  const timeSinceLastReset = now - state.lastReset;

  if (timeSinceLastReset < oneDayInMs) {
    const timeToWait = oneDayInMs - timeSinceLastReset;
    console.log(`Menunggu ${Math.round(timeToWait / (1000 * 60 * 60))} jam sebelum siklus berikutnya...`);
    await sleep(timeToWait);
  }

  // Reset state setelah 24 jam
  state.chatCount = 0;
  state.lastReset = Date.now();
  saveState(state);
}

// Fungsi utama untuk menjalankan bot
async function runBot() {
  console.log('Memulai bot...');
  console.log(`Loaded ${QUESTIONS.length} questions from ${settings.QUESTIONS_FILE}`);

  let state = loadState();

  while (true) { // Loop tanpa henti
    // Cek apakah sudah 24 jam sejak reset terakhir
    if (state.chatCount >= settings.CHAT_LIMIT) {
      await waitForNextCycle(state);
      state = loadState(); // Muat ulang state setelah reset
    }

    // Kirim pesan hingga mencapai batas 50
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
