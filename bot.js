/**
 * DocAgent v5 — AI только для парсинга
 *
 * Все ответы бота — в коде
 * AI вызывается ТОЛЬКО чтобы распарсить свободный текст в JSON
 *
 * Профиль: одно сообщение / фото → AI парсит → показ → подтверждение
 * Документ: одно сообщение → AI парсит → черновик → подтверждение → PDF/Excel
 */

require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const AIService = require("./ai");
const db = require("./db");
const { numberToWords } = require("./numwords");
const { generatePDF, closeBrowser } = require("./pdf");
const { generateExcel } = require("./excel");
const fs = require("fs");

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const ai = new AIService(process.env.OPENAI_API_KEY, process.env.OPENAI_MODEL);

// userId → { mode, data }
const states = new Map();
const lastContext = new Map(); // Память последнего распознанного текста

const mainKb = Markup.keyboard([
  ["💰 Счёт", "✅ Акт", "📊 КП"],
  ["⚙️ Профиль", "🔧 Настройки"],
]).resize();

const cancelKb = Markup.keyboard([["❌ Отмена"]]).resize();

// ═══ СТАРТ ═══

bot.start(async (ctx) => {
  states.delete(ctx.from.id);
  const p = await db.getProfile(ctx.from.id);
  ctx.reply(
      `👋 ${ctx.from.first_name}!\n\n` +
      (p && p.name
          ? `✅ Профиль заполнен — реквизиты подставятся автоматически.`
          : `💡 Заполните /profile один раз — реквизиты будут подставляться автоматически.\nИли укажите "Моя компания:" в сообщении с данными.`) +
      `\n\nВыберите тип документа!`,
      mainKb
  );
});

bot.command("help", (ctx) => ctx.reply(
    `Как работает:\n\n` +
    `1. ⚙️ Профиль — отправьте реквизиты одним сообщением\n` +
    `2. Выберите тип (Счёт/Акт/КП/...)\n` +
    `3. Отправьте все данные одним сообщением\n` +
    `4. Проверьте черновик → Да → PDF!\n\n` +
    `Пример для счёта:\n` +
    `ТОО Партасан 594524901234 Алматы\n` +
    `без договора\n` +
    `подключение WhatsApp 2 усл 24000\n` +
    `подключение Instagram 2 усл 11000\n` +
    `сегодня\n\n` +
    `/settings — формат PDF/Excel\n` +
    `/docs — история документов\n` +
    `/cancel — отмена`
));

bot.command("cancel", (ctx) => {
  states.delete(ctx.from.id);
  ctx.reply("❌ Отменено.", mainKb);
});

// ═══ НАСТРОЙКИ ═══

bot.command("settings", (ctx) => showSettings(ctx));
bot.hears("🔧 Настройки", (ctx) => showSettings(ctx));
async function showSettings(ctx) {
  const s = await db.getSettings(ctx.from.id);
  ctx.reply(`Формат: ${(s.format || "pdf").toUpperCase()}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("📄 PDF", "fmt_pdf"), Markup.button.callback("📊 Excel", "fmt_xls"), Markup.button.callback("📄+📊 Оба", "fmt_both")],
      ])
  );
}
bot.action("fmt_pdf", async (ctx) => { await db.saveSetting(ctx.from.id, "format", "pdf"); ctx.answerCbQuery(); ctx.editMessageText("✅ PDF"); });
bot.action("fmt_xls", async (ctx) => { await db.saveSetting(ctx.from.id, "format", "excel"); ctx.answerCbQuery(); ctx.editMessageText("✅ Excel"); });
bot.action("fmt_both", async (ctx) => { await db.saveSetting(ctx.from.id, "format", "both"); ctx.answerCbQuery(); ctx.editMessageText("✅ PDF + Excel"); });

// ═══ ИСТОРИЯ ═══

bot.command("docs", async (ctx) => {
  const docs = await db.getDocuments(ctx.from.id);
  if (!docs.length) return ctx.reply("Документов нет.");
  ctx.reply("📋 Документы:\n\n" + docs.map((d, i) => `${i + 1}. ${d.title || d.doc_type} ${d.number ? `№${d.number}` : ""} ${d.doc_date || ""} → /doc_${d.id}`).join("\n"));
});

bot.hears(/^\/doc_(\d+)$/, async (ctx) => {
  const doc = await db.getDocumentById(ctx.match[1]);
  if (!doc || doc.user_id !== ctx.from.id) return ctx.reply("Не найден.");
  await sendFiles(ctx, doc.data);
});

// ═══ ПРОФИЛЬ ═══

const PROFILE_PROMPT = `📋 Отправьте реквизиты компании одним сообщением.

Нужно заполнить:
1. Название компании (ИП/ТОО)
2. ИИН/БИН (12 цифр)
3. Адрес
4. Банк
5. ИИК (расчётный счёт)
6. БИК
7. Кбе (19 для ИП, 17 для ТОО)
8. КНП (код платежа, обычно 859)
9. ФИО руководителя
10. ФИО бухгалтера (или "-" если нет)

Пример:
ИП "Моя компания"
БИН 123456789012
г. Астана, ул. Примерная 1
Каспи банк
KZ00000S000000000000
Кбе 19
КНП 859
Директор: Фамилия И.О.
Бухгалтер: -

Можно скопировать из любого документа — AI сам разберётся.`;

bot.command("profile", (ctx) => profileMenu(ctx));
bot.hears("⚙️ Профиль", (ctx) => profileMenu(ctx));

async function profileMenu(ctx) {
  const p = await db.getProfile(ctx.from.id);
  if (p && p.name) {
    const logoStatus = p.logo ? "✅ Логотип" : "❌ Логотип";
    const signStampStatus = p.signstamp ? "✅ Подпись+Печать" : "❌ Подпись+Печать";
    ctx.reply(
        `📋 Ваш профиль:\n\n` + formatProfile(p) +
        `\n${logoStatus} | ${signStampStatus}` +
        `\n\nЧто сделать?`,
        Markup.inlineKeyboard([
          [Markup.button.callback("✏️ Изменить", "pf_edit"), Markup.button.callback("📷 Логотип", "pf_logo")],
          [Markup.button.callback("✍️ Подпись+Печать", "pf_signstamp")],
          [Markup.button.callback("🗑 Удалить", "pf_del"), Markup.button.callback("✅ Ок", "pf_ok")],
        ])
    );
  } else {
    states.set(ctx.from.id, { mode: "profile_input" });
    ctx.reply(PROFILE_PROMPT, cancelKb);
  }
}

bot.action("pf_edit", (ctx) => {
  ctx.answerCbQuery();
  states.set(ctx.from.id, { mode: "profile_edit" });
  ctx.reply(
      "✏️ Напишите что изменить, например:\n\n" +
      "• банк каспи\n" +
      "• адрес г. Астана, ул. Мира 5\n" +
      "• директор Иванов А.Б.\n" +
      "• бин 123456789012\n" +
      "• ИИК KZ00000S000000000000\n\n" +
      "Или напишите «заново» чтобы заполнить всё с нуля.",
      cancelKb
  );
});
bot.action("pf_del", async (ctx) => { ctx.answerCbQuery(); await db.deleteProfile(ctx.from.id); ctx.reply("🗑 Удалён.", mainKb); });
bot.action("pf_ok", (ctx) => { ctx.answerCbQuery(); ctx.reply("👍", mainKb); });
bot.action("pf_logo", (ctx) => {
  ctx.answerCbQuery();
  states.set(ctx.from.id, { mode: "logo_upload" });
  ctx.reply("📷 Отправьте логотип как фото (квадратный, PNG/JPG):", cancelKb);
});
bot.action("pf_signstamp", (ctx) => {
  ctx.answerCbQuery();
  states.set(ctx.from.id, { mode: "signstamp_upload" });
  ctx.reply("✍️ Отправьте одно PNG-фото с подписью и печатью вместе (без фона, прозрачный):", cancelKb);
});

// ─── Загрузка изображений (логотип / подпись+печать) ───
async function handleImageUpload(ctx, fileId, mode) {
  const uid = ctx.from.id;
  const fieldMap = {
    logo_upload: { field: "logo", label: "Логотип" },
    signstamp_upload: { field: "signstamp", label: "Подпись+Печать" },
  };
  const { field, label } = fieldMap[mode] || fieldMap.logo_upload;

  try {
    await ctx.sendChatAction("typing");
    const file = await ctx.telegram.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;

    const response = await fetch(url);
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString("base64");
    const ext = file.file_path.endsWith(".png") ? "png" : "jpeg";
    const dataUri = `data:image/${ext};base64,${base64}`;

    const profile = await db.getProfile(uid);
    if (!profile?.name) {
      states.delete(uid);
      return ctx.reply("⚠️ Сначала заполните профиль — ⚙️ Профиль", mainKb);
    }
    profile[field] = dataUri;
    await db.saveProfile(uid, profile, ctx.from.username, ctx.from.first_name);

    states.delete(uid);
    ctx.reply(`✅ ${label} сохранён! Будет использоваться в документах.`, mainKb);
  } catch (err) {
    console.error(`${label} upload error:`, err.message);
    states.delete(uid);
    ctx.reply("⚠️ Ошибка загрузки. Попробуйте ещё раз.", mainKb);
  }
}

/** Скачать файл из Telegram → Buffer */
async function downloadTgFile(ctx, fileId) {
  const file = await ctx.telegram.getFile(fileId);
  const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
  const r = await fetch(url);
  return { buffer: Buffer.from(await r.arrayBuffer()), path: file.file_path };
}

/** Обработка распознанного текста — перенаправляем как текстовое сообщение */
async function processRecognizedText(ctx, text) {
  if (!text || text.trim().length < 3) {
    return ctx.reply("⚠️ Не удалось распознать. Попробуйте ещё раз.");
  }
  const fakeUpdate = {
    update_id: Date.now(),
    message: {
      message_id: ctx.message.message_id + 1,
      from: ctx.from,
      chat: ctx.chat,
      date: Math.floor(Date.now() / 1000),
      text: text,
    }
  };
  return bot.handleUpdate(fakeUpdate);
}

bot.on("photo", async (ctx) => {
  const uid = ctx.from.id;
  const st = states.get(uid);

  // Лого / Подпись+Печать
  if (st?.mode === "logo_upload" || st?.mode === "signstamp_upload") {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    return handleImageUpload(ctx, photo.file_id, st.mode);
  }

  // Если юзер в режиме — OCR и перенаправляем
  if (st?.mode) {
    ctx.reply("📷 Распознаю фото...");
    await ctx.sendChatAction("typing");
    try {
      const photo = ctx.message.photo[ctx.message.photo.length - 1];
      const { buffer, path } = await downloadTgFile(ctx, photo.file_id);
      const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
      const base64 = buffer.toString("base64");
      const text = await ai.recognizeImage(base64, mime);
      return processRecognizedText(ctx, text);
    } catch (err) {
      console.error("Photo OCR error:", err.message);
      return ctx.reply("⚠️ Не удалось распознать фото. Отправьте текстом.", cancelKb);
    }
  }

  // Если НЕ в режиме — OCR и сохраняем в контекст
  ctx.reply("📷 Распознаю фото...");
  await ctx.sendChatAction("typing");
  try {
    const photo = ctx.message.photo[ctx.message.photo.length - 1];
    const { buffer, path } = await downloadTgFile(ctx, photo.file_id);
    const mime = path.endsWith(".png") ? "image/png" : "image/jpeg";
    const base64 = buffer.toString("base64");
    const text = await ai.recognizeImage(base64, mime);
    if (!text || text.trim().length < 5) return ctx.reply("⚠️ Не удалось распознать текст на фото.", mainKb);

    // Сохраняем в контекст на 10 минут
    lastContext.set(uid, { text, ts: Date.now() });

    const lower = text.toLowerCase();
    if (lower.includes("бин") || lower.includes("иин") || lower.includes("иик") || lower.includes("бик") || lower.includes("бенефициар")) {
      states.set(uid, { mode: "profile_input" });
      return processRecognizedText(ctx, text);
    }

    const preview = text.length > 200 ? text.substring(0, 200) + "..." : text;
    return ctx.reply(`📷 Распознано и запомнено:\n${preview}\n\nТеперь выберите документ — данные подставятся.`, mainKb);
  } catch (err) {
    console.error("Photo OCR error:", err.message);
    return ctx.reply("⚠️ Не удалось распознать фото.", mainKb);
  }
});

bot.on("document", async (ctx) => {
  const uid = ctx.from.id;
  const st = states.get(uid);
  const doc = ctx.message.document;

  // Лого / Подпись+Печать
  if (st?.mode === "logo_upload" || st?.mode === "signstamp_upload") {
    if (!doc.mime_type?.startsWith("image/")) {
      return ctx.reply("⚠️ Отправьте картинку (PNG/JPG).", cancelKb);
    }
    return handleImageUpload(ctx, doc.file_id, st.mode);
  }

  // Фото как файл — распознаём
  if (st?.mode && doc.mime_type?.startsWith("image/")) {
    ctx.reply("📷 Распознаю изображение...");
    await ctx.sendChatAction("typing");
    try {
      const { buffer, path } = await downloadTgFile(ctx, doc.file_id);
      const base64 = buffer.toString("base64");
      const text = await ai.recognizeImage(base64, doc.mime_type);
      return processRecognizedText(ctx, text);
    } catch (err) {
      console.error("Doc OCR error:", err.message);
      return ctx.reply("⚠️ Не удалось распознать. Отправьте текстом.", cancelKb);
    }
  }
});

// ─── Голосовые сообщения ───
bot.on("voice", async (ctx) => {
  const uid = ctx.from.id;
  const st = states.get(uid);

  ctx.reply("🎤 Распознаю голос...");
  await ctx.sendChatAction("typing");
  try {
    const { buffer } = await downloadTgFile(ctx, ctx.message.voice.file_id);
    const text = await ai.transcribeAudio(buffer);
    if (!text || text.trim().length < 2) return ctx.reply("⚠️ Не удалось распознать. Попробуйте ещё раз.", mainKb);

    // Если юзер уже в режиме — просто перенаправляем текст
    if (st?.mode) return processRecognizedText(ctx, text);

    // Если НЕ в режиме — определяем намерение из голоса
    const lower = text.toLowerCase();

    // Определяем тип документа
    const intents = [
      { keys: ["кп", "коммерческ", "предложен"], type: "commercial", label: "📊 КП" },
      { keys: ["счёт", "счет", "оплат", "инвойс"], type: "invoice", label: "💰 Счёт" },
      { keys: ["акт", "выполнен", "оказан"], type: "act", label: "✅ Акт" },
      { keys: ["профил", "реквизит", "компан"], type: "profile", label: "⚙️ Профиль" },
    ];

    let matched = null;
    for (const intent of intents) {
      if (intent.keys.some(k => lower.includes(k))) { matched = intent; break; }
    }

    if (matched?.type === "profile") {
      // Убираем слова-команды, оставляем данные
      const cleanText = text.replace(/(заполни|создай|профиль|реквизиты|компани[яю]|мо[яю]|обнови)/gi, "").trim();
      if (cleanText.length > 10) {
        states.set(uid, { mode: "profile_input" });
        return processRecognizedText(ctx, cleanText);
      }
      states.set(uid, { mode: "profile_input" });
      return ctx.reply(`🎤 Понял — профиль.\n\n${PROFILE_PROMPT}`, cancelKb);
    }

    if (matched) {
      // Убираем слова-команды, оставляем данные
      const cmdWords = ["сделай", "создай", "выстав", "генер", "нужн", "хочу", "давай", "мне", "пожалуйста",
        "кп", "коммерческое", "предложение", "счёт", "счет", "акт", "на оплату", "выполненных",
        "для", "нужно", "надо", "можно", "пож"];
      let cleanText = text;
      cmdWords.forEach(w => { cleanText = cleanText.replace(new RegExp(w, "gi"), ""); });
      cleanText = cleanText.replace(/\s+/g, " ").trim();

      // Подтягиваем контекст из прошлого фото/голоса
      const ctxData = lastContext.get(uid);
      const hasCtx = ctxData && (Date.now() - ctxData.ts < 600000);
      if (hasCtx) {
        cleanText = ctxData.text + "\n" + cleanText;
        lastContext.delete(uid);
      }

      const p = await db.getProfile(uid);
      states.set(uid, { mode: "doc_input", docType: matched.type, hasProfile: !!(p?.name) });

      if (cleanText.length > 10) {
        ctx.reply(`🎤 Понял — ${matched.label}${hasCtx ? " (+ данные из фото)" : ""}`);
        return processRecognizedText(ctx, cleanText);
      }
      return ctx.reply(`🎤 Понял — ${matched.label}\n\nОтправьте данные:`, cancelKb);
    }

    // Не распознали намерение — сохраняем в контекст
    lastContext.set(uid, { text, ts: Date.now() });
    const preview = text.length > 100 ? text.substring(0, 100) + "..." : text;
    return ctx.reply(`🎤 Запомнил: "${preview}"\n\nВыберите тип документа — данные подставятся:`, mainKb);
  } catch (err) {
    console.error("Voice error:", err.message);
    return ctx.reply("⚠️ Не удалось распознать голос.", mainKb);
  }
});
bot.action("pf_confirm", async (ctx) => {
  ctx.answerCbQuery();
  const st = states.get(ctx.from.id);
  if (!st?.profileData) return;
  await db.saveProfile(ctx.from.id, st.profileData, ctx.from.username, ctx.from.first_name);
  states.delete(ctx.from.id);
  ctx.editMessageText("✅ Профиль сохранён!");
  ctx.reply("Теперь можете создавать документы!", mainKb);
});
bot.action("pf_retry", (ctx) => {
  ctx.answerCbQuery();
  states.set(ctx.from.id, { mode: "profile_input" });
  ctx.reply(PROFILE_PROMPT, cancelKb);
});

// ═══ ВЫБОР ТИПА ДОКУМЕНТА ═══

const DOC_TYPES = {
  "💰 Счёт": "invoice",
  "✅ Акт": "act",
  "📊 КП": "commercial",
};

for (const [btn, type] of Object.entries(DOC_TYPES)) {
  bot.hears(btn, async (ctx) => {
    const p = await db.getProfile(ctx.from.id);
    const hasProfile = p && p.name;

    states.set(ctx.from.id, { mode: "doc_input", docType: type, hasProfile });

    // Подсказка если нет профиля
    const noProfileHint = !hasProfile
        ? `\n\n💡 Совет: заполните /profile один раз — потом ваши реквизиты будут подставляться автоматически.`
        : "";

    // Для пользователей БЕЗ профиля — добавляем поля поставщика
    const sellerFields = !hasProfile
        ? `\n\nТакже укажите ваши данные (поставщик):\n— название, БИН, адрес, банк, ИИК`
        : "";

    const sellerExample = !hasProfile
        ? `\nПоставщик: ИП Моя компания 123456789012 Астана Каспи KZ00000S000000000000\n`
        : "";

    const prompts = {
      invoice: `📝 Данные для счёта на оплату:

Отправьте одним сообщением:${!hasProfile ? "\n1. Поставщик — ваша компания, БИН, адрес, банк, ИИК" : ""}
${!hasProfile ? "2" : "1"}. Покупатель — название, БИН, город
${!hasProfile ? "3" : "2"}. Договор — номер или "без"
${!hasProfile ? "4" : "3"}. Услуги — название количество ед цена
${!hasProfile ? "5" : "4"}. Дата — "сегодня" или конкретная

Пример:
${sellerExample}ТОО Партасан 594524901234 Алматы
без договора
подключение WhatsApp 2 усл 24000
подключение Instagram 2 усл 11000
сегодня${noProfileHint}`,

      act: `📝 Данные для акта выполненных работ:

Отправьте одним сообщением:${!hasProfile ? "\n1. Исполнитель — ваша компания, БИН, адрес" : ""}
${!hasProfile ? "2" : "1"}. Заказчик — название, БИН, город
${!hasProfile ? "3" : "2"}. Договор — номер или "без"
${!hasProfile ? "4" : "3"}. Работы — название количество ед цена
${!hasProfile ? "5" : "4"}. Дата — "сегодня" или конкретная

Пример:
${sellerExample}ТОО МедЦентр 171140037474 Актобе
без договора
настройка CRM системы 1 усл 500000
обучение персонала 2 усл 50000
сегодня${noProfileHint}`,

      contract: `📝 Данные для договора:

Отправьте одним сообщением:${!hasProfile ? "\n1. Исполнитель — ваша компания, БИН" : ""}
${!hasProfile ? "2" : "1"}. Заказчик — название, БИН, город
${!hasProfile ? "3" : "2"}. Предмет договора
${!hasProfile ? "4" : "3"}. Сумма
${!hasProfile ? "5" : "4"}. Срок выполнения

Пример:
${sellerExample}ТОО Заказчик 123456789012 Астана
разработка сайта и интеграция CRM
1500000
30 рабочих дней${noProfileHint}`,

      commercial: `📊 Коммерческое предложение:

Опишите одним сообщением:${!hasProfile ? "\n1. Моя компания — название, БИН, банк, ИИК" : ""}
${!hasProfile ? "2" : "1"}. Клиент — название
${!hasProfile ? "3" : "2"}. Что делаем
${!hasProfile ? "4" : "3"}. Работы с ценами
${!hasProfile ? "5" : "4"}. Сроки
${!hasProfile ? "6" : "5"}. Оплата (50/50, 30/30/40 и т.д.)

Пример:
${!hasProfile ? "Моя компания: ИП Моя Компания 123456789012 Каспи KZ00000S000000000000\n" : ""}ТОО ТехноСервис
Разработка сайта и CRM
1. Разработка сайта 180000
2. Настройка CRM 170000
итого 350000
срок 30 дней
оплата 50/50${noProfileHint}`,

      waybill: `📝 Данные для накладной:

Отправьте одним сообщением:${!hasProfile ? "\n1. Отправитель — ваша компания, БИН" : ""}
${!hasProfile ? "2" : "1"}. Получатель — название, БИН
${!hasProfile ? "3" : "2"}. Ответственный — ФИО
${!hasProfile ? "4" : "3"}. Товары — название количество ед цена
${!hasProfile ? "5" : "4"}. Договор — номер или "без"

Пример:
${sellerExample}ТОО Альфа Браво 901220351031 Павлодар
ответственный Иванов А.Б.
без договора
плёнка прозрачная 200 12 шт 7000
краска белая 5 л 15000${noProfileHint}`,
    };

    // Проверяем контекст — если юзер недавно отправил фото/голос
    const ctx_data = lastContext.get(ctx.from.id);
    const hasContext = ctx_data && (Date.now() - ctx_data.ts < 600000); // 10 минут

    if (hasContext) {
      lastContext.delete(ctx.from.id);
      ctx.reply(`📎 Использую данные из последнего сообщения...`);
      // Эмулируем текстовое сообщение
      const fakeUpdate = {
        update_id: Date.now(),
        message: {
          message_id: ctx.message.message_id + 1,
          from: ctx.from,
          chat: ctx.chat,
          date: Math.floor(Date.now() / 1000),
          text: ctx_data.text,
        }
      };
      return bot.handleUpdate(fakeUpdate);
    }

    ctx.reply(prompts[type] || "📝 Отправьте данные одним сообщением:", cancelKb);
  });
}

// ═══ ОБРАБОТКА ТЕКСТА ═══

bot.on("text", async (ctx) => {
  const uid = ctx.from.id;
  const text = ctx.message.text;

  if (text === "❌ Отмена") {
    states.delete(uid);
    return ctx.reply("❌ Отменено.", mainKb);
  }

  const st = states.get(uid);
  if (!st) return ctx.reply("Выберите действие кнопкой.", mainKb);

  // ─── Профиль: парсинг через AI ───
  if (st.mode === "profile_input") {
    await ctx.sendChatAction("typing");
    try {
      const parsed = await ai.parseProfile(text);
      if (!parsed) return ctx.reply("⚠️ Не удалось распознать. Попробуйте ещё раз.\n\n" + PROFILE_PROMPT, cancelKb);

      // Мержим с частичными данными если есть
      if (st.partialProfile) {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && v !== "") st.partialProfile[k] = v;
        }
        Object.assign(parsed, st.partialProfile);
      }

      // Дефолты
      if (!parsed.accountant) parsed.accountant = "-";
      if (!parsed.knp) parsed.knp = "859";
      if (!parsed.kbe && parsed.name) {
        parsed.kbe = /^ИП\b/i.test(parsed.name) ? "19" : "17";
      }

      // Capitalize имена
      if (parsed.name) parsed.name = capitalizeName(parsed.name);
      if (parsed.director) parsed.director = capitalizeName(parsed.director);
      if (parsed.accountant && parsed.accountant !== "-") parsed.accountant = capitalizeName(parsed.accountant);

      // Проверяем критичные поля
      const missing = [];
      if (!parsed.name) missing.push("Название компании (ИП/ТОО + название)");
      if (!parsed.bin) missing.push("ИИН/БИН (12 цифр)");
      if (!parsed.address) missing.push("Адрес");
      if (!parsed.bank) missing.push("Банк (например: каспи)");
      if (!parsed.iik) missing.push("ИИК (расчётный счёт, KZ...)");
      if (!parsed.director) missing.push("ФИО руководителя");

      let msg = `📋 Распознано:\n\n` + formatProfile(parsed);

      if (missing.length) {
        // Сохраняем что есть, просим только недостающее
        states.set(uid, { mode: "profile_fill_missing", partialProfile: parsed, missingFields: missing });
        msg += `\n\n⚠️ Не хватает:\n${missing.map(m => `  ❌ ${m}`).join("\n")}`;
        msg += `\n\nОтправьте: ${missing[0]}`;
        return ctx.reply(msg, cancelKb);
      }

      states.set(uid, { mode: "profile_confirm", profileData: parsed });
      ctx.reply(msg, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Сохранить", "pf_confirm"), Markup.button.callback("🔄 Заново", "pf_retry")],
      ]));
    } catch (err) {
      console.error("Profile parse error:", err.message);
      ctx.reply("⚠️ Ошибка. Попробуйте ещё раз.", cancelKb);
    }
    return;
  }

  // ─── Профиль: заполнение недостающих полей (без AI) ───
  if (st.mode === "profile_fill_missing") {
    const profile = st.partialProfile;
    const value = text.trim();

    // Пробуем заполнить ВСЕ недостающие поля из одного сообщения
    for (const field of st.missingFields) {
      if (field.includes("Название")) {
        // Ищем ИП/ТОО + название в тексте
        const nameMatch = value.match(/(ИП|ТОО|АО)\s+.+/i);
        if (nameMatch) {
          profile.name = capitalizeName(nameMatch[0].replace(/\b\d{12}\b/, "").trim());
          if (/^ИП\b/i.test(nameMatch[0])) profile.kbe = "19";
          else profile.kbe = "17";
        } else if (st.missingFields.length === 1) {
          // Если это единственное поле — берём весь текст
          profile.name = capitalizeName(value);
        }
      } else if (field.includes("ИИН/БИН")) {
        const binMatch = value.match(/\b\d{12}\b/);
        if (binMatch) profile.bin = binMatch[0];
        else if (st.missingFields.length === 1) profile.bin = value;
      } else if (field.includes("Адрес")) {
        const cities = ["Астана","Алматы","Шымкент","Караганда","Актобе","Актау","Атырау","Павлодар","Семей","Костанай","Тараз","Уральск"];
        for (const city of cities) {
          if (value.toLowerCase().includes(city.toLowerCase())) {
            // Берём город + всё что после него (улица итд)
            const idx = value.toLowerCase().indexOf(city.toLowerCase());
            profile.address = value.substring(idx).replace(/\b\d{12}\b/, "").trim() || city;
            break;
          }
        }
        if (!profile.address && st.missingFields.length === 1) profile.address = value;
      } else if (field.includes("Банк")) {
        const lower = value.toLowerCase();
        const banks = {
          "каспи": { bank: 'АО "Kaspi Bank"', bik: "CASPKZKA" },
          "kaspi": { bank: 'АО "Kaspi Bank"', bik: "CASPKZKA" },
          "халык": { bank: 'АО "Халык банк"', bik: "HSBKKZKX" },
          "форте": { bank: 'АО "ForteBank"', bik: "IRTYKZKA" },
          "жусан": { bank: 'АО "Jusan Bank"', bik: "TSABORGS" },
          "бцк": { bank: 'АО "Bank CenterCredit"', bik: "KCJBKZKX" },
        };
        for (const [key, val] of Object.entries(banks)) {
          if (lower.includes(key)) { profile.bank = val.bank; profile.bik = val.bik; break; }
        }
        if (!profile.bank && st.missingFields.length === 1) profile.bank = value;
      } else if (field.includes("ИИК")) {
        const iikMatch = value.match(/KZ\w{10,20}/i);
        if (iikMatch) profile.iik = iikMatch[0].toUpperCase();
        else if (st.missingFields.length === 1) profile.iik = value.toUpperCase();
      } else if (field.includes("руководителя")) {
        // Берём текст без БИН, без KZ..., без банков, без городов
        let director = value;
        director = director.replace(/\b\d{12}\b/g, "");
        director = director.replace(/\bKZ\w{10,20}\b/gi, "");
        const skipWords = ["каспи","kaspi","халык","форте","жусан","бцк","астана","алматы","шымкент","караганда","актобе"];
        skipWords.forEach(w => { director = director.replace(new RegExp(`\\b${w}\\b`, "gi"), ""); });
        director = director.replace(/\s+/g, " ").trim();
        if (director) profile.director = capitalizeName(director);
      }
    }

    // Проверяем снова
    const stillMissing = [];
    if (!profile.name) stillMissing.push("Название компании (ИП/ТОО + название)");
    if (!profile.bin) stillMissing.push("ИИН/БИН (12 цифр)");
    if (!profile.address) stillMissing.push("Адрес");
    if (!profile.bank) stillMissing.push("Банк (например: каспи)");
    if (!profile.iik) stillMissing.push("ИИК (расчётный счёт, KZ...)");
    if (!profile.director) stillMissing.push("ФИО руководителя");

    if (stillMissing.length) {
      states.set(uid, { mode: "profile_fill_missing", partialProfile: profile, missingFields: stillMissing });
      const hint = stillMissing.length > 1
          ? `\n\nМожно отправить всё сразу одним сообщением.`
          : "";
      return ctx.reply(`✅ Принято!\n\n⚠️ Ещё не хватает:\n${stillMissing.map(m => `  ❌ ${m}`).join("\n")}${hint}`, cancelKb);
    }

    // Всё заполнено
    const msg = `📋 Профиль готов:\n\n` + formatProfile(profile);
    states.set(uid, { mode: "profile_confirm", profileData: profile });
    return ctx.reply(msg, Markup.inlineKeyboard([
      [Markup.button.callback("✅ Сохранить", "pf_confirm"), Markup.button.callback("🔄 Заново", "pf_retry")],
    ]));
  }

  // ─── Профиль: свободное редактирование через AI ───
  if (st.mode === "profile_edit") {
    if (text.toLowerCase().includes("заново") || text.toLowerCase().includes("с нуля")) {
      states.set(uid, { mode: "profile_input" });
      return ctx.reply(PROFILE_PROMPT, cancelKb);
    }

    await ctx.sendChatAction("typing");
    try {
      const profile = await db.getProfile(uid);
      if (!profile?.name) {
        states.set(uid, { mode: "profile_input" });
        return ctx.reply("Профиль не найден. Заполните:\n\n" + PROFILE_PROMPT, cancelKb);
      }

      const changes = await ai.parseProfileEdit(profile, text);
      if (!changes) return ctx.reply("⚠️ Не понял что менять. Попробуйте написать конкретнее.", cancelKb);

      // Применяем изменения
      let updated = false;
      for (const [key, val] of Object.entries(changes)) {
        if (val && val !== "" && val !== profile[key]) {
          if (key === "name" || key === "director" || key === "accountant") {
            profile[key] = val === "-" ? "-" : capitalizeName(val);
          } else {
            profile[key] = val;
          }
          updated = true;
        }
      }

      if (!updated) return ctx.reply("Ничего не изменилось. Напишите что поменять:", cancelKb);

      await db.saveProfile(uid, profile, ctx.from.username, ctx.from.first_name);
      states.delete(uid);
      ctx.reply("✅ Обновлено!");
      return profileMenu(ctx);
    } catch (err) {
      console.error("Profile edit error:", err.message);
      return ctx.reply("⚠️ Ошибка. Попробуйте ещё раз.", cancelKb);
    }
  }

  // ─── КП: генерация через AI ───
  if (st.mode === "doc_input" && st.docType === "commercial") {
    await ctx.sendChatAction("typing");
    try {
      const profile = await db.getProfile(uid) || {};
      let textForAI = text;
      let sellerFromText = null;

      // Если нет профиля — ищем "Моя компания:" / "Поставщик:" / "Исполнитель:"
      if (!profile.name) {
        const lines = text.split("\n");
        const prefixIdx = lines.findIndex(l => /^(моя компания|поставщик|исполнитель)\s*:/i.test(l.trim()));
        if (prefixIdx !== -1) {
          const raw = lines[prefixIdx].replace(/^(моя компания|поставщик|исполнитель)\s*:\s*/i, "").trim();
          sellerFromText = parseSellerLine(raw);
          lines.splice(prefixIdx, 1);
          textForAI = lines.join("\n");
        }
      }

      const seller = (profile.name ? profile : null) || sellerFromText || {};

      ctx.reply("📊 Оформляю КП...");
      await ctx.sendChatAction("typing");

      const kpData = await ai.generateKP(textForAI, seller.name || "");
      if (!kpData) return ctx.reply("⚠️ Не удалось распознать. Попробуйте ещё раз.", cancelKb);

      // Проверяем есть ли условия оплаты
      const hasPayment = (kpData.paymentBullets && kpData.paymentBullets.length > 0) ||
          kpData.sections?.some(s =>
              s.heading?.toLowerCase().includes("оплат") || s.heading?.toLowerCase().includes("расчёт")
          );

      if (!hasPayment) {
        states.set(uid, { mode: "kp_payment", kpData, seller, textForAI });
        return ctx.reply(
            "💳 Укажите условия оплаты и график платежей:\n\n" +
            "Примеры:\n" +
            "• 50/50\n" +
            "• 30/30/40\n" +
            "• 100% предоплата\n" +
            "• 40% аванс, 30% после первого этапа, 30% по завершению",
            cancelKb
        );
      }

      const doc = {
        type: "commercial",
        title: "Коммерческое предложение",
        number: "",
        date: "",
        seller: seller,
        buyer: kpData.buyer || {},
        kpData: kpData,
        grandTotal: kpData.total || 0,
        totalWords: kpData.totalWords || "",
      };

      // Показываем черновик
      return showKPDraft(ctx, uid, doc, kpData, seller);

    } catch (err) {
      console.error("KP gen error:", err.message);
      if (err.status === 429) return ctx.reply("⏳ AI перегружен. 30 секунд.", cancelKb);
      return ctx.reply("⚠️ Ошибка генерации КП. Попробуйте ещё раз.", cancelKb);
    }
  }

  // ─── КП: заполнение условий оплаты ───
  if (st.mode === "kp_payment") {
    await ctx.sendChatAction("typing");
    try {
      const kpData = st.kpData;
      const total = kpData.total || 0;

      // Парсим условия оплаты из текста юзера
      const paymentText = text.trim();
      const parts = paymentText.match(/(\d+)/g);
      let bullets = [];

      if (parts && parts.length >= 2) {
        const labels = ["аванс при подписании договора", "промежуточный этап", "после завершения работ и подписания акта", "четвёртый этап"];
        const nums = parts.map(Number);
        const sum = nums.reduce((a, b) => a + b, 0);
        if (sum === 100 || sum <= parts.length) {
          // Проценты
          nums.forEach((pct, i) => {
            const amount = Math.round(total * pct / 100);
            bullets.push(`${pct}% — ${labels[i] || `этап ${i + 1}`}: ${amount.toLocaleString("ru")} ₸`);
          });
        }
      }

      if (!bullets.length) {
        bullets = [paymentText];
      }

      // Сохраняем условия оплаты
      kpData.paymentBullets = bullets;

      const doc = {
        type: "commercial",
        title: "Коммерческое предложение",
        number: "",
        date: "",
        seller: st.seller,
        buyer: kpData.buyer || {},
        kpData: kpData,
        grandTotal: total,
        totalWords: kpData.totalWords || "",
      };

      return showKPDraft(ctx, uid, doc, kpData, st.seller);
    } catch (err) {
      console.error("KP payment error:", err.message);
      return ctx.reply("⚠️ Ошибка. Напишите условия оплаты ещё раз:", cancelKb);
    }
  }

  // ─── Документ: парсинг через AI ───
  if (st.mode === "doc_input") {
    await ctx.sendChatAction("typing");
    try {
      const profile = await db.getProfile(uid);
      let textForAI = text;
      let sellerFromText = null;

      // Если нет профиля — определяем seller из текста БЕЗ AI
      if (!profile?.name) {
        const lines = text.split("\n");

        // Способ 1: ищем "Поставщик:" / "Исполнитель:"
        const prefixIdx = lines.findIndex(l => /^(поставщик|исполнитель|отправитель)\s*:/i.test(l.trim()));
        if (prefixIdx !== -1) {
          const raw = lines[prefixIdx].replace(/^(поставщик|исполнитель|отправитель)\s*:\s*/i, "").trim();
          sellerFromText = parseSellerLine(raw);
          lines.splice(prefixIdx, 1);
          textForAI = lines.join("\n");
        } else {
          // Способ 2: если 2+ строк с БИН (12 цифр) — первая = seller
          const linesWithBin = [];
          lines.forEach((l, i) => { if (/\b\d{12}\b/.test(l)) linesWithBin.push(i); });
          if (linesWithBin.length >= 2) {
            const sellerIdx = linesWithBin[0];
            sellerFromText = parseSellerLine(lines[sellerIdx].trim());
            lines.splice(sellerIdx, 1);
            textForAI = lines.join("\n");
          }
        }
      }

      const parsed = await ai.parseDocumentData(textForAI);
      if (!parsed) return ctx.reply("⚠️ Не удалось распознать. Попробуйте ещё раз.", cancelKb);

      const sellerData = (profile?.name ? profile : null) || sellerFromText || (parsed.seller?.name ? parsed.seller : null);
      const doc = buildDocument(st.docType, parsed, sellerData);

      // Проверяем ВСЕ поля
      const missing = checkMissingFields(doc, st.docType);

      if (missing.length) {
        // Сохраняем документ, переключаемся на режим заполнения без AI
        states.set(uid, { mode: "doc_fill_missing", docType: st.docType, document: doc, missingFields: missing });
        const fieldsList = missing.map(m => `  ❌ ${m}`).join("\n");
        const hint = missing[0].includes("Поставщик") || missing[0].includes("исполнитель")
            ? "\n\nНапишите в формате:\nПоставщик: Название БИН Город Банк ИИК"
            : missing[0].includes("Покупатель") || missing[0].includes("Заказчик") || missing[0].includes("Получатель") || missing[0].includes("Клиент")
                ? "\n\nНапишите название компании:"
                : missing[0].includes("ИИН/БИН")
                    ? "\n\nНапишите ИИН/БИН (12 цифр):"
                    : missing[0].includes("Адрес")
                        ? "\n\nНапишите адрес:\nПример: РК, г. Алматы, ул. Абая 1"
                        : missing[0].includes("Товары")
                            ? "\n\nНапишите товары/услуги:\nназвание количество ед цена"
                            : missing[0].includes("Цена")
                                ? "\n\nНапишите товары с ценами:\nназвание количество ед цена"
                                : missing[0].includes("Ответственный")
                                    ? "\n\nНапишите ФИО:"
                                    : missing[0].includes("Срок")
                                        ? "\n\nНапример: 30 рабочих дней"
                                        : "";
        return ctx.reply(
            `⚠️ Не хватает данных:\n${fieldsList}${hint}`,
            cancelKb
        );
      }

      // Всё заполнено

      // Для ДОГОВОРА — генерируем юридические разделы через AI
      if (st.docType === "contract" && (!doc.sections || !doc.sections.length)) {
        ctx.reply("📜 Генерирую текст договора...");
        await ctx.sendChatAction("typing");
        try {
          const sections = await ai.generateContractSections(
              doc.seller?.name || "",
              doc.buyer?.name || "",
              doc.items?.[0]?.name || "Оказание услуг",
              doc.grandTotal || 0,
              doc.deadline || "30 рабочих дней"
          );
          doc.sections = sections;
        } catch (err) {
          console.error("Contract sections error:", err.message);
          doc.sections = [
            { heading: "ПРЕДМЕТ ДОГОВОРА", content: doc.items?.[0]?.name || "Оказание услуг" },
          ];
        }
      }

      // Черновик
      const draft = formatDraft(doc);
      states.set(uid, { mode: "doc_confirm", document: doc, rawText: text, docType: st.docType });
      ctx.reply(draft, Markup.keyboard([["✅ Да", "✏️ Изменить", "❌ Отмена"]]).resize());

    } catch (err) {
      console.error("Doc parse error:", err.message);
      if (err.status === 429) ctx.reply("⏳ AI перегружен. 30 секунд.", cancelKb);
      else ctx.reply("⚠️ Ошибка парсинга. Попробуйте ещё раз.", cancelKb);
    }
    return;
  }

  // ─── Заполнение недостающих полей (БЕЗ AI) ───
  if (st.mode === "doc_fill_missing") {
    const doc = st.document;

    // Пробуем заполнить ВСЕ недостающие поля из одного сообщения
    for (const field of st.missingFields) {
      if (field.includes("Поставщик") || field.includes("исполнитель")) {
        const cleanText = text.replace(/^(поставщик|исполнитель|отправитель)\s*:\s*/i, "").trim();
        const parsed = parseSellerLine(cleanText);
        if (parsed) doc.seller = parsed;
        else doc.seller = { name: cleanText };
      } else if (field.includes("Покупатель") || field.includes("Заказчик") || field.includes("Получатель") || field.includes("Клиент")) {
        // Убираем БИН и город, оставляем название
        let name = text.replace(/\b\d{12}\b/, "").trim();
        const cities = ["астана","алматы","шымкент","караганда","актобе","актау","атырау","павлодар","семей","костанай","тараз","уральск"];
        cities.forEach(c => { name = name.replace(new RegExp(`\\b${c}\\b`, "gi"), ""); });
        name = name.replace(/\s+/g, " ").trim();
        if (name) { doc.buyer = doc.buyer || {}; doc.buyer.name = capitalizeName(name); }
      } else if (field.includes("ИИН/БИН")) {
        const binMatch = text.match(/\b\d{12}\b/);
        if (binMatch) { doc.buyer = doc.buyer || {}; doc.buyer.bin = binMatch[0]; }
      } else if (field.includes("Адрес") && !field.includes("Поставщик")) {
        // Ищем город в тексте
        const cities = ["Астана","Алматы","Шымкент","Караганда","Актобе","Актау","Атырау","Павлодар","Семей","Костанай","Тараз","Уральск","Петропавловск","Кызылорда"];
        let address = "";
        for (const city of cities) {
          if (text.toLowerCase().includes(city.toLowerCase())) { address = city; break; }
        }
        // Если город не найден, берём весь текст минус БИН
        if (!address) address = text.replace(/\b\d{12}\b/, "").trim();
        if (address) { doc.buyer = doc.buyer || {}; doc.buyer.address = address; }
      } else if (field.includes("Цена") || field.includes("Товары")) {
        await ctx.sendChatAction("typing");
        try {
          const parsed = await ai.parseDocumentData(text);
          if (parsed?.items?.length) {
            doc.items = parsed.items.map(i => ({
              name: i.name || doc.items?.[0]?.name || "", qty: i.qty || 1,
              unit: i.unit || doc.items?.[0]?.unit || "",
              price: i.price || 0, total: (i.qty || 1) * (i.price || 0),
            }));
            doc.grandTotal = doc.items.reduce((s, i) => s + i.total, 0);
            doc.totalWords = doc.grandTotal > 0 ? numberToWords(doc.grandTotal) : "";
          }
        } catch { /* оставляем */ }
      } else if (field.includes("Ответственный")) {
        doc.responsible = capitalizeName(text.replace(/\b\d{12}\b/, "").trim());
      } else if (field.includes("Срок")) {
        doc.deadline = text.trim();
      } else if (field.includes("Договор")) {
        doc.contract = text.trim().toLowerCase() === "без" ? "Без договора" : text.trim();
      }
    }

    // Проверяем снова
    const stillMissing = checkMissingFields(doc, st.docType);

    if (stillMissing.length) {
      states.set(uid, { mode: "doc_fill_missing", docType: st.docType, document: doc, missingFields: stillMissing });
      const fieldsList = stillMissing.map(m => `  ❌ ${m}`).join("\n");
      const hint = stillMissing[0].includes("Поставщик") || stillMissing[0].includes("исполнитель")
          ? "\n\nНапишите в формате:\nПоставщик: Название БИН Город Банк ИИК"
          : stillMissing[0].includes("Покупатель") || stillMissing[0].includes("Заказчик") || stillMissing[0].includes("Получатель") || stillMissing[0].includes("Клиент")
              ? "\n\nНапишите название компании:"
              : stillMissing[0].includes("ИИН/БИН")
                  ? "\n\nНапишите ИИН/БИН (12 цифр):"
                  : stillMissing[0].includes("Адрес")
                      ? "\n\nНапишите адрес:\nПример: РК, г. Алматы, ул. Абая 1"
                      : stillMissing[0].includes("Товары") || stillMissing[0].includes("Цена")
                          ? "\n\nНапишите товары:\nназвание количество ед цена"
                          : stillMissing[0].includes("Ответственный")
                              ? "\n\nНапишите ФИО:"
                              : stillMissing[0].includes("Срок")
                                  ? "\n\nНапример: 30 рабочих дней"
                                  : "";
      return ctx.reply(
          `⚠️ Ещё не хватает:\n${fieldsList}${hint}`,
          cancelKb
      );
    }

    // Всё заполнено — черновик
    const draft = formatDraft(doc);
    states.set(uid, { mode: "doc_confirm", document: doc, rawText: "", docType: st.docType });
    return ctx.reply(draft, Markup.keyboard([["✅ Да", "✏️ Изменить", "❌ Отмена"]]).resize());
  }

  // ─── Подтверждение черновика ───
  if (st.mode === "doc_confirm") {
    const lower = text.toLowerCase();
    if (lower === "да" || lower === "✅ да") {
      await sendFiles(ctx, st.document);
      // После отправки — спрашиваем "Всё верно?"
      states.set(uid, { mode: "post_review", document: st.document, rawText: st.rawText, docType: st.docType });
      return ctx.reply(
          "📎 Файл отправлен. Всё верно?",
          Markup.keyboard([["✅ Всё верно", "✏️ Изменить", "🔄 Заново"]]).resize()
      );
    }
    if (lower.includes("измен") || lower === "✏️ изменить") {
      states.set(uid, { mode: "doc_edit", document: st.document, docType: st.docType });
      return ctx.reply(
          "✏️ Напишите что изменить, например:\n\n" +
          "• покупатель ТОО Новая 123456789012 Алматы\n" +
          "• договор №25\n" +
          "• цену первой позиции 50000\n" +
          "• добавь: монтаж 1 усл 30000\n" +
          "• убери вторую позицию\n" +
          "• дата сегодня\n\n" +
          "Или «заново» чтобы ввести всё с нуля.",
          cancelKb
      );
    }
    states.delete(uid);
    return ctx.reply("❌ Отменено.", mainKb);
  }

  // ─── Ревью после отправки файла ───
  if (st.mode === "post_review") {
    const lower = text.toLowerCase();
    if (lower.includes("верно") || lower === "✅ всё верно" || lower === "да") {
      states.delete(uid);
      return ctx.reply("👍 Отлично! Ещё документ?", mainKb);
    }
    if (lower.includes("заново") || lower === "🔄 заново") {
      // Начать тот же тип документа заново
      states.set(uid, { mode: "doc_input", docType: st.docType });
      return ctx.reply("🔄 Отправьте данные заново:", cancelKb);
    }
    if (lower.includes("измен") || lower === "✏️ изменить") {
      states.set(uid, { mode: "doc_edit", document: st.document, docType: st.docType });
      return ctx.reply(
          "✏️ Напишите что изменить, например:\n\n" +
          "• покупатель ТОО Новая 123456789012\n" +
          "• цену первой 50000\n" +
          "• добавь: монтаж 1 усл 30000\n\n" +
          "Или «заново» чтобы ввести всё с нуля.",
          cancelKb
      );
    }
    states.delete(uid);
    return ctx.reply("👍 Ещё документ?", mainKb);
  }

  // ─── Редактирование документа через AI ───
  if (st.mode === "doc_edit") {
    if (text.toLowerCase().includes("заново") || text.toLowerCase().includes("с нуля")) {
      states.set(uid, { mode: "doc_input", docType: st.docType });
      return ctx.reply("🔄 Отправьте данные заново:", cancelKb);
    }

    await ctx.sendChatAction("typing");
    try {
      const doc = st.document;
      const changes = await ai.parseDocEdit(doc, text);
      if (!changes) return ctx.reply("⚠️ Не понял что менять. Попробуйте конкретнее:", cancelKb);

      // Применяем изменения
      if (changes.buyer) {
        doc.buyer = { ...doc.buyer, ...changes.buyer };
        if (doc.buyer.name) doc.buyer.name = capitalizeName(doc.buyer.name);
      }
      if (changes.contract !== null && changes.contract !== undefined) doc.contract = changes.contract;
      if (changes.responsible !== null && changes.responsible !== undefined) doc.responsible = capitalizeName(changes.responsible);
      if (changes.date_hint) {
        doc.date = changes.date_hint === "today" ? formatDate(new Date()) : changes.date_hint;
      }
      if (changes.items && Array.isArray(changes.items)) {
        doc.items = changes.items.map(i => ({
          name: i.name || "", qty: i.qty || 1, unit: i.unit || "",
          price: i.price || 0, total: (i.qty || 1) * (i.price || 0),
        }));
        doc.grandTotal = doc.items.reduce((s, i) => s + i.total, 0);
        doc.totalWords = doc.grandTotal > 0 ? numberToWords(doc.grandTotal) : "";
      }

      const draft = formatDraft(doc);
      states.set(uid, { mode: "doc_confirm", document: doc, rawText: "", docType: st.docType });
      return ctx.reply("✏️ Обновлено:\n\n" + draft, Markup.keyboard([["✅ Да", "✏️ Изменить", "❌ Отмена"]]).resize());
    } catch (err) {
      console.error("Doc edit error:", err.message);
      return ctx.reply("⚠️ Ошибка. Попробуйте ещё раз:", cancelKb);
    }
  }

  ctx.reply("Выберите действие.", mainKb);
});

// ═══ ХЕЛПЕРЫ ═══

/**
 * Capitalize ФИО и названия:
 * "иванов алмас" → "Иванов Алмас"
 * "ИВАНОВ АЛМАС" → "Иванов Алмас"
 * "Иванов Алмас" → "Иванов Алмас" (не трогаем)
 * "ТОО компания" → "ТОО Компания" (аббревиатуры сохраняем)
 */
function showKPDraft(ctx, uid, doc, kpData, seller) {
  const draftLines = [];
  draftLines.push(`📊 Коммерческое предложение`);
  draftLines.push(`📄 ${kpData.subtitle || ""}`);
  draftLines.push(``);
  if (seller?.name) draftLines.push(`🏢 Исполнитель: ${seller.name}`);
  if (kpData.buyer?.name) draftLines.push(`👤 Клиент: ${kpData.buyer.name}`);

  // 1. Работы
  if (kpData.items?.length) {
    draftLines.push(``);
    draftLines.push(`📦 1. Состав и стоимость работ:`);
    kpData.items.forEach((item, i) => {
      draftLines.push(`  ${i + 1}. ${item.name} — ${(item.price || 0).toLocaleString("ru")} ₸`);
    });
    draftLines.push(`💰 Итого: ${(kpData.total || 0).toLocaleString("ru")} KZT`);
    if (kpData.totalWords) draftLines.push(`💬 ${kpData.totalWords} тенге`);
  }

  // 2. Сроки
  if (kpData.deadline) {
    draftLines.push(``);
    draftLines.push(`📌 2. Сроки: ${kpData.deadline}`);
  }

  // 3. Оплата
  const payments = kpData.paymentBullets || [];
  if (payments.length) {
    draftLines.push(``);
    draftLines.push(`💳 3. Условия оплаты:`);
    payments.forEach(b => draftLines.push(`   • ${b}`));
  }

  // 4. Доп.условия
  const extras = kpData.extraBullets || [];
  if (extras.length) {
    draftLines.push(``);
    draftLines.push(`📎 4. Дополнительные условия:`);
    extras.forEach(b => draftLines.push(`   • ${b}`));
  }

  draftLines.push(``);
  draftLines.push(`─────────────────────`);
  draftLines.push(`✅ Да — сгенерировать PDF`);
  draftLines.push(`✏️ Изменить — отправить заново`);
  draftLines.push(`❌ Отмена`);

  states.set(uid, { mode: "doc_confirm", document: doc, rawText: "", docType: "commercial" });
  return ctx.reply(draftLines.join("\n"), Markup.keyboard([["✅ Да", "✏️ Изменить", "❌ Отмена"]]).resize());
}

/** Формат даты строго DD.MM.YYYY */
function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}`;
}

function capitalizeName(str) {
  if (!str) return str;
  const s = str.trim();
  // Если смешанный регистр — не трогаем (пользователь знает что делает)
  const isAllLower = s === s.toLowerCase();
  const isAllUpper = s === s.toUpperCase() && s.length > 3; // "ИП" не трогаем
  if (!isAllLower && !isAllUpper) return s;

  const abbrs = new Set(["ИП", "ТОО", "АО", "ОАО", "ЗАО", "НАО", "ПАО", "КХ", "РГП", "ГКП", "ЖШС"]);

  return s.split(/\s+/).map(word => {
    const upper = word.toUpperCase();
    if (abbrs.has(upper)) return upper;
    if (word.length <= 1) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(" ");
}

function formatProfile(p) {
  const lines = [];
  if (p.name) lines.push(`🏢 ${p.name}`);
  if (p.bin) lines.push(`📋 ИИН/БИН: ${p.bin}`);
  if (p.address) lines.push(`📍 ${p.address}`);
  if (p.bank) lines.push(`🏦 ${p.bank}`);
  if (p.iik) lines.push(`💳 ИИК: ${p.iik}`);
  if (p.bik) lines.push(`🔗 БИК: ${p.bik}`);
  if (p.kbe) lines.push(`📎 Кбе: ${p.kbe}`);
  if (p.knp) lines.push(`📎 КНП: ${p.knp}`);
  if (p.director) lines.push(`👤 Руководитель: ${p.director}`);
  if (p.accountant) lines.push(`👤 Бухгалтер: ${p.accountant}`);
  return lines.join("\n");
}

/**
 * Парсинг строки поставщика БЕЗ AI — чистый regex
 * "ИП Моя компания 123456789012 Астана Каспи KZ00000S000000000000"
 * → { name, bin, address, bank, iik, bik, kbe }
 */
function parseSellerLine(raw) {
  const result = { name: "", bin: "", address: "", bank: "", iik: "", bik: "", kbe: "", knp: "859" };

  // Извлекаем БИН (12 цифр)
  const binMatch = raw.match(/\b(\d{12})\b/);
  if (binMatch) result.bin = binMatch[1];

  // Извлекаем ИИК (KZ + символы)
  const iikMatch = raw.match(/\b(KZ\w{18,20})\b/i);
  if (iikMatch) result.iik = iikMatch[1].toUpperCase();

  // Банки
  const bankMap = {
    "каспи": { bank: 'АО "Kaspi Bank"', bik: "CASPKZKA" },
    "kaspi": { bank: 'АО "Kaspi Bank"', bik: "CASPKZKA" },
    "халык": { bank: 'АО "Халык банк"', bik: "HSBKKZKX" },
    "halyk": { bank: 'АО "Халык банк"', bik: "HSBKKZKX" },
    "форте": { bank: 'АО "ForteBank"', bik: "IRTYKZKA" },
    "forte": { bank: 'АО "ForteBank"', bik: "IRTYKZKA" },
    "жусан": { bank: 'АО "Jusan Bank"', bik: "TSABORGS" },
    "jusan": { bank: 'АО "Jusan Bank"', bik: "TSABORGS" },
    "центркредит": { bank: 'АО "Bank CenterCredit"', bik: "KCJBKZKX" },
    "бцк": { bank: 'АО "Bank CenterCredit"', bik: "KCJBKZKX" },
    "береке": { bank: 'АО "Береке банк"', bik: "SABRKZKA" },
    "евразийский": { bank: 'АО "Евразийский банк"', bik: "EUABORGS" },
  };

  const lower = raw.toLowerCase();
  for (const [key, val] of Object.entries(bankMap)) {
    if (lower.includes(key)) {
      result.bank = val.bank;
      result.bik = val.bik;
      break;
    }
  }

  // Города
  const cities = ["астана", "алматы", "шымкент", "караганда", "актобе", "актау", "атырау", "павлодар", "семей", "костанай", "тараз", "уральск", "петропавловск", "кызылорда", "кокшетау", "талдыкорган", "туркестан", "экибастуз", "темиртау"];
  for (const city of cities) {
    if (lower.includes(city)) {
      result.address = city.charAt(0).toUpperCase() + city.slice(1);
      break;
    }
  }

  // Определяем Кбе
  if (lower.includes("ип ") || lower.includes("ип\"") || lower.includes("индивидуальный")) result.kbe = "19";
  else if (lower.includes("тоо ") || lower.includes("тоо\"")) result.kbe = "17";
  else result.kbe = "19";

  // Название — убираем всё распознанное, оставляем текст
  let name = raw;
  if (binMatch) name = name.replace(binMatch[0], "");
  if (iikMatch) name = name.replace(iikMatch[0], "");
  // Убираем банк
  for (const key of Object.keys(bankMap)) {
    const re = new RegExp(key, "gi");
    name = name.replace(re, "");
  }
  // Убираем банк-слово
  name = name.replace(/\bбанк\b/gi, "");
  // Убираем город
  for (const city of cities) {
    const re = new RegExp(`\\b${city}\\b`, "gi");
    name = name.replace(re, "");
  }
  // Чистим
  name = name.replace(/\s+/g, " ").replace(/[,.\s]+$/, "").replace(/^[,.\s]+/, "").trim();
  if (name) result.name = capitalizeName(name);

  return result.name ? result : null;
}

function checkMissingFields(doc, docType) {
  const missing = [];
  const buyerLabel = { act: "Заказчик", contract: "Заказчик", waybill: "Получатель", commercial: "Клиент" }[docType] || "Покупатель";

  if (!doc.seller?.name)
    missing.push("Поставщик/исполнитель (ваша компания)");

  if (!doc.buyer?.name) missing.push(`${buyerLabel} (название компании)`);

  // БИН и адрес покупателя — обязательны для счёта, акта, накладной
  if (doc.buyer?.name) {
    if (!doc.buyer.bin && ["invoice", "act", "waybill"].includes(docType))
      missing.push(`ИИН/БИН ${buyerLabel.toLowerCase()}а`);
    if (!doc.buyer.address && ["invoice", "act"].includes(docType))
      missing.push(`Адрес ${buyerLabel.toLowerCase()}а`);
  }

  if (!doc.items?.length || doc.items.every(i => !i.name))
    missing.push("Товары/услуги (название, кол-во, цена)");
  else if (doc.items.some(i => !i.price || i.price === 0))
    missing.push("Цена товаров/услуг (у некоторых позиций цена 0)");

  if (docType === "waybill" && !doc.responsible)
    missing.push("Ответственный за поставку (ФИО)\nНапишите: ответственный Фамилия И.О.");

  if (docType === "contract" && !doc.deadline)
    missing.push("Срок выполнения\nНапример: 30 рабочих дней");

  return missing;
}

function buildDocument(type, parsed, profile) {
  const today = new Date();

  let dateStr;
  if (parsed.date_hint === "today" || !parsed.date_hint) {
    dateStr = formatDate(today);
  } else {
    dateStr = parsed.date_hint;
  }

  const titles = {
    invoice: "Счёт на оплату",
    act: "АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)",
    contract: "ДОГОВОР НА ОКАЗАНИЕ УСЛУГ",
    commercial: "Коммерческое предложение",
    waybill: "НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ",
  };

  const items = (parsed.items || []).map(i => ({
    name: i.name || "",
    qty: i.qty || 0,
    unit: i.unit || "",
    price: i.price || 0,
    total: (i.qty || 1) * (i.price || 0),
  }));

  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  const sigMap = {
    act: [{ role: "Сдал (Исполнитель)", name: profile?.director || "" }, { role: "Принял (Заказчик)", name: "" }],
    waybill: [{ role: "Отпустил", name: "" }, { role: "Получил", name: "" }],
    contract: [{ role: "Исполнитель", name: profile?.director || "" }, { role: "Заказчик", name: "" }],
  };

  return {
    type,
    title: titles[type] || "Документ",
    number: "",
    date: dateStr,
    seller: profile || parsed.seller || {},
    buyer: { name: capitalizeName(parsed.buyer?.name || ""), bin: parsed.buyer?.bin || "", address: parsed.buyer?.address || "" },
    contract: parsed.contract || "Без договора",
    responsible: capitalizeName(parsed.responsible || ""),
    deadline: parsed.deadline || "",
    items,
    grandTotal,
    totalWords: grandTotal > 0 ? numberToWords(grandTotal) : "",
    signatures: sigMap[type] || [
      { role: "Исполнитель", name: profile?.director || "" },
      { role: "Главный Бухгалтер", name: profile?.accountant || "" },
    ],
  };
}

function formatDraft(doc) {
  const lines = [];
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const type = doc.type || "invoice";

  // ─── Заголовок ───
  lines.push(`📄 ${doc.title}${doc.number ? ` № ${doc.number}` : ""}`);
  lines.push(`📅 ${doc.date || "—"}`);

  // ─── Стороны (компактно) ───
  const sellerLabel = (type === "act" || type === "contract") ? "Исполнитель" : "Поставщик";
  const buyerLabel = (type === "act" || type === "contract") ? "Заказчик" : (type === "waybill") ? "Получатель" : "Покупатель";

  lines.push(``);
  if (s.name) lines.push(`🏢 ${sellerLabel}: ${s.name}${s.bin ? ` (${s.bin})` : ""}`);
  lines.push(`👤 ${buyerLabel}: ${b.name || "—"}${b.bin ? ` (${b.bin})` : ""}${b.address ? `, ${b.address}` : ""}`);

  // ─── Договор ───
  lines.push(`📜 Договор: ${doc.contract || "Без договора"}`);

  // ─── Спец. поля ───
  if (type === "waybill" && doc.responsible) lines.push(`👷 Ответственный: ${doc.responsible}`);
  if (type === "contract" && doc.deadline) lines.push(`⏱ Срок: ${doc.deadline}`);

  // ─── Позиции ───
  if (doc.items?.length) {
    lines.push(``);
    lines.push(`📦 Позиции:`);
    doc.items.forEach((item, i) => {
      const qty = item.qty || 0;
      const unit = item.unit || "шт";
      const price = (item.price || 0).toLocaleString("ru");
      const total = (item.total || 0).toLocaleString("ru");
      lines.push(`  ${i + 1}. ${item.name || "—"} — ${qty} ${unit} × ${price} = ${total} ₸`);
    });
  }

  // ─── Итого ───
  lines.push(``);
  lines.push(`💰 Итого: ${(doc.grandTotal || 0).toLocaleString("ru")} KZT`);
  if (doc.totalWords) lines.push(`💬 ${doc.totalWords}`);

  // ─── Реквизиты поставщика (детально) ───
  if (s.bank || s.iik) {
    lines.push(``);
    lines.push(`🏦 Реквизиты:`);
    if (s.bank) lines.push(`   Банк: ${s.bank}${s.bik ? ` (БИК: ${s.bik})` : ""}`);
    if (s.iik) lines.push(`   ИИК: ${s.iik}`);
    if (s.kbe) lines.push(`   Кбе: ${s.kbe}${s.knp ? ` | КНП: ${s.knp}` : ""}`);
  }

  // ─── Подписи ───
  if (doc.signatures?.length) {
    lines.push(``);
    lines.push(`✍️ ${doc.signatures.map(sig => `${sig.role}${sig.name ? `: ${sig.name}` : ""}`).join("  |  ")}`);
  }

  lines.push(``);
  lines.push(`─────────────────────`);
  lines.push(`✅ Да — сгенерировать`);
  lines.push(`✏️ Изменить — поменять данные`);
  lines.push(`❌ Отмена`);

  return lines.join("\n");
}

async function sendFiles(ctx, docData) {
  const uid = ctx.from.id;
  await ctx.sendChatAction("upload_document");

  // Автонумерация
  if (!docData.number) {
    const nextNum = await db.getNextNumber(uid, docData.type || "invoice");
    docData.number = String(nextNum);
  }

  const settings = await db.getSettings(uid);
  const format = settings.format || "pdf";

  const caption = `📄 ${docData.title || "Документ"} ${docData.number ? `№${docData.number}` : ""} от ${docData.date || ""}`;

  try {
    if (format === "pdf" || format === "both") {
      const { filePath, fileName } = await generatePDF(docData);
      await ctx.replyWithDocument({ source: filePath, filename: fileName }, { caption });
      fs.unlink(filePath, () => {});
    }
    if (format === "excel" || format === "both") {
      const { filePath, fileName } = await generateExcel(docData);
      await ctx.replyWithDocument({ source: filePath, filename: fileName }, { caption: `${caption} (Excel)` });
      fs.unlink(filePath, () => {});
    }

    await db.saveDocument(uid, docData);
    console.log(`✅ ${docData.type} #${docData.number} → ${ctx.from.first_name} [${format}]`);
  } catch (err) {
    console.error("❌ Gen error:", err);
    ctx.reply("⚠️ Ошибка генерации файла.");
  }
}

// ═══ ЗАПУСК ═══

bot.catch((err) => console.error("Bot error:", err));
process.once("SIGINT", async () => { await closeBrowser(); await db.close(); bot.stop("SIGINT"); });
process.once("SIGTERM", async () => { await closeBrowser(); await db.close(); bot.stop("SIGTERM"); });

(async () => {
  // ─── Валидация env ───
  const required = ["TELEGRAM_BOT_TOKEN", "OPENAI_API_KEY", "DATABASE_URL"];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    console.error(`❌ Не заданы переменные окружения: ${missing.join(", ")}`);
    console.error("   Скопируйте .env.example в .env и заполните.");
    process.exit(1);
  }

  await db.init();
  await bot.launch();
  console.log(`🚀 DocAgent v5 | AI = только парсинг | PostgreSQL`);
})().catch(err => { console.error("❌", err); process.exit(1); });