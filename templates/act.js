/**
 * АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)
 * Приложение 50 к приказу Министра финансов РК от 20 декабря 2012 года № 562
 * Форма Р-1 — точная копия по XLS-образцу
 */

const { formatNum, escapeHtml } = require("./utils");

function actTemplate(doc) {
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const items = doc.items || [];
  const total = doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);

  const rows = items.map((item, i) => `
    <tr>
      <td class="bd c vt">${i + 1}</td>
      <td class="bd vt" style="padding:4px 6px;font-size:9px;">${escapeHtml(item.name)}</td>
      <td class="bd c vt">${escapeHtml(item.completionDate || "")}</td>
      <td class="bd c vt"></td>
      <td class="bd c vt">${escapeHtml(item.unit || "усл.")}</td>
      <td class="bd c vt">${item.qty}</td>
      <td class="bd r vt">${formatNum(item.price)}</td>
      <td class="bd r vt">${formatNum(item.total)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 8mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman','DejaVu Serif',serif; font-size:10px; color:#000; padding:8px 14px; line-height:1.25; }
  table { border-collapse:collapse; }
  .bd { border:1px solid #000; padding:3px 4px; font-size:9px; }
  .c { text-align:center; }
  .r { text-align:right; }
  .b { font-weight:bold; }
  .vt { vertical-align:top; }
  .small { font-size:7.5px; font-style:italic; }
</style>
<body>

<!-- ═══ Приложение 50 ═══ -->
<table style="width:100%;margin-bottom:4px;">
  <tr>
    <td style="width:70%;"></td>
    <td style="text-align:left;font-size:9px;line-height:1.4;padding:4px 8px;border:1px dashed #888;">
      Приложение 50<br/>
      к приказу Министра финансов<br/>
      Республики Казахстан<br/>
      от 20 декабря 2012 года № 562
    </td>
  </tr>
</table>

<div style="text-align:right;font-size:9px;margin-bottom:8px;">
  <span style="border:1px dashed #888;padding:1px 6px;">Форма Р-1</span>
</div>

<!-- ═══ Заказчик ═══ -->
<table style="width:100%;margin-bottom:0;">
  <tr>
    <td style="width:9%;font-size:10px;padding:4px 0;vertical-align:top;">Заказчик</td>
    <td style="width:60%;font-size:9.5px;padding:4px 4px;border-bottom:1px solid #000;vertical-align:top;">
      <b>${escapeHtml(b.name || "")}</b>${b.address ? `, ${escapeHtml(b.address)}` : ""}
    </td>
    <td style="width:11%;"></td>
    <td style="width:8%;font-size:8px;text-align:right;padding:0 4px;vertical-align:bottom;">ИИН/БИН</td>
    <td style="width:12%;font-size:11px;text-align:center;padding:4px;border:1px solid #000;vertical-align:middle;">
      <b>${escapeHtml(b.bin || "")}</b>
    </td>
  </tr>
  <tr>
    <td></td>
    <td style="padding:0 0 4px 0;">
      <span class="small">полное наименование, адрес, данные о средствах связи</span>
    </td>
    <td colspan="3"></td>
  </tr>
</table>

<!-- ═══ Исполнитель ═══ -->
<table style="width:100%;margin-bottom:0;">
  <tr>
    <td style="width:9%;font-size:10px;padding:4px 0;vertical-align:top;">Исполнитель</td>
    <td style="width:60%;font-size:9.5px;padding:4px 4px;border-bottom:1px solid #000;vertical-align:top;">
      <b>${escapeHtml(s.name || "")}</b>${s.address ? `, ${escapeHtml(s.address)}` : ""}
    </td>
    <td style="width:11%;"></td>
    <td style="width:8%;"></td>
    <td style="width:12%;font-size:11px;text-align:center;padding:4px;border:1px solid #000;vertical-align:middle;">
      <b>${escapeHtml(s.bin || "")}</b>
    </td>
  </tr>
  <tr>
    <td></td>
    <td style="padding:0 0 4px 0;">
      <span class="small">полное наименование, адрес, данные о средствах связи</span>
    </td>
    <td colspan="3"></td>
  </tr>
</table>

<!-- ═══ Договор + Номер + Дата ═══ -->
<table style="width:100%;margin-bottom:8px;">
  <tr>
    <td style="width:14%;font-size:9.5px;padding:3px 0;">Договор (контракт)</td>
    <td style="width:55%;font-size:10px;padding:3px 4px;border-bottom:1px solid #000;">
      ${escapeHtml(doc.contract || "Без договора")}
    </td>
    <td style="width:1%;"></td>
    <td class="bd c" style="width:12%;font-size:8px;"><b>Номер<br/>документа</b></td>
    <td class="bd c" style="width:18%;font-size:8px;"><b>Дата<br/>составления</b></td>
  </tr>
  <tr>
    <td colspan="3"></td>
    <td class="bd c" style="font-size:11px;"><b>${escapeHtml(doc.number || "1")}</b></td>
    <td class="bd c" style="font-size:11px;"><b>${escapeHtml(doc.date || "")}</b></td>
  </tr>
</table>

<!-- ═══ ЗАГОЛОВОК ═══ -->
<div style="font-size:13px;font-weight:bold;text-align:center;margin:6px 0 8px;">
  АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)
</div>

<!-- ═══ ТАБЛИЦА РАБОТ ═══ -->
<table style="width:100%;margin-bottom:4px;">
  <thead>
    <tr>
      <th class="bd c b" style="width:4%;font-size:7px;" rowspan="2">Номер<br/>по<br/>порядку</th>
      <th class="bd c b" style="width:21%;font-size:7px;" rowspan="2">Наименование работ (услуг)<br/>(в разрезе их подвидов в соответствии<br/>с технической спецификацией, заданием,<br/>графиком выполнения работ (услуг)<br/>при их наличии)</th>
      <th class="bd c b" style="width:8%;font-size:7px;" rowspan="2">Дата<br/>выполнения<br/>работ<br/>(оказания<br/>услуг)</th>
      <th class="bd c b" style="width:16%;font-size:7px;" rowspan="2">Сведения об отчете о научных<br/>исследованиях, маркетинговых,<br/>консультационных и прочих услугах<br/>(дата, номер, количество страниц)<br/>(при их наличии)</th>
      <th class="bd c b" style="width:6%;font-size:7px;" rowspan="2">Единица<br/>измерения</th>
      <th class="bd c b" style="font-size:8px;" colspan="3">Выполнено работ (оказано услуг)</th>
    </tr>
    <tr>
      <th class="bd c b" style="width:7%;font-size:7px;">количество</th>
      <th class="bd c b" style="width:12%;font-size:7px;">цена за единицу</th>
      <th class="bd c b" style="width:12%;font-size:7px;">стоимость</th>
    </tr>
    <!-- Номера столбцов -->
    <tr style="font-size:8px;">
      <td class="bd c">1</td>
      <td class="bd c">2</td>
      <td class="bd c">3</td>
      <td class="bd c">4</td>
      <td class="bd c">5</td>
      <td class="bd c">6</td>
      <td class="bd c">7</td>
      <td class="bd c">8</td>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <!-- Итого -->
    <tr>
      <td class="bd"></td>
      <td class="bd"></td>
      <td class="bd"></td>
      <td class="bd"></td>
      <td class="bd c"><b>Итого</b></td>
      <td class="bd c"></td>
      <td class="bd c">x</td>
      <td class="bd r"><b>${formatNum(total)}</b></td>
    </tr>
  </tbody>
</table>

<!-- Всего -->
<div style="font-size:9.5px;margin:6px 0 2px;">
  Всего наименований ${items.length}, на сумму ${formatNum(total)} KZT
</div>
<div style="font-size:10px;margin-bottom:3px;">
  <b>Всего оказано услуг на сумму (прописью):</b> ${escapeHtml(doc.totalWords || "—")} тенге 00 тиын
</div>

<!-- Сведения об использовании запасов -->
<div style="margin:10px 0 1px;font-size:9px;">
  Сведения об использовании запасов, полученных от заказчика
</div>
<div style="border-bottom:1px solid #000;margin-bottom:4px;height:14px;"></div>
<div style="text-align:right;font-size:7px;font-style:italic;margin-bottom:6px;">
  наименование, количество, стоимость
</div>

<!-- Приложение -->
<div style="font-size:8.5px;margin-bottom:1px;">
  Приложение: Перечень документации, в том числе отчет(ы) о маркетинговых, научных исследованиях, консультационных и прочих услугах (обязательны при его
</div>
<div style="font-size:8.5px;margin-bottom:10px;">
  (их) наличии) на _____________ страниц
</div>

<!-- ═══ ПОДПИСИ ═══ -->
<table style="width:100%;font-size:9.5px;">
  <tr>
    <td style="width:50%;vertical-align:top;padding-right:15px;">
      <div style="margin-bottom:6px;"><b>Сдал (Исполнитель)</b></div>
      <table style="width:100%;">
        <tr>
          <td style="padding:2px 0;font-size:9px;">Руководитель</td>
          <td style="text-align:center;font-size:9px;">/</td>
          <td style="border-bottom:1px solid #000;min-width:80px;"></td>
          <td style="text-align:center;font-size:9px;">/</td>
          <td style="border-bottom:1px solid #000;min-width:100px;text-align:center;font-size:9px;">
            ${escapeHtml((doc.signatures && doc.signatures[0] && doc.signatures[0].name) || "")}
          </td>
        </tr>
        <tr>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">должность</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">подпись</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">расшифровка подписи</td>
        </tr>
      </table>
      <div style="margin-top:12px;font-size:10px;"><b>М.П.</b></div>
    </td>
    <td style="width:50%;vertical-align:top;padding-left:15px;">
      <div style="margin-bottom:6px;"><b>Принял (Заказчик)</b></div>
      <table style="width:100%;">
        <tr>
          <td style="border-bottom:1px solid #000;min-width:80px;"></td>
          <td style="text-align:center;font-size:9px;">/</td>
          <td style="border-bottom:1px solid #000;min-width:80px;"></td>
          <td style="text-align:center;font-size:9px;">/</td>
          <td style="border-bottom:1px solid #000;min-width:100px;"></td>
        </tr>
        <tr>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">должность</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">подпись</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">расшифровка подписи</td>
        </tr>
      </table>
      <div style="margin-top:10px;font-size:8.5px;">
        Дата подписания (принятия) работ (услуг) &nbsp;
        <span style="border-bottom:1px solid #000;display:inline-block;min-width:80px;text-align:center;font-size:9.5px;">
          ${escapeHtml(doc.date || "")}
        </span>
      </div>
      <div style="margin-top:12px;font-size:10px;"><b>М.П.</b></div>
    </td>
  </tr>
</table>

</body></html>`;
}

module.exports = actTemplate;
