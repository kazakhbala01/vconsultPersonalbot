#!/bin/bash
# ═══ DocAgent Server Setup ═══
# Run once on Contabo VPS: bash setup.sh

set -e

echo "🚀 DocAgent Server Setup"

# 1. System packages
echo "📦 Installing packages..."
sudo apt update
sudo apt install -y nodejs npm postgresql chromium-browser fonts-dejavu git

# 2. Node.js 20+ (if system version is old)
NODE_VER=$(node -v 2>/dev/null | cut -d. -f1 | tr -d v)
if [ "$NODE_VER" -lt 20 ] 2>/dev/null; then
  echo "📦 Upgrading Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

# 3. PM2
echo "📦 Installing PM2..."
sudo npm install -g pm2

# 4. PostgreSQL
echo "🐘 Setting up PostgreSQL..."
sudo -u postgres psql -c "CREATE USER docagent WITH PASSWORD 'docagent_pass_change_me';" 2>/dev/null || echo "User exists"
sudo -u postgres psql -c "CREATE DATABASE docagent OWNER docagent;" 2>/dev/null || echo "DB exists"

# 5. Clone repo (change URL)
echo "📂 Cloning repo..."
cd ~
if [ -d "docagent-bot" ]; then
  cd docagent-bot && git pull
else
  git clone https://github.com/YOUR_USERNAME/docagent-bot.git
  cd docagent-bot
fi

# 6. Install deps
echo "📦 Installing dependencies..."
npm install --production

# 7. Create .env if not exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "⚠️  Edit .env with your keys: nano .env"
fi

# 8. Start with PM2
echo "🚀 Starting bot..."
pm2 start bot.js --name docagent
pm2 save
pm2 startup

echo ""
echo "✅ Done! Next steps:"
echo "   1. nano .env  → fill TELEGRAM_BOT_TOKEN, GROQ_API_KEY, DATABASE_URL"
echo "   2. pm2 restart docagent"
echo "   3. Set up GitHub secrets for auto-deploy"
echo ""
echo "DATABASE_URL=postgresql://docagent:docagent_pass_change_me@localhost:5432/docagent"
