const axios = require('axios'); // Untuk permintaan HTTP
const { HttpsProxyAgent } = require('http-proxy-agent'); // Untuk proxy HTTP
const readline = require('readline'); // Untuk input pengguna
const fs = require('fs'); // Untuk membaca file

// Membuat interface untuk readline
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Pengaturan dasar
const settings = {
  BASE_URL: 'https://example.com/api', // Ganti dengan URL API target
  SESSION_TOKEN: '', // Session token untuk autentikasi
  USE_PROXY: false, // Gunakan proxy atau tidak
  PROXY_LIST: [], // Daftar proxy dari file
  DELAY_BETWEEN_REQUESTS: [1000, 3000], // Penundaan antar permintaan (dalam milidetik)
  TASKS: ['task1', 'task2'], // Daftar tugas
  QUESTIONS_FILE: 'questions.txt', // File tempat pertanyaan disimpan
};

// Fungsi untuk membaca pertanyaan dari file
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

const QUESTIONS = loadQuestions(); // Memuat pertanyaan dari file

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

// Fungsi untuk menyelesaikan tugas
async function completeTask(taskId) {
  const proxyAgent = getRandomProxy();
  try {
    const response = await axios.post(
      `${settings.BASE_URL}/tasks/${taskId}`,
      { status: 'completed' }, // Sesuaikan payload dengan API
      {
        headers: { 'x-session-token': settings.SESSION_TOKEN }, // Gunakan session token
        httpsAgent: proxyAgent // Gunakan proxy jika aktif
      }
    );
    console.log(`Tugas ${taskId} selesai:`, response.data);
    return true;
  } catch (error) {
    console.error(`Gagal menyelesaikan tugas ${taskId}:`, error.message);
    return false;
  }
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

// Fungsi utama untuk menjalankan bot
async function runBot() {
  console.log('Memulai bot...');
  console.log(`Loaded ${QUESTIONS.length} questions from ${settings.QUESTIONS_FILE}`);

  // Menyelesaikan semua tugas
  for (const task of settings.TASKS) {
    await completeTask(task);
    const delay = getRandomNumber(settings.DELAY_BETWEEN_REQUESTS[0], settings.DELAY_BETWEEN_REQUESTS[1]);
    console.log(`Menunggu ${delay / 1000} detik sebelum tugas berikutnya...`);
    await sleep(delay);
  }

  // Mengirim 5 pesan sebagai contoh (bisa disesuaikan)
  for (let i = 0; i < 5; i++) {
    await sendMessage();
    const delay = getRandomNumber(settings.DELAY_BETWEEN_REQUESTS[0], settings.DELAY_BETWEEN_REQUESTS[1]);
    console.log(`Menunggu ${delay / 1000} detik sebelum pesan berikutnya...`);
    await sleep(delay);
  }

  console.log('Bot selesai berjalan.');
  rl.close();
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
