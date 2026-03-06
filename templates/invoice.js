/**
 * Шаблон: Счёт на оплату — точный формат РК
 * Основан на официальном формате РК
 */

const { formatNum, escapeHtml } = require("./utils");

function invoiceTemplate(doc) {
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const items = doc.items || [];
  const total = doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);

  const rows = items.map((item, i) => `
    <tr>
      <td class="c bd">${i + 1}</td>
      <td class="c bd">${escapeHtml(item.code || "")}</td>
      <td class="bd" style="text-align:left;padding-left:8px;">${escapeHtml(item.name)}</td>
      <td class="c bd">${item.qty}</td>
      <td class="c bd">${escapeHtml(item.unit || "усл")}</td>
      <td class="r bd">${formatNum(item.price)}</td>
      <td class="r bd">${formatNum(item.total)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 12mm 15mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Times New Roman','DejaVu Serif',serif; font-size:11px; color:#000; padding:15px 25px; line-height:1.35; }
  .notice { font-size:8.5px; color:#222; text-align:justify; margin-bottom:12px; line-height:1.45; }
  table { border-collapse:collapse; }
  .bd { border:1px solid #000; padding:4px 6px; font-size:10px; }
  .c { text-align:center; }
  .r { text-align:right; }
  .b { font-weight:bold; }
  .title { font-size:14px; font-weight:bold; text-align:center; margin:16px 0 12px; }
  .info { font-size:10.5px; margin-bottom:3px; }
  .sig-row { display:flex; justify-content:space-between; margin-top:40px; }
  .sig-block b { font-size:11px; }
  .sig-line { border-bottom:1px solid #000; width:170px; margin:25px 0 3px; display:inline-block; }
  .sig-name { font-size:10px; font-style:italic; }
</style>
<body>

<div class="notice">
Внимание! Оплата данного счета означает согласие с условиями поставки товара. Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту прихода денег на р/с Поставщика, самовывозом, при наличии доверенности и документов удостоверяющих личность.
</div>

<!-- Банковские реквизиты -->
<table style="width:100%;margin-bottom:14px;">
  <tr>
    <td rowspan="2" class="bd" style="width:44%;vertical-align:top;padding:6px 8px;">
      <div style="font-size:8px;color:#555;margin-bottom:1px;">Образец платежного поручения</div>
      <b>Бенефициар:</b><br/>
      ${escapeHtml(s.name || "—")}<br/>
      ИИН/БИН: ${escapeHtml(s.bin || "—")}
    </td>
    <td class="bd c" style="width:36%;"><b>ИИК</b><br/>${escapeHtml(s.iik || "—")}</td>
    <td class="bd c" style="width:10%;"><b>Кбе</b><br/>${escapeHtml(s.kbe || "19")}</td>
  </tr>
  <tr>
    <td class="bd c"><b>Банк бенефициара:</b> ${escapeHtml(s.bank || "—")}<br/><b>БИК</b> ${escapeHtml(s.bik || "—")}</td>
    <td class="bd c" style="font-size:8px;"><b>Код назначения платежа</b><br/>${escapeHtml(s.knp || "859")}</td>
  </tr>
</table>

<div class="title">Счёт на оплату № ${escapeHtml(doc.number || "1")} от ${escapeHtml(doc.date || "—")}</div>

<div style="margin-bottom:12px;">
  <div class="info"><b>Поставщик:</b> ИИН/БИН ${escapeHtml(s.bin || "")}, ${escapeHtml(s.name || "")}${s.address ? `, ${escapeHtml(s.address)}` : ""}</div>
  <div class="info"><b>Покупатель:</b> ИИН/БИН ${escapeHtml(b.bin || "—")}, ${escapeHtml(b.name || "—")}${b.address ? `, ${escapeHtml(b.address)}` : ""}</div>
  <div class="info"><b>Договор:</b> ${escapeHtml(doc.contract || "Без договора")}</div>
</div>

<!-- Таблица товаров/услуг -->
<table style="width:100%;margin-bottom:6px;">
  <thead>
    <tr>
      <th class="bd b c" style="width:4%;">№</th>
      <th class="bd b c" style="width:7%;">Код</th>
      <th class="bd b c">Наименование</th>
      <th class="bd b c" style="width:7%;">Кол-во</th>
      <th class="bd b c" style="width:5%;">Ед.</th>
      <th class="bd b c" style="width:13%;">Цена</th>
      <th class="bd b c" style="width:13%;">Сумма</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<div style="text-align:right;font-weight:bold;font-size:11px;margin-bottom:10px;">Итого: ${formatNum(total)}</div>

<div style="font-size:10px;margin-bottom:6px;">
  Всего наименований ${items.length}, на сумму ${formatNum(total)} KZT
</div>
<div style="font-size:10.5px;font-weight:bold;margin-bottom:20px;">
  Всего к оплате: ${escapeHtml(doc.totalWords || "—")} тенге 00 тиын
</div>

<!-- Подписи -->
<div class="sig-row">
  ${(doc.signatures || [{role:"Исполнитель"},{role:"Главный Бухгалтер"}]).map(sig => `
  <div class="sig-block">
    <b>${escapeHtml(sig.role)}</b>
    <div class="sig-line"></div>
    <div class="sig-name">/${escapeHtml(sig.name || sig.role)}/</div>
  </div>`).join("")}
</div>

</body></html>`;
}

module.exports = invoiceTemplate;
