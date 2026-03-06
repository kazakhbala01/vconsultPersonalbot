/**
 * AI Service — ТОЛЬКО парсинг текста в JSON
 *
 * parseProfile()       — реквизиты компании (для /profile)
 * parseDocumentData()  — buyer + items + contract (seller парсится в коде)
 * generateContractSections() — разделы договора
 */

class AIService {
  constructor(apiKey, model) {
    this.apiKey = apiKey || process.env.OPENAI_API_KEY;
    this.model = model || "gpt-4o-mini";
    this.baseUrl = "https://api.openai.com/v1";
  }

  async _call(system, user, maxTokens = 800) {
    const r = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        max_tokens: maxTokens,
        temperature: 0.1,
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      const e = new Error(err.error?.message || `API ${r.status}`);
      e.status = r.status;
      throw e;
    }
    const data = await r.json();
    console.log(`📊 AI: ${data.usage?.total_tokens || 0} tok`);
    return data.choices?.[0]?.message?.content || "";
  }

  _extractJSON(text) {
    let c = text.trim();
    if (c.startsWith("```")) c = c.replace(/```\w*\s*/, "").replace(/```$/, "").trim();
    try { return JSON.parse(c); }
    catch { try { return JSON.parse(c.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]")); } catch { return null; } }
  }

  /** Распознавание аудио через OpenAI Whisper */
  async transcribeAudio(audioBuffer) {
    const apiKey = this.apiKey;

    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: "audio/ogg" }), "voice.ogg");
    formData.append("model", "whisper-1");
    formData.append("language", "ru");

    const r = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!r.ok) throw new Error(`Whisper API ${r.status}`);
    const data = await r.json();
    console.log(`🎤 Whisper: "${(data.text || "").substring(0, 50)}..."`);
    return data.text || "";
  }

  /** Распознавание текста с фото через OpenAI Vision */
  async recognizeImage(imageBase64, mimeType) {
    const apiKey = this.apiKey;

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: "text", text: "Извлеки ВЕСЬ текст с этого изображения. Верни только текст, без комментариев. Если это документ/реквизиты — сохрани структуру." }
          ]
        }],
        max_tokens: 1500,
      }),
    });
    if (!r.ok) throw new Error(`Vision API ${r.status}`);
    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || "";
    console.log(`📷 Vision: "${text.substring(0, 50)}..."`);
    return text;
  }

  /** Парсинг реквизитов компании — полный парсинг из любого формата */
  async parseProfile(text) {
    const r = await this._call(
        `Ты извлекаешь реквизиты казахстанской компании из текста. Текст может быть:
- Копипаста из документа, договора, счёта
- Свободный текст пользователя
- Данные через запятую или пробел в одну строку
- Скриншот с OCR (с ошибками)
- Смесь русского и казахского

Ответь ТОЛЬКО чистый JSON без маркдауна:
{"name":"","bin":"","address":"","bank":"","iik":"","bik":"","kbe":"","knp":"","director":"","accountant":""}

Правила извлечения:

НАЗВАНИЕ (name):
- ИП, ТОО, АО, ОАО, ЗАО, ГКП, РГП, КХ, ЖШС + название
- "ИП Верас" → "ИП Верас"
- "ТОО «Компания»" → "ТОО Компания" (убери кавычки)
- Может быть в кавычках, скобках, после слова "Бенефициар:", "Наименование:", "Компания:"

ИИН/БИН (bin):
- Ровно 12 цифр подряд
- Может быть после "БИН:", "ИИН:", "ИИН/БИН:", "BIN:"
- У ИП обычно ИИН (начинается с даты рождения), у ТОО — БИН

АДРЕС (address):
- Город, улица, дом
- "г. Астана", "Алматы", "РК, г. Караганда, ул. Мира 5"
- Может быть после "Адрес:", "Юр.адрес:", "Местонахождение:"

БАНК (bank):
- Полное название: АО "Kaspi Bank", АО "Халык банк", АО "ForteBank"
- Сокращения: каспи/kaspi → АО "Kaspi Bank"
- халык/halyk/народный → АО "Халык банк"  
- форте/forte → АО "ForteBank"
- жусан/jusan → АО "Jusan Bank"
- центркредит/бцк/bcc → АО "Bank CenterCredit"
- береке/bereke → АО "Береке банк"
- евразийский → АО "Евразийский банк"
- Может быть после "Банк:", "Банк бенефициара:", "Обслуживающий банк:"

ИИК (iik):
- Начинается с KZ + 18 символов (цифры и буквы), всего 20 символов
- Может быть после "ИИК:", "Р/с:", "Расчётный счёт:", "Счёт:"

БИК (bik):
- 8 латинских букв: CASPKZKA, HSBKKZKX, IRTYKZKA и т.д.
- Может быть после "БИК:", "BIC:", "SWIFT:"
- Если не указан но указан банк: каспи→CASPKZKA, халык→HSBKKZKX, форте→IRTYKZKA, жусан→TSABORGS, бцк→KCJBKZKX, береке→SABRKZKA

КБЕ (kbe):
- 2 цифры. ИП = 19, ТОО/АО = 17
- Может быть после "Кбе:", "КБе:", "KBE:"
- Если не указан: определи по типу компании (ИП→19, ТОО→17)

КНП (knp):
- 3 цифры, обычно 859
- Может быть после "КНП:", "Код назначения платежа:"
- Если не указан → "859"

ДИРЕКТОР (director):
- ФИО руководителя
- После "Директор:", "Руководитель:", "Глава:", "Подпись:", "Первый руководитель:"

БУХГАЛТЕР (accountant):
- ФИО бухгалтера
- После "Бухгалтер:", "Гл. бухгалтер:", "Главный бухгалтер:"
- Если не указан → "-"

ВАЖНО:
- Если поле не найдено и нет способа определить → пустая строка ""
- accountant если не найден → "-"
- НЕ придумывай данные которых нет в тексте
- БИН/ИИК проверяй формат: БИН=12 цифр, ИИК=KZ+18 символов
- Кавычки в JSON экранируй: \\"`,
        text, 800
    );
    return this._extractJSON(r);
  }

  /** Парсинг изменений профиля из свободного текста */
  async parseProfileEdit(currentProfile, userText) {
    const r = await this._call(
        `У пользователя есть профиль компании. Он хочет что-то изменить.
Текущий профиль: ${JSON.stringify(currentProfile)}

Пользователь написал что хочет изменить. Определи КАКИЕ ПОЛЯ он хочет изменить и верни ТОЛЬКО изменённые поля.
Ответь ТОЛЬКО JSON с изменёнными полями:
{"name":"","bin":"","address":"","bank":"","iik":"","bik":"","kbe":"","knp":"","director":"","accountant":""}

Оставь ПУСТУЮ СТРОКУ "" для полей которые НЕ меняются.
Заполни ТОЛЬКО те поля которые пользователь явно хочет изменить.

Примеры:
- "поменяй банк на каспи" → {"bank":"АО \\"Kaspi Bank\\"","bik":"CASPKZKA"} (остальные "")
- "адрес Астана ул Мира 5" → {"address":"г. Астана, ул. Мира 5"} (остальные "")
- "директор Иванов А.Б." → {"director":"Иванов А.Б."} (остальные "")
- "бин 123456789012" → {"bin":"123456789012"} (остальные "")
- "название ТОО Новая Компания" → {"name":"ТОО Новая Компания","kbe":"17"} (ТОО→kbe:17)
- "ИИК KZ123456789012345678" → {"iik":"KZ123456789012345678"} (остальные "")

Банки: каспи→АО "Kaspi Bank"/CASPKZKA, халык→АО "Халык банк"/HSBKKZKX, форте→АО "ForteBank"/IRTYKZKA
Если меняется банк — обнови и bik. Если меняется тип (ИП/ТОО) — обнови kbe.`,
        userText, 500
    );
    return this._extractJSON(r);
  }

  /**
   * Парсинг данных документа — buyer, items, contract, date, responsible, deadline
   * Seller НЕ парсим — приходит из профиля или parseSellerLine() в коде
   */
  async parseDocumentData(text) {
    const r = await this._call(
        `Извлеки данные документа из текста пользователя. Ответь ТОЛЬКО чистый JSON:
{"buyer":{"name":"","bin":"","address":""},"contract":"Без договора","items":[{"name":"","qty":1,"unit":"","price":0}],"date_hint":"","responsible":"","deadline":""}

ПОКУПАТЕЛЬ/ЗАКАЗЧИК (buyer):
- Компания: ТОО, ИП, АО, ГКП, РГП + название
- БИН/ИИН: 12 цифр, после "БИН:", "ИИН:" или просто рядом с названием
- Адрес/город: Астана, Алматы и т.д.

ДОГОВОР (contract):
- "без договора", "без", "нет" → "Без договора"
- "договор 15", "дог №15", "д/15" → "№ 15"
- "договор от 01.01.2026" → "от 01.01.2026"

ТОВАРЫ/УСЛУГИ (items):
- Каждая строка с названием и ценой = отдельный item
- Формат: "название количество единица цена" или "название цена"
- Количество (qty): число перед единицей. Не указано → 1
- Единица (unit): усл, шт, м, м2, кг, л, компл, мес, час, р/д. Не указано → ""
- Цена (price): число. "24000", "24 000" → 24000. "500тыс" → 500000. "1.5млн" → 1500000. "13 миллионов" → 13000000
- Строка БЕЗ числа/цены = НЕ товар (адрес, комментарий, дата)

ДАТА (date_hint):
- "сегодня" → "today"
- Любая дата → СТРОГО формат "DD.MM.YYYY" (например "12.02.2026", "01.03.2026")
- "12 февраля 2026" → "12.02.2026"
- "1 марта" → "01.03.2026" (текущий год)

ОТВЕТСТВЕННЫЙ (responsible):
- "ответственный Иванов А.Б." → "Иванов А.Б."
- Строка со словом "ответственный" = ФИО, НЕ товар

СРОК (deadline):
- "30 рабочих дней", "2 месяца", "до 15.03.2026" → deadline
- Строки со словами "рабочих дней", "календарных дней", "месяц", "срок" = deadline, НЕ товар

ВАЖНО:
- Не придумывай данные которых нет
- Не найдено → пустая строка ""
- price не указан → 0`,
        text, 1000
    );
    return this._extractJSON(r);
  }

  /** Генерация разделов договора */
  async generateContractSections(seller, buyer, subject, amount, deadline) {
    const r = await this._call(
        `Разделы договора на оказание услуг (РК). ТОЛЬКО JSON:
[{"heading":"ПРЕДМЕТ ДОГОВОРА","content":"..."},{"heading":"ОБЯЗАННОСТИ СТОРОН","content":"..."},{"heading":"СТОИМОСТЬ И ПОРЯДОК РАСЧЁТОВ","content":"..."},{"heading":"СРОКИ","content":"..."},{"heading":"ОТВЕТСТВЕННОСТЬ","content":"..."},{"heading":"РАЗРЕШЕНИЕ СПОРОВ","content":"..."},{"heading":"ПРОЧИЕ УСЛОВИЯ","content":"..."}]
Кратко, юридически грамотно, на русском.`,
        `${seller}→${buyer}|${subject}|${amount}KZT|${deadline}`,
        2000
    );
    const s = this._extractJSON(r);
    return Array.isArray(s) ? s : [{ heading: "ПРЕДМЕТ ДОГОВОРА", content: subject }];
  }

  /** Парсинг изменений документа из свободного текста */
  async parseDocEdit(currentDoc, userText) {
    const r = await this._call(
        `Пользователь хочет изменить данные документа. Текущий документ:
Покупатель: ${currentDoc.buyer?.name || "—"}, БИН: ${currentDoc.buyer?.bin || "—"}, Адрес: ${currentDoc.buyer?.address || "—"}
Договор: ${currentDoc.contract || "—"}
Товары: ${(currentDoc.items || []).map(i => `${i.name} ${i.qty} ${i.unit} ${i.price}`).join("; ")}
Дата: ${currentDoc.date || "—"}
Ответственный: ${currentDoc.responsible || "—"}

Пользователь написал что изменить. Верни ТОЛЬКО JSON с изменениями:
{"buyer":null,"contract":null,"items":null,"date_hint":null,"responsible":null}

null = не менять. Заполни ТОЛЬКО то что пользователь явно меняет.

Примеры:
- "покупатель ТОО Новый 123456789012 Алматы" → {"buyer":{"name":"ТОО Новый","bin":"123456789012","address":"Алматы"}}
- "договор №25" → {"contract":"№ 25"}
- "без договора" → {"contract":"Без договора"}
- "дата сегодня" → {"date_hint":"today"}
- "ответственный Петров К.М." → {"responsible":"Петров К.М."}
- "убери вторую позицию" → пересобери items без второй
- "поменяй цену первой на 50000" → обнови price первого item
- "добавь: монтаж 1 усл 30000" → добавь item в массив

Цены: "500тыс"→500000, "1.5млн"→1500000`,
        userText, 800
    );
    return this._extractJSON(r);
  }

  /**
   * Генерация коммерческого предложения
   * Из сырого текста пользователя → красивый структурированный КП
   */
  async generateKP(text, sellerName) {
    const r = await this._call(
        `Ты оформляешь коммерческое предложение от IT-компании. Из текста пользователя создай структурированное КП. ТОЛЬКО JSON:
{
  "buyer":{"name":"","bin":"","address":""},
  "subtitle":"по [описание проекта/услуги]",
  "total": 0,
  "totalWords":"",
  "items":[{"name":"описание работы","price":0}],
  "deadline":"текст про сроки",
  "paymentBullets":["30% — предоплата при подписании договора: X ₸","30% — промежуточный этап: X ₸","40% — после завершения работ: X ₸"],
  "extraBullets":[]
}

Правила:
- Извлеки покупателя/заказчика если указан (ТОО/ИП/ГКП + БИН)
- subtitle: краткое описание проекта ("по разработке сайта", "по доработке CRM")
- items: таблица работ с ценами. Каждая строка = отдельная работа
- total: итого сумма. "500тыс"→500000 "1.5млн"→1500000
- totalWords: сумма прописью на русском ("пятьсот тысяч","один миллион сто тысяч")
- deadline: текст про сроки, например "Срок выполнения работ составляет 4 месяца с момента подписания договора." Если юзер указал сроки — используй их, иначе напиши разумный срок
- paymentBullets: условия оплаты. Каждый пункт в формате "XX% — описание: СУММА ₸"
  * "50/50" → ["50% — предоплата при подписании договора: X ₸","50% — после завершения работ и подписания акта: X ₸"]
  * "30/30/40" → ["30% — предоплата при подписании договора: X ₸","30% — промежуточный этап: X ₸","40% — после завершения работ: X ₸"]
  * Если НЕ указаны → стандартно 50/50
  * Посчитай суммы каждого этапа от total
- extraBullets: доп.условия ТОЛЬКО если пользователь сам написал что-то про доп.условия (техподдержка, права на ПО и т.д.). Если ничего не написал — оставь ПУСТОЙ массив []
- Исполнитель: "${sellerName || "Компания"}" — НЕ включай в buyer
- Пиши профессионально, кратко, по-деловому`,
        text, 3000
    );
    return this._extractJSON(r);
  }
}

module.exports = AIService;