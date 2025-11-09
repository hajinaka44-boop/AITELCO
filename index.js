/**
 * index.js — AITelco Reports -> Telegram Forwarder (DRIXALEXA v6 Config)
 * ✅ Baca TELEGRAM_TOKEN & CHAT_ID dari config.json
 * ✅ Deteksi negara + emoji dari prefix nomor
 * ✅ Mask nomor format 221765***677
 * ✅ Tampilan Telegram sangar (by DRIXALEXA)
 * ✅ Hindari duplikat
 */

const fs = require("fs");
const path = require("path");
const axios = require("axios");
const https = require("https");

// ====== CONFIG LOADER ======
const CONFIG_FILE = path.join(__dirname, "config.json");
let TELEGRAM_TOKEN = "";
let TELEGRAM_CHAT_ID = "";

try {
  if (!fs.existsSync(CONFIG_FILE)) throw new Error("config.json tidak ditemukan!");
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  TELEGRAM_TOKEN = cfg.TELEGRAM_TOKEN || "";
  TELEGRAM_CHAT_ID = cfg.TELEGRAM_CHAT_ID || "";
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) throw new Error("config.json tidak lengkap!");
} catch (e) {
  console.log("❌ Gagal memuat config.json:", e.message);
  process.exit(1);
}
// ===========================

const PANEL_BASE = "http://51.89.7.175/sms/subclient";
const DT_ENDPOINT = `${PANEL_BASE}/ajax/dt_reports.php`;

const COOKIE_FILE = path.join(__dirname, ".cookie");
const LAST_ID_FILE = path.join(__dirname, "last_id.json");
const CHECK_INTERVAL_MS = 15 * 1000;

let lastHash = null;

/* ---------- Utilities ---------- */

function loadCookieHeader() {
  try {
    const raw = fs.readFileSync(COOKIE_FILE, "utf8").trim();
    if (!raw) return null;
    return raw.includes("=") ? raw : `PHPSESSID=${raw}`;
  } catch {
    return null;
  }
}

function loadLastId() {
  try {
    return JSON.parse(fs.readFileSync(LAST_ID_FILE, "utf8")).lastId || null;
  } catch {
    return null;
  }
}

function saveLastId(id) {
  try {
    fs.writeFileSync(LAST_ID_FILE, JSON.stringify({ lastId: id }), "utf8");
  } catch {}
}

function maskNumber(num) {
  const s = String(num || "");
  if (s.length <= 6) return `${s.slice(0, 2)}***${s.slice(-2)}`;
  if (s.length <= 10) return `${s.slice(0, 4)}***${s.slice(-3)}`;
  return `${s.slice(0, 6)}***${s.slice(-3)}`;
}

function detectOTP(text) {
  if (!text) return "";
  let m = text.match(/\b(\d{3,4}[-\s]?\d{3,4})\b/);
  if (m) return m[1].replace(/[-\s]/g, "");
  m = text.match(/\b(\d{4,8})\b/);
  if (m) return m[1];
  return "";
}

// === COUNTRY MAP ===
const COUNTRY_CODES = {
  20: "Egypt 🇪🇬", 221: "Senegal 🇸🇳", 234: "Nigeria 🇳🇬", 212: "Morocco 🇲🇦",
  213: "Algeria 🇩🇿", 216: "Tunisia 🇹🇳", 218: "Libya 🇱🇾", 254: "Kenya 🇰🇪",
  62: "Indonesia 🇮🇩", 91: "India 🇮🇳", 84: "Vietnam 🇻🇳", 60: "Malaysia 🇲🇾",
  63: "Philippines 🇵🇭", 92: "Pakistan 🇵🇰", 55: "Brazil 🇧🇷", 7: "Russia 🇷🇺",
  1: "USA 🇺🇸", 44: "UK 🇬🇧", 33: "France 🇫🇷", 49: "Germany 🇩🇪",
  34: "Spain 🇪🇸", 81: "Japan 🇯🇵", 86: "China 🇨🇳", 380: "Ukraine 🇺🇦",
  998: "Uzbekistan 🇺🇿", 996: "Kyrgyzstan 🇰🇬"
};

function extractCountry(terminationText, number = "") {
  const num = String(number || "").replace(/\D/g, "");
  for (const [code, name] of Object.entries(COUNTRY_CODES)) {
    if (num.startsWith(code)) return name;
  }
  const clean = String(terminationText || "").trim();
  for (const [code, name] of Object.entries(COUNTRY_CODES)) {
    if (clean.toLowerCase().includes(name.split(" ")[0].toLowerCase())) return name;
  }
  return `${clean} 🇺🇳`;
}

function toWIB(timestr) {
  const d = new Date(timestr);
  if (isNaN(d.getTime())) return timestr;
  const wib = new Date(d.getTime() + 7 * 3600 * 1000);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(wib.getDate())}-${pad(wib.getMonth() + 1)}-${wib.getFullYear()} ${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())} WIB`;
}

// === Format Telegram ===
function buildTelegramText(payload) {
  const flagMatch = payload.country.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);
  const flag = flagMatch ? flagMatch[0] : "🌍";
  const countryName = payload.country.split(" ")[0];

  return [
    `${flag} ${countryName} ${payload.application || "App"}🔥`,
    "━━━━━━━━━━━━━━━",
    `🌍 <b>Negara:</b> ${payload.country}`,
    `📱 <b>Aplikasi:</b> ${payload.application}`,
    `📞 <b>Nomor:</b> <code>${maskNumber(payload.number)}</code>`,
    `🔑 <b>OTP:</b> <code>${payload.otp || "N/A"}</code>`,
    `⏰ <b>Waktu:</b> ${toWIB(payload.time)}`,
    "━━━━━━━━━━━━━━━",
    `💬 <b>Pesan:</b>\n${payload.message}`,
    "━━━━━━━━━━━━━━━",
    "⚡by <b>DRIXALEXA</b> ⚡"
  ].join("\n");
}

async function sendTelegram(text) {
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text,
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "👑 ADMIN", url: "https://t.me/protcp" },
          { text: "📢 CHANNEL", url: "https://t.me/whatsappnokos" },
        ],
      ],
    },
  };
  try {
    await axios.post(url, payload, { timeout: 15000 });
    console.log("✅ Terkirim ke Telegram");
  } catch (err) {
    console.log("❌ Gagal kirim Telegram:", err.response?.data || err.message);
  }
}

/* ---------- Core checker ---------- */
async function checkReports() {
  try {
    const cookie = loadCookieHeader();
    if (!cookie)
      return console.log("⚠️ .cookie tidak ditemukan atau kosong. Isi file .cookie dengan PHPSESSID=...");

    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fdate1 = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`;
    const fdate2 = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59:59`;

    const url = `${DT_ENDPOINT}?fdate1=${encodeURIComponent(fdate1)}&fdate2=${encodeURIComponent(fdate2)}`;
    const agent = new https.Agent({ rejectUnauthorized: false });

    const res = await axios.get(url, {
      timeout: 15000,
      headers: {
        Cookie: cookie,
        "User-Agent": "Mozilla/5.0 (Node.js)",
        Accept: "application/json",
        Referer: `${PANEL_BASE}/Reports`,
        "X-Requested-With": "XMLHttpRequest",
      },
      httpsAgent: agent,
      validateStatus: null,
    });

    const rows = res.data?.aaData || res.data?.data || [];
    if (!Array.isArray(rows) || rows.length === 0)
      return console.log("⏳ Menunggu pesan baru...");

    const valid = rows.filter((r) => Array.isArray(r) && r[2] && String(r[2]).length > 5 && r[7]);
    if (valid.length === 0) return console.log("⏳ Tidak ada pesan valid...");

    valid.sort((a, b) => new Date(a[0]) - new Date(b[0]));
    const latest = valid[valid.length - 1];

    const payload = {
      time: latest[0],
      country: extractCountry(latest[1], latest[2]),
      number: latest[2],
      application: latest[3] || "Unknown",
      otp: detectOTP(latest[7]),
      message: latest[7],
    };

    const hash = `${payload.number}_${payload.time}_${payload.otp}`;
    if (hash === lastHash) return console.log("⏳ Duplikat, lewati...");

    console.log(`📩 Pesan baru: ${payload.country} | ${payload.application} | +${payload.number}`);
    await sendTelegram(buildTelegramText(payload));

    lastHash = hash;
    saveLastId(hash);
  } catch (err) {
    console.log("❌ ERROR:", err.message);
  }
}

/* ---------- Start loop ---------- */
(async () => {
  console.log("🚀 Forwarder aktif — memeriksa setiap", CHECK_INTERVAL_MS / 1000, "detik");
  lastHash = loadLastId();
  await checkReports();
  setInterval(checkReports, CHECK_INTERVAL_MS);
})();