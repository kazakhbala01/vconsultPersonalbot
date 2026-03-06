/**
 * КП шаблон — стиль Veritas Consult
 * Хэдер + 3 секции (таблица, сроки, оплата) + опционально доп.условия + подпись
 */

const { formatNum, escapeHtml } = require("./utils");

/** Форматирует суммы в payment bullets: "1740000 ₸" → "₸1 740 000,00", "₸1740000" → "₸1 740 000,00" */
function formatPaymentBullet(text) {
    // "₸1740000" or "₸1 740 000" → "₸1 740 000,00"
    let result = text.replace(/₸\s*([\d][\d\s]*[\d])/g, (match, numStr) => {
        const num = Number(numStr.replace(/\s/g, ""));
        if (isNaN(num) || num === 0) return match;
        return "₸" + formatNum(num);
    });
    // "1740000 ₸" → "₸1 740 000,00"
    result = result.replace(/([\d][\d\s]*[\d])\s*₸/g, (match, numStr) => {
        const num = Number(numStr.replace(/\s/g, ""));
        if (isNaN(num) || num === 0) return match;
        return "₸" + formatNum(num);
    });
    return result;
}

function commercialTemplate(doc) {
    const s = doc.seller || {};
    const b = doc.buyer || {};
    const kp = doc.kpData || {};
    const items = kp.items || doc.items || [];
    const total = kp.total || doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);
    const totalWords = kp.totalWords || doc.totalWords || "";

    // ─── 1. Состав и стоимость работ (таблица) ───
    const tableHTML = items.length > 0 ? `
    <div class="section">
      <div class="sec-heading">1. Состав и стоимость работ</div>
      <table class="tbl">
        <thead><tr>
          <th class="th-blue" style="width:5%;">№</th>
          <th class="th-blue" style="padding-left:12px;text-align:left;">Наименование работ</th>
          <th class="th-blue" style="width:18%;">Сумма, ₸</th>
        </tr></thead>
        <tbody>${items.map((item, i) => `
          <tr class="${i % 2 === 0 ? 'row-white' : 'row-alt'}">
            <td class="td-body c">${i + 1}</td>
            <td class="td-body" style="padding:8px 12px;">${escapeHtml(item.name || item)}</td>
            <td class="td-body r" style="padding-right:12px;">${typeof item === "object" ? formatNum(item.price || item.total || 0) : ""}</td>
          </tr>`).join("")}
        </tbody>
      </table>
      <div class="total-line">
        Итого: ${formatNum(total)}${totalWords ? ` (${escapeHtml(totalWords)})` : ""} тенге.
      </div>
    </div>` : "";

    // ─── 2. Сроки выполнения работ ───
    const deadline = kp.deadline || "";
    const deadlineHTML = `
    <div class="section">
      <div class="sec-heading">2. Сроки выполнения работ</div>
      <div class="sec-text">${deadline ? escapeHtml(deadline) : "Срок выполнения работ согласовывается отдельно."}</div>
    </div>`;

    // ─── 3. Условия оплаты ───
    const paymentBullets = kp.paymentBullets || [];
    const fallbackPayment = (kp.sections || []).find(sec =>
        (sec.heading || "").toLowerCase().includes("оплат") || (sec.heading || "").toLowerCase().includes("расчёт")
    );
    const finalPaymentBullets = paymentBullets.length > 0
        ? paymentBullets
        : (fallbackPayment?.bullets || []);

    const paymentHTML = `
    <div class="section">
      <div class="sec-heading">3. Условия оплаты</div>
      ${finalPaymentBullets.length > 0
        ? `<ul class="bullets">${finalPaymentBullets.map(b => `<li>${formatPaymentBullet(escapeHtml(b))}</li>`).join("")}</ul>`
        : `<div class="sec-text">Условия оплаты согласовываются отдельно.</div>`
    }
    </div>`;

    // ─── 4. Дополнительные условия (только если есть) ───
    const extraBullets = kp.extraBullets || [];
    const fallbackExtra = (kp.sections || []).find(sec =>
        (sec.heading || "").toLowerCase().includes("дополнительн")
    );
    const finalExtraBullets = extraBullets.length > 0
        ? extraBullets
        : (fallbackExtra?.bullets || []);

    const extraHTML = finalExtraBullets.length > 0 ? `
    <div class="section">
      <div class="sec-heading">4. Дополнительные условия</div>
      <ul class="bullets">${finalExtraBullets.map(b => `<li>${escapeHtml(b)}</li>`).join("")}</ul>
    </div>` : "";

    // ─── Подпись + печать (как на фото: ФИО слева, печать накладывается на линию) ───
    const directorName = s.director || "";
    const signStampImg = s.signstamp
        ? `<img src="${s.signstamp}" class="signstamp-img" />`
        : "";

    const signatureBlock = `
    <div class="signature-section">
      <div class="sig-role">Руководитель</div>
      <div class="sig-bottom">
        <div class="sig-fio-wrap">
          <span class="sig-fio">${escapeHtml(directorName)}</span><span class="sig-line"></span>
        </div>
        <div class="sig-stamp-overlay">
          ${signStampImg}
        </div>
      </div>
    </div>`;

    return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 12mm 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'DejaVu Sans', 'Arial', sans-serif; font-size:11px; color:#1a1a1a; line-height:1.5; }

  /* header */
  .header {
    background: #1a2332;
    color: #fff;
    padding: 20px 28px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .logo-block {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .logo-icon {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #4a90d9, #357abd);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    font-weight: bold;
    color: white;
  }
  .logo-name {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .header-info {
    font-size: 9.5px;
    line-height: 1.6;
    text-align: right;
  }
  .header-info b { color: #a8c4e0; }
  .buyer-block {
    background: #f0f4f8;
    color: #1a2332;
    font-size: 10px;
    padding: 8px 14px;
    border-radius: 4px;
    max-width: 220px;
    line-height: 1.4;
  }

  /* content */
  .content { padding: 24px 32px; }

  .title {
    text-align: center;
    font-size: 22px;
    font-weight: 700;
    margin-bottom: 4px;
    color: #1a2332;
  }
  .subtitle {
    text-align: center;
    font-size: 12px;
    color: #555;
    margin-bottom: 28px;
    max-width: 80%;
    margin-left: auto;
    margin-right: auto;
  }

  /* sections */
  .section { margin-bottom: 22px; }
  .sec-heading {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 10px;
    color: #1a2332;
  }
  .sec-text {
    font-size: 11px;
    line-height: 1.6;
    margin-bottom: 6px;
  }
  .bullets {
    list-style: disc;
    padding-left: 28px;
    margin: 4px 0 8px;
  }
  .bullets li {
    font-size: 10.5px;
    line-height: 1.6;
    margin-bottom: 3px;
  }

  /* total */
  .total-line {
    margin: 12px 0 4px;
    font-size: 12px;
    font-weight: 700;
    color: #1a2332;
  }

  /* table blue */
  .tbl {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    margin: 8px 0 0;
    border-radius: 6px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(26,35,50,0.10);
  }
  .th-blue {
    background: #1a2332;
    color: #ffffff;
    font-weight: 600;
    font-size: 11px;
    padding: 11px 10px;
    text-align: center;
    border: none;
    letter-spacing: 0.3px;
  }
  .td-body {
    border-bottom: 1px solid #e2e8f0;
    padding: 8px 10px;
    font-size: 10.5px;
    color: #1a1a1a;
  }
  .row-white { background: #ffffff; }
  .row-alt { background: #f7f9fc; }
  .c { text-align: center; }
  .r { text-align: right; }

  /* ═══ Signature — matches reference photo ═══ */
  .signature-section {
    margin-top: 40px;
    position: relative;
  }
  .sig-role {
    font-size: 12px;
    font-weight: 400;
    color: #1a1a1a;
    margin-bottom: 80px;
  }
  .sig-bottom {
    position: relative;
  }
  .sig-fio-wrap {
    position: relative;
    display: flex;
    align-items: baseline;
    z-index: 2;
  }
  .sig-fio {
    font-size: 12px;
    font-weight: 700;
    color: #1a1a1a;
    white-space: nowrap;
  }
  .sig-line {
    display: inline-block;
    width: 200px;
    border-bottom: 1px solid #000;
    vertical-align: baseline;
  }
  .sig-stamp-overlay {
    position: absolute;
    bottom: -75px;
    left: 80px;
    z-index: 1;
  }
  .signstamp-img {
    width: 160px;
    height: 160px;
    object-fit: contain;
  }
</style>
<body>

<!-- HEADER -->
<div class="header">
  <div class="logo-block">
    ${s.logo
        ? `<img src="${s.logo}" style="width:50px;height:50px;border-radius:8px;object-fit:contain;" />`
        : `<div class="logo-icon">${(s.name || "K")[0].toUpperCase()}</div>`}
    <div>
      <div class="logo-name">${escapeHtml(s.name || "Компания")}</div>
    </div>
  </div>
  <div style="display:flex;align-items:center;gap:20px;">
    <div class="header-info">
      <b>${escapeHtml(s.name || "")}:</b><br/>
      ИИК: ${escapeHtml(s.iik || "")}<br/>
      Банк: ${escapeHtml(s.bank || "")}<br/>
      БИК: ${escapeHtml(s.bik || "")}<br/>
      ИИН: ${escapeHtml(s.bin || "")}<br/>
      КБЕ: ${escapeHtml(s.kbe || "")}
    </div>
    ${b.name ? `<div class="buyer-block"><b>${escapeHtml(b.name)}</b>${b.bin ? `<br/>ИИН/БИН: ${escapeHtml(b.bin)}` : ""}${b.address ? `<br/>${escapeHtml(b.address)}` : ""}</div>` : ""}
  </div>
</div>

<!-- CONTENT -->
<div class="content">

<div class="title">Коммерческое предложение</div>
<div class="subtitle">${escapeHtml(kp.subtitle || "")}</div>

${tableHTML}

${deadlineHTML}

${paymentHTML}

${extraHTML}

${signatureBlock}

</div>
</body></html>`;
}

module.exports = commercialTemplate;