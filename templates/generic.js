/**
 * Универсальный шаблон — договоры, КП, накладные и прочие документы
 */

const { formatNum, escapeHtml } = require("./utils");

function genericTemplate(doc) {
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const items = doc.items || [];
  const sections = doc.sections || [];
  const total = doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);

  const itemsHTML = items.length > 0 ? `
    <table style="width:100%;margin:14px 0 6px;">
      <thead><tr>
        <th class="bd b c" style="width:4%;">№</th>
        <th class="bd b c">Наименование</th>
        <th class="bd b c" style="width:7%;">Кол-во</th>
        <th class="bd b c" style="width:5%;">Ед.</th>
        <th class="bd b c" style="width:13%;">Цена</th>
        ${doc.type === "waybill" ? '<th class="bd b c" style="width:10%;">НДС</th>' : ""}
        <th class="bd b c" style="width:13%;">Сумма</th>
      </tr></thead>
      <tbody>${items.map((item, i) => `
        <tr>
          <td class="bd c">${i + 1}</td>
          <td class="bd" style="padding-left:6px;">${escapeHtml(item.name)}</td>
          <td class="bd c">${item.qty}</td>
          <td class="bd c">${escapeHtml(item.unit || "шт")}</td>
          <td class="bd r">${formatNum(item.price)}</td>
          ${doc.type === "waybill" ? `<td class="bd r">${formatNum(item.nds || 0)}</td>` : ""}
          <td class="bd r">${formatNum(item.total)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div style="text-align:right;font-weight:bold;font-size:11px;margin-bottom:8px;">
      Итого: ${formatNum(total)} KZT
    </div>
    ${doc.totalWords ? `<div style="font-size:10px;margin-bottom:12px;"><b>Всего к оплате:</b> ${escapeHtml(doc.totalWords)} тенге 00 тиын</div>` : ""}
  ` : "";

  const sectionsHTML = sections.map((s, i) => `
    <div style="margin-bottom:14px;">
      <div style="font-size:11px;font-weight:bold;margin-bottom:4px;text-align:center;">${i + 1}. ${escapeHtml(s.heading)}</div>
      <div style="font-size:10.5px;line-height:1.55;white-space:pre-wrap;text-align:justify;">${escapeHtml(s.content)}</div>
    </div>`).join("");

  // Блок реквизитов для договоров
  const requisitesHTML = doc.type === "contract" ? `
    <div style="display:flex;gap:20px;margin-top:20px;font-size:9.5px;">
      <div style="flex:1;border:1px solid #000;padding:10px;">
        <b>Исполнитель:</b><br/>
        ${escapeHtml(s.name || "")}<br/>
        ${s.bin ? `ИИН/БИН: ${escapeHtml(s.bin)}<br/>` : ""}
        ${s.address ? `${escapeHtml(s.address)}<br/>` : ""}
        ${s.bank ? `Банк: ${escapeHtml(s.bank)}<br/>` : ""}
        ${s.iik ? `ИИК: ${escapeHtml(s.iik)}<br/>` : ""}
        ${s.bik ? `БИК: ${escapeHtml(s.bik)}<br/>` : ""}
        ${s.kbe ? `Кбе: ${escapeHtml(s.kbe)}<br/>` : ""}
      </div>
      <div style="flex:1;border:1px solid #000;padding:10px;">
        <b>Заказчик:</b><br/>
        ${escapeHtml(b.name || "")}<br/>
        ${b.bin ? `ИИН/БИН: ${escapeHtml(b.bin)}<br/>` : ""}
        ${b.address ? `${escapeHtml(b.address)}<br/>` : ""}
        ${b.bank ? `Банк: ${escapeHtml(b.bank)}<br/>` : ""}
        ${b.iik ? `ИИК: ${escapeHtml(b.iik)}<br/>` : ""}
        ${b.bik ? `БИК: ${escapeHtml(b.bik)}<br/>` : ""}
        ${b.kbe ? `Кбе: ${escapeHtml(b.kbe)}<br/>` : ""}
      </div>
    </div>` : "";

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman','DejaVu Serif',serif; font-size:11px; color:#000; padding:20px 25px; line-height:1.4; }
  table { border-collapse:collapse; }
  .bd { border:1px solid #000; padding:4px 6px; font-size:10px; }
  .c { text-align:center; }
  .r { text-align:right; }
  .b { font-weight:bold; }
</style>
<body>

<div style="text-align:center;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #000;">
  <div style="font-size:15px;font-weight:bold;text-transform:uppercase;letter-spacing:0.5px;">
    ${escapeHtml(doc.title || "ДОКУМЕНТ")}
  </div>
  <div style="font-size:10.5px;color:#333;margin-top:4px;">
    ${doc.number ? `№ ${escapeHtml(doc.number)}` : ""} ${doc.date ? `от ${escapeHtml(doc.date)}` : ""}
  </div>
</div>

${s.name ? `<div style="font-size:10.5px;margin-bottom:4px;"><b>${doc.type === "contract" ? "Исполнитель" : "Поставщик"}:</b> ${escapeHtml(s.name)}${s.bin ? `, ИИН/БИН: ${escapeHtml(s.bin)}` : ""}${s.address ? `, ${escapeHtml(s.address)}` : ""}</div>` : ""}
${b.name ? `<div style="font-size:10.5px;margin-bottom:4px;"><b>${doc.type === "contract" ? "Заказчик" : "Покупатель"}:</b> ${escapeHtml(b.name)}${b.bin ? `, ИИН/БИН: ${escapeHtml(b.bin)}` : ""}${b.address ? `, ${escapeHtml(b.address)}` : ""}</div>` : ""}
${doc.contract ? `<div style="font-size:10.5px;margin-bottom:12px;"><b>Договор:</b> ${escapeHtml(doc.contract)}</div>` : ""}
${doc.responsible ? `<div style="font-size:10.5px;margin-bottom:12px;"><b>Ответственный:</b> ${escapeHtml(doc.responsible)}</div>` : ""}

${sectionsHTML}
${itemsHTML}
${requisitesHTML}

${doc.signatures ? `
<div style="display:flex;justify-content:space-between;margin-top:36px;padding-top:14px;border-top:1px solid #999;">
  ${doc.signatures.map(sig => `
  <div style="text-align:center;flex:1;">
    <b style="font-size:11px;">${escapeHtml(sig.role)}</b><br/>
    <div style="border-bottom:1px solid #000;width:150px;margin:25px auto 3px;"></div>
    <span style="font-size:9px;font-style:italic;">/${escapeHtml(sig.name || sig.role)}/</span>
  </div>`).join("")}
</div>` : ""}

${doc.footer ? `<div style="margin-top:20px;font-size:8.5px;color:#555;text-align:center;border-top:1px solid #ddd;padding-top:8px;">${escapeHtml(doc.footer)}</div>` : ""}

</body></html>`;
}

module.exports = genericTemplate;
