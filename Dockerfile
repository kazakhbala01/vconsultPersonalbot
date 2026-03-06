# ═══════════════════════════════════════════════════
# DocAgent v5 — Docker (Railway / Fly.io / Render)
# Node 20 + Chromium для Puppeteer PDF
# ═══════════════════════════════════════════════════

FROM node:20-slim

# Chromium dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-dejavu-core \
    fonts-freefont-ttf \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer → использовать системный Chromium (не скачивать свой)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Зависимости (кэшируются если package.json не менялся)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

# Код
COPY ../../AppData/Local/Temp .

# Папка для логов
RUN mkdir -p logs

# Healthcheck (опционально, для Fly.io/Render)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "console.log('ok')" || exit 1

CMD ["node", "bot.js"]
