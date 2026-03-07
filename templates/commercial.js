/**
 * КП шаблон — стиль Veritas Consult (matches reference)
 */

const { formatNum, escapeHtml } = require("./utils");

/** ₸1740000 / 1740000 ₸ → ₸1 740 000 */
function formatPaymentBullet(text) {
    let r = text.replace(/₸\s*([\d][\d\s]*[\d])/g, (m, n) => {
        const num = Number(n.replace(/\s/g, ""));
        return isNaN(num) || num === 0 ? m : "₸" + formatNum(num);
    });
    r = r.replace(/([\d][\d\s]*[\d])\s*₸/g, (m, n) => {
        const num = Number(n.replace(/\s/g, ""));
        return isNaN(num) || num === 0 ? m : "₸" + formatNum(num);
    });
    return r;
}

function commercialTemplate(doc) {
    const s = doc.seller || {};
    const b = doc.buyer || {};
    const kp = doc.kpData || {};

    // Items
    let rawItems = kp.items || doc.items || [];
    const kpHasPrice = rawItems.some(i => (typeof i === "object" ? (i.price || i.total || 0) : 0) > 0);
    if (!kpHasPrice && doc.items?.length) rawItems = doc.items;
    const items = rawItems.filter(i => typeof i === "object" ? (i.name && i.name !== "описание работы") : !!i);
    const itemsTotal = items.reduce((sum, i) => sum + (typeof i === "object" ? (i.price || i.total || 0) : 0), 0);
    const total = itemsTotal > 0 ? itemsTotal : (kp.total || doc.grandTotal || 0);
    const totalWords = kp.totalWords || doc.totalWords || "";

    // 1. Таблица
    const tableHTML = items.length > 0 ? `
    <div class="section">
      <div class="sec-heading">1. Состав и стоимость работ</div>
      <table class="tbl">
        <thead><tr>
          <th class="th-blue" style="width:5%;">№</th>
          <th class="th-blue tbl-left">Наименование работ</th>
          <th class="th-blue" style="width:16%;">Сумма, ₸</th>
        </tr></thead>
        <tbody>${items.map((item, i) => `
          <tr class="${i % 2 === 0 ? 'row-w' : 'row-a'}">
            <td class="td-b c">${i + 1}</td>
            <td class="td-b tbl-left">${escapeHtml(item.name || item)}</td>
            <td class="td-b r">${typeof item === "object" ? formatNum(item.price || item.total || 0) : ""}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div class="total-line">Итого: ${formatNum(total)}${totalWords ? ` (${escapeHtml(totalWords)})` : ""} тенге.</div>
    </div>` : "";

    // 2. Сроки
    const deadline = kp.deadline || "";
    const deadlineHTML = `
    <div class="section">
      <div class="sec-heading">2. Сроки выполнения работ</div>
      <div class="sec-text">${deadline ? escapeHtml(deadline).replace(/(\d+\s*(?:месяц|дн|недел|рабочих)\S*)/gi, '<b>$1</b>') : "Срок выполнения работ согласовывается отдельно."}</div>
    </div>`;

    // 3. Оплата
    const payBullets = kp.paymentBullets || [];
    const fallPay = (kp.sections || []).find(sec => /оплат|расчёт/i.test(sec.heading || ""));
    const finalPay = payBullets.length > 0 ? payBullets : (fallPay?.bullets || []);
    const paymentHTML = `
    <div class="section">
      <div class="sec-heading">3. Условия оплаты</div>
      ${finalPay.length > 0
        ? `<ul class="bullets">${finalPay.map(b => `<li>${formatPaymentBullet(escapeHtml(b))}</li>`).join("")}</ul>`
        : `<div class="sec-text">Условия оплаты согласовываются отдельно.</div>`}
    </div>`;

    // 4. Доп.условия
    const extraB = kp.extraBullets || [];
    const fallExtra = (kp.sections || []).find(sec => /дополнительн/i.test(sec.heading || ""));
    const finalExtra = extraB.length > 0 ? extraB : (fallExtra?.bullets || []);
    const extraHTML = finalExtra.length > 0 ? `
    <div class="section">
      <div class="sec-heading">4. Дополнительные условия</div>
      <ul class="bullets">${finalExtra.map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>` : "";

    // Подпись
    let directorName = s.director || "";
    if (directorName.length > 60 || /\d{5,}/.test(directorName) || /\b(разработк|настройк|итого|срок|оплата|сайт|crm)\b/i.test(directorName)) directorName = "";
    const stampImg = s.signstamp ? `<img src="${s.signstamp}" class="signstamp-img" />` : "";

    const sigBlock = `
    <div class="sig-section">
      <div class="sig-role">Руководитель</div>
      <div class="sig-area">
        <div class="sig-stamp">${stampImg}</div>
        <div class="sig-fio-line">
          <span class="sig-fio">${escapeHtml(directorName)}</span><span class="sig-line"></span>
        </div>
      </div>
    </div>`;

    // Лого: если есть картинка — показываем её, если нет — иконка + название
    const logoHTML = s.logo
        ? `<div class="logo-wrap">
            <img src="${s.logo}" class="logo-img" />
           </div>`
        : `<div class="logo-wrap">
            <div class="logo-icon">${(s.name || "K")[0].toUpperCase()}</div>
           </div>`;

    // Buyer block
    const buyerHTML = b.name
        ? `<div class="buyer-block">
            <b>${escapeHtml(b.name)}</b>
            ${b.bin ? `<br/><b>ИИН/БИН:</b> ${escapeHtml(b.bin)}` : ""}
            ${b.address ? ` ${escapeHtml(b.address)}` : ""}
           </div>`
        : "";

    return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<style>
@page { size:A4; margin:12mm 15mm; }
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'DejaVu Sans','Arial',sans-serif;font-size:11px;color:#1a1a1a;line-height:1.5;}

/* ═══ HEADER ═══ */
.header{background:#1a2332;color:#fff;padding:18px 20px;display:flex;align-items:center;gap:16px;}
.logo-wrap{display:flex;flex-direction:column;align-items:center;min-width:100px;gap:6px;}
.logo-img{width:80px;height:80px;border-radius:8px;object-fit:contain;}
.logo-icon{width:120px;height:120px;background:linear-gradient(135deg,#4a90d9,#357abd);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:bold;color:#fff;}
.logo-txt{font-size:11px;font-weight:600;color:#fff;text-align:center;letter-spacing:.3px;white-space:nowrap;}
.hdr-center{flex:1;font-size:12px;line-height:1.65;padding:0 12px;}
.hdr-center b{color:#a8c4e0;}
.buyer-block{font-size:12px;line-height:1.65;text-align:left;border-left:1px solid rgba(255,255,255,.25);padding-left:14px;min-width:180px;}
.buyer-block b{color:#fff;}

/* ═══ CONTENT ═══ */
.content{padding:24px 22px;}
.title{text-align:center;font-size:22px;font-weight:700;margin-bottom:4px;color:#1a2332;}
.subtitle{text-align:center;font-size:12px;color:#555;margin-bottom:28px;max-width:85%;margin-left:auto;margin-right:auto;}

/* ═══ SECTIONS ═══ */
.section{margin-bottom:22px;}
.sec-heading{font-size:13px;font-weight:700;margin-bottom:10px;color:#1a2332;}
.sec-text{font-size:11px;line-height:1.6;margin-bottom:6px;}
.bullets{list-style:disc;padding-left:28px;margin:4px 0 8px;}
.bullets li{font-size:10.5px;line-height:1.6;margin-bottom:3px;}
.total-line{margin:12px 0 4px;font-size:12px;font-weight:700;color:#1a2332;}

/* ═══ TABLE ═══ */
.tbl{width:100%;border-collapse:separate;border-spacing:0;margin:8px 0 0;border-radius:6px;overflow:hidden;box-shadow:0 1px 4px rgba(26,35,50,.1);}
.th-blue{background:#1a2332;color:#fff;font-weight:600;font-size:11px;padding:11px 10px;text-align:center;border:none;}
.tbl-left{text-align:left;padding-left:14px;}
.td-b{border-bottom:1px solid #e2e8f0;padding:9px 10px;font-size:10.5px;color:#1a1a1a;}
.row-w{background:#fff;}
.row-a{background:#f7f9fc;}
.c{text-align:center;}
.r{text-align:right;padding-right:12px;}

/* ═══ SIGNATURE ═══ */
.sig-section{margin-top:40px;position:relative;}
.sig-role{font-size:12px;color:#1a1a1a;margin-bottom:0px;}
.sig-area{position:relative;height:60px;}
.sig-stamp{position:absolute;bottom:-140px;left:80px;z-index:1;}
.signstamp-img{width:68mm;height:68mm;object-fit:contain;}
.sig-fio-line{position:absolute;bottom:0;left:0;display:flex;align-items:baseline;z-index:2;}
.sig-fio{font-size:12px;font-weight:700;color:#1a1a1a;white-space:nowrap;}
.sig-line{display:inline-block;width:200px;border-bottom:1px solid #000;}
</style>
<body>

<div class="header">
  ${logoHTML}
  <div class="hdr-center">
    <b>${escapeHtml(s.name ? (s.name.includes("") ? s.name : `${s.name}`) : "")}</b><br/>
    ИИК: ${escapeHtml(s.iik || "")}<br/>
    Банк: ${escapeHtml(s.bank || "")}<br/>
    БИК: ${escapeHtml(s.bik || "")}<br/>
    ИИН: ${escapeHtml(s.bin || "")}<br/>
    КБЕ: ${escapeHtml(s.kbe || "")}
  </div>
  ${buyerHTML}
</div>

<div class="content">
  <div class="title">Коммерческое предложение</div>
  <div class="subtitle">${escapeHtml(kp.subtitle || "")}</div>
  ${tableHTML}
  ${deadlineHTML}
  ${paymentHTML}
  ${extraHTML}
  ${sigBlock}
</div>

</body></html>`;
}

module.exports = commercialTemplate;