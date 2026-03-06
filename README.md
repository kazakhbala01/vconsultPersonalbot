# DocAgent v5 — Deploy Guide

Деплой бота на бесплатные платформы. Бот работает в режиме **polling** (оригинальный `bot.js`) — никаких изменений в логике.

Единственное изменение: `pdf.js` читает `PUPPETEER_EXECUTABLE_PATH` чтобы найти системный Chromium в Docker.

---

## Что нужно перед деплоем

1. **PostgreSQL** с доступом через интернет:
   - [Neon](https://neon.tech) — бесплатно, serverless PG, идеально
   - [Supabase](https://supabase.com) — бесплатно, 500MB
   - Или открой порт на своём Hetzner/Contabo

2. **Env переменные:**
   ```
   TELEGRAM_BOT_TOKEN=...
   OPENAI_API_KEY=...
   OPENAI_MODEL=gpt-4o-mini
   DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require
   ```

---

## 🚂 Railway (рекомендую)

Проще всего. Push на GitHub → Railway подхватит Dockerfile.

### Шаги:

```bash
# 1. Залей код на GitHub
git init && git add . && git commit -m "docagent"
gh repo create docagent --private --push

# 2. Зайди на railway.app → New Project → Deploy from GitHub
#    Выбери репо, Railway увидит Dockerfile

# 3. Добавь env переменные во вкладке Variables:
#    TELEGRAM_BOT_TOKEN, OPENAI_API_KEY, OPENAI_MODEL, DATABASE_URL

# 4. Готово! Railway сбилдит и запустит.
```

### Нюансы:
- **$5/мес бесплатных кредитов** (хватит на лёгкого бота)
- Если кредиты закончатся — бот остановится до следующего месяца
- Можно добавить PostgreSQL прямо в Railway (кнопка + Database)
- Логи видно в дашборде

### Если нужна БД прямо в Railway:
```
Railway Dashboard → + New → Database → PostgreSQL
Скопируй DATABASE_URL из Variables
```

---

## 🪰 Fly.io

Полноценный Docker, 3 бесплатных shared VMs.

### Шаги:

```bash
# 1. Установи flyctl
curl -L https://fly.io/install.sh | sh
fly auth login

# 2. Создай приложение
fly launch --no-deploy
# → выбери регион waw (Варшава) или fra (Франкфурт)
# → НЕ создавай PostgreSQL через Fly (дорого), используй Neon

# 3. Добавь секреты
fly secrets set TELEGRAM_BOT_TOKEN=xxx
fly secrets set OPENAI_API_KEY=xxx
fly secrets set OPENAI_MODEL=gpt-4o-mini
fly secrets set DATABASE_URL="postgresql://..."

# 4. Деплой
fly deploy

# 5. Проверь логи
fly logs
```

### Нюансы:
- Бесплатно: 3 shared-cpu-1x VMs, 256MB RAM каждая
- Для Chromium нужно **512MB** → в `fly.toml` уже стоит `memory = "512mb"`
- 512MB выйдет за бесплатный лимит (~$2-3/мес), но первые $5 бесплатно
- Регион `waw` (Варшава) — ближайший к Астане с хорошим пингом

### Если бот не стартует:
```bash
fly logs                    # логи
fly ssh console             # SSH в контейнер
fly scale memory 512        # если мало RAM
```

---

## 🎨 Render.com

Бесплатный Worker (без HTTP).

### Шаги:

```bash
# 1. Залей на GitHub

# 2. render.com → New → Worker → Connect GitHub repo
#    Build Command: (пусто — Dockerfile)
#    Или: New → Blueprint → залей render.yaml

# 3. Environment → добавь переменные

# 4. Deploy
```

### Нюансы:
- **Worker** тип (не Web Service) — идеально для polling-бота
- Бесплатный tier: **засыпает через 15 мин** без активности
  - Но polling поддерживает соединение → должен работать
  - Если засыпает — поставь cron-job на healthcheck
- Бесплатный PG на 90 дней, потом удалят → лучше Neon

---

## 📁 Структура файлов для деплоя

Скопируй эти файлы В КОРЕНЬ своего проекта (рядом с `bot.js`):

```
your-project/
├── bot.js              ← оригинальный (без изменений)
├── ai.js               ← оригинальный
├── db.js               ← оригинальный
├── pdf.js              ← ОБНОВЛЁННЫЙ (поддержка Docker Chromium)
├── excel.js            ← оригинальный
├── numwords.js         ← оригинальный
├── templates/          ← оригинальные
├── package.json        ← оригинальный
├── Dockerfile          ← НОВЫЙ
├── .dockerignore       ← НОВЫЙ
├── fly.toml            ← для Fly.io
├── railway.json        ← для Railway
└── render.yaml         ← для Render
```

**Единственный файл который нужно заменить — `pdf.js`.**
Всё остальное — просто добавить в корень.

---

## 🔄 Локальный тест через Docker

```bash
# Собрать
docker build -t docagent .

# Запустить
docker run --env-file .env docagent

# Или docker-compose:
docker compose up
```

---

## ⚡ Сравнение платформ

| | Railway | Fly.io | Render |
|---|---------|--------|--------|
| **Бесплатно** | $5/мес кредиты | 3 VMs (256MB) | Worker free tier |
| **RAM** | гибко | 256MB бесплатно | 512MB |
| **Засыпает?** | ❌ нет | ❌ нет | ⚠️ через 15 мин |
| **Деплой** | GitHub push | `fly deploy` | GitHub push |
| **PG встроенный** | ✅ да | ✅ (платно) | ✅ (90 дней) |
| **Регион** | US/EU | Варшава | Франкфурт |
| **Сложность** | ⭐ легко | ⭐⭐ средне | ⭐ легко |
| **Рекомендация** | 🥇 | 🥈 | 🥉 |

---

## 💡 Советы

- **БД**: используй [Neon](https://neon.tech) — бесплатный PG, не засыпает, serverless
- **Мониторинг**: Railway и Fly.io показывают логи в дашборде
- **Если кончатся кредиты**: всегда можно вернуться на VPS, код один и тот же
- **Chromium RAM**: если бот падает с OOM — нужно минимум 512MB
