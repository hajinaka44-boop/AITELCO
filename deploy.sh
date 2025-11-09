#!/data/data/com.termux/files/usr/bin/bash
# ==================================================
# 🚀 DRIXALEXA BOT AUTO DEPLOY + AUTO UPDATE (AITELCO)
# Repo: https://github.com/hajinaka44-boop/AITELCO
# ==================================================

REPO_URL="https://github.com/hajinaka44-boop/AITELCO.git"
TARGET_DIR="$HOME/AITELCO"
BOT_NAME="aitelco"

clear
echo "====================================="
echo "🔰 DRIXALEXA BOT AUTO DEPLOY (AITELCO)"
echo "====================================="
echo "Mempermudah anda untuk Mendeploy bot"
echo "hanya 1x klik bot auto run "
echo "====================================="

sleep 3
# === Auto-refresh script dari GitHub ===
if [ ! -f "deploy.sh" ]; then
  echo "📥 Mengunduh deploy.sh terbaru dari GitHub..."
  curl -fsSL "https://github.com/hajinaka44-boop/AITELCO/blob/main/deploy.sh" -o deploy.sh
  chmod +x deploy.sh
fi

# === Mode update cepat ===
if [ "$1" == "--update" ]; then
  echo "♻️  Mengupdate bot ke versi terbaru..."
  if [ -d "$TARGET_DIR" ]; then
    cd "$TARGET_DIR"
    git reset --hard
    git pull
    if [ -f "package.json" ]; then
      npm install
    fi
    echo "🔁 Restart bot..."
    pm2 restart $BOT_NAME
    echo "✅ Bot sudah diupdate dan direstart!"
  else
    echo "❌ Folder repo belum ada. Jalankan ./deploy.sh tanpa --update dulu."
  fi
  exit 0
fi

clear

# === Update & install basic tools ===
pkg update -y && pkg upgrade -y
pkg install -y git nodejs-lts python curl

# === Install pm2 ===
npm install -g pm2

clear
# === Clone / update repo ===
if [ -d "$TARGET_DIR" ]; then
  echo "📁 Repo sudah ada, update dari GitHub..."
  cd "$TARGET_DIR" && git pull
else
  echo "📥 Meng-clone repo dari GitHub..."
  git clone "$REPO_URL" "$TARGET_DIR"
  cd "$TARGET_DIR"
fi

# === Install dependencies dari package.json ===
if [ -f "package.json" ]; then
  echo "📦 Menginstall dependencies dari package.json..."
  npm install
else
  echo "⚠️ Tidak ada package.json, install manual axios..."
  npm install axios
fi

clear

# === Wake lock Termux ===
echo "🔒 Mengaktifkan wakelock (biar gak tidur)..."
termux-wake-lock

# === Setup config.json ===
if [ ! -f "config.json" ]; then
  echo "⚙️ Membuat config.json baru..."
  cat <<EOF > config.json
{
  "TELEGRAM_TOKEN": "ISI_TOKEN_BOTMU",
  "TELEGRAM_CHAT_ID": "ISI_CHAT_ID_GRUP"
}
EOF
fi
echo ""
echo "📝 Isi TELEGRAM_TOKEN dan CHAT_ID di config.json"
echo " KLIK CTRL + o ENTER UNTUK SAVE "
echo " KLIK CTRL + x ENTER UNTUK CLOSE "
sleep 3
nano config.json

# === Setup .cookie ===
if [ ! -f ".cookie" ]; then
  echo "PASTE_YOUR_COOKIE" > .cookie
fi
echo ""
echo "📝 Masukkan COOKIE (contoh: YOUR_COOKIE)"
echo " KLIK CTRL + o ENTER UNTUK SAVE "
echo " KLIK CTRL + x ENTER UNTUK CLOSE "
sleep 3
nano .cookie

# === Jalankan pakai PM2 ===
echo "🚀 Menjalankan bot dengan PM2..."
pm2 delete $BOT_NAME >/dev/null 2>&1
pm2 start index.js --name $BOT_NAME

# === Simpan auto-start ===
pm2 save
pm2 startup

clear

echo ""
echo "====================================="
echo "✅ BOT SUDAH AKTIF!"
echo "⚡YOUR BOT NAME: $BOT_NAME"
echo "💡 Logs: pm2 logs $BOT_NAME"
echo "💡 Stop: pm2 stop $BOT_NAME"
echo "💡 Restart: pm2 restart $BOT_NAME"
echo "💡 Cek status: pm2 list"
echo "💡 Update bot: ./deploy.sh --update"
echo "====================================="
echo " Dev: DrixAlexa CyberTeam"
echo "====================================="
