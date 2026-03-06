/**
 * НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ
 * Приложение 26 к приказу Министра финансов РК от 20 декабря 2012 года № 562
 * Форма З-2
 */

const { formatNum, escapeHtml } = require("./utils");

function waybillTemplate(doc) {
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const items = doc.items || [];
  const total = doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalQty = items.reduce((sum, i) => sum + (i.qty || 0), 0);

  const rows = items.map((item, i) => `
    <tr>
      <td class="bd c">${i + 1}</td>
      <td class="bd" style="padding:4px 6px;">${escapeHtml(item.name)}</td>
      <td class="bd c" style="font-size:8px;">${escapeHtml(item.code || "")}</td>
      <td class="bd c">${escapeHtml(item.unit || "шт")}</td>
      <td class="bd c">${item.qty}</td>
      <td class="bd c">${item.qty}</td>
      <td class="bd r">${formatNum(item.price)}</td>
      <td class="bd r">${formatNum(item.total)}</td>
      <td class="bd r">${formatNum(item.nds || 0)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/>
<style>
  @page { size: A4 landscape; margin: 8mm 10mm; }
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Times New Roman','DejaVu Serif',serif; font-size:9.5px; color:#000; padding:8px 14px; line-height:1.25; }
  table { border-collapse:collapse; }
  .bd { border:1px solid #000; padding:3px 5px; font-size:9px; }
  .c { text-align:center; }
  .r { text-align:right; }
  .b { font-weight:bold; }
  .small { font-size:7px; font-style:italic; }
  .uline { border-bottom:1px solid #000; display:inline-block; min-width:100px; }
</style>
<body>

<!-- ═══ Приложение 26 ═══ -->
<table style="width:100%;margin-bottom:4px;">
  <tr>
    <td style="width:70%;"></td>
    <td style="text-align:left;font-size:9px;line-height:1.4;padding:4px 8px;border:1px dashed #888;">
      Приложение 26<br/>
      к приказу Министра финансов<br/>
      Республики Казахстан<br/>
      от 20 декабря 2012 года № 562
    </td>
  </tr>
</table>

<div style="text-align:right;font-size:9px;margin-bottom:8px;">
  <span style="border:1px dashed #888;padding:1px 6px;">Форма З-2</span>
</div>

<!-- ═══ Организация + ИИН/БИН ═══ -->
<table style="width:100%;margin-bottom:4px;">
  <tr>
    <td style="width:28%;font-size:9px;padding:3px 0;">Организация (индивидуальный предприниматель)</td>
    <td style="width:42%;font-size:10px;padding:3px 4px;border-bottom:1px solid #000;">
      <b>${escapeHtml(s.name || "")}</b>
    </td>
    <td style="width:10%;font-size:9px;text-align:right;padding:3px 4px;">ИИН/БИН</td>
    <td style="width:15%;font-size:11px;text-align:center;padding:4px;border:1px solid #000;">
      <b>${escapeHtml(s.bin || "")}</b>
    </td>
  </tr>
</table>

<!-- Номер + Дата -->
<table style="width:100%;margin-bottom:8px;">
  <tr>
    <td style="width:70%;"></td>
    <td class="bd c" style="width:12%;font-size:8px;"><b>Номер<br/>документа</b></td>
    <td class="bd c" style="width:18%;font-size:8px;"><b>Дата<br/>составления</b></td>
  </tr>
  <tr>
    <td></td>
    <td class="bd c" style="font-size:11px;"><b>${escapeHtml(doc.number || "")}</b></td>
    <td class="bd c" style="font-size:11px;"><b>${escapeHtml(doc.date || "")}</b></td>
  </tr>
</table>

<!-- ═══ ЗАГОЛОВОК ═══ -->
<div style="font-size:13px;font-weight:bold;text-align:center;margin:4px 0 8px;">
  НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ
</div>

<!-- ═══ Стороны ═══ -->
<table style="width:100%;margin-bottom:6px;">
  <tr>
    <th class="bd c b" style="width:20%;font-size:7.5px;">Организация (индивидуальный предприниматель) - отправитель</th>
    <th class="bd c b" style="width:20%;font-size:7.5px;">Организация (индивидуальный предприниматель) - получатель</th>
    <th class="bd c b" style="width:18%;font-size:7.5px;">Ответственный за поставку (Ф.И.О.)</th>
    <th class="bd c b" style="width:18%;font-size:7.5px;">Транспортная организация</th>
    <th class="bd c b" style="width:18%;font-size:7.5px;">Товарно-транспортная накладная (номер, дата)</th>
  </tr>
  <tr>
    <td class="bd c" style="font-size:9px;">${escapeHtml(s.name || "")}</td>
    <td class="bd c" style="font-size:9px;">${escapeHtml(b.name || "")}</td>
    <td class="bd c" style="font-size:9px;">${escapeHtml(doc.responsible || s.director || "")}</td>
    <td class="bd c" style="font-size:9px;"></td>
    <td class="bd c" style="font-size:9px;"></td>
  </tr>
</table>

<!-- ═══ ТАБЛИЦА ТОВАРОВ ═══ -->
<table style="width:100%;margin-bottom:4px;">
  <thead>
    <tr>
      <th class="bd c b" style="width:4%;font-size:7px;" rowspan="2">Номер<br/>по<br/>порядку</th>
      <th class="bd c b" style="width:22%;font-size:7.5px;" rowspan="2">Наименование, характеристика</th>
      <th class="bd c b" style="width:9%;font-size:7px;" rowspan="2">Номенкла-<br/>турный номер</th>
      <th class="bd c b" style="width:6%;font-size:7px;" rowspan="2">Единица<br/>измерения</th>
      <th class="bd c b" style="font-size:7.5px;" colspan="2">Количество</th>
      <th class="bd c b" style="width:11%;font-size:7px;" rowspan="2">Цена за единицу, в KZT</th>
      <th class="bd c b" style="width:12%;font-size:7px;" rowspan="2">Сумма с НДС, в KZT</th>
      <th class="bd c b" style="width:10%;font-size:7px;" rowspan="2">Сумма НДС, в KZT</th>
    </tr>
    <tr>
      <th class="bd c b" style="width:8%;font-size:7px;">подлежит отпуску</th>
      <th class="bd c b" style="width:8%;font-size:7px;">отпущено</th>
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
      <td class="bd c">9</td>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <!-- Итого -->
    <tr>
      <td class="bd"></td>
      <td class="bd"></td>
      <td class="bd"></td>
      <td class="bd c"><b>Итого</b></td>
      <td class="bd c"><b>${totalQty}</b></td>
      <td class="bd c"><b>${totalQty}</b></td>
      <td class="bd c">x</td>
      <td class="bd r"><b>${formatNum(total)}</b></td>
      <td class="bd r"></td>
    </tr>
  </tbody>
</table>

<!-- Всего -->
<table style="width:100%;margin:6px 0 10px;">
  <tr>
    <td style="font-size:9px;width:30%;">Всего отпущено количество запасов (прописью)</td>
    <td style="font-size:9px;width:15%;border-bottom:1px solid #000;text-align:center;font-style:italic;">
      ${escapeHtml(doc.qtyWords || "")}
    </td>
    <td style="font-size:9px;width:18%;text-align:right;">на сумму (прописью), в KZT</td>
    <td style="font-size:9px;width:37%;border-bottom:1px solid #000;font-style:italic;">
      ${escapeHtml(doc.totalWords || "")} 00 тиын
    </td>
  </tr>
</table>

<!-- ═══ ПОДПИСИ ═══ -->
<table style="width:100%;font-size:9px;margin-bottom:6px;">
  <tr>
    <td style="width:50%;vertical-align:top;">
      <!-- Отпуск разрешил -->
      <table style="width:100%;">
        <tr>
          <td style="padding:2px 0;">Отпуск разрешил</td>
          <td style="border-bottom:1px solid #000;width:18%;"></td>
          <td style="text-align:center;">/</td>
          <td style="border-bottom:1px solid #000;width:18%;"></td>
          <td style="text-align:center;">/</td>
          <td style="border-bottom:1px solid #000;width:25%;text-align:center;">
            ${escapeHtml(doc.responsible || s.director || "")}
          </td>
        </tr>
        <tr>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">должность</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">подпись</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">расшифровка подписи</td>
        </tr>
      </table>
    </td>
    <td style="width:50%;vertical-align:top;">
      <!-- По доверенности -->
      <div style="margin-bottom:4px;">
        По доверенности &nbsp; №<span class="uline" style="min-width:60px;"></span>
        от " <span class="uline" style="min-width:30px;"></span> "
        <span class="uline" style="min-width:80px;"></span>
        20<span class="uline" style="min-width:20px;"></span> года
      </div>
      <div>
        выданной <span class="uline" style="min-width:250px;"></span>
      </div>
    </td>
  </tr>
</table>

<!-- Главный бухгалтер -->
<table style="width:60%;font-size:9px;margin-bottom:8px;">
  <tr>
    <td style="padding:2px 0;">Главный бухгалтер</td>
    <td style="text-align:center;">/</td>
    <td style="border-bottom:1px solid #000;width:25%;"></td>
    <td style="text-align:center;">/</td>
    <td style="border-bottom:1px solid #000;width:30%;text-align:center;">
      ${escapeHtml(s.accountant && s.accountant !== "-" ? s.accountant : "Не предусмотрен")}
    </td>
  </tr>
  <tr>
    <td></td>
    <td></td>
    <td style="font-size:6.5px;font-style:italic;text-align:center;">подпись</td>
    <td></td>
    <td style="font-size:6.5px;font-style:italic;text-align:center;">расшифровка подписи</td>
  </tr>
</table>

<div style="font-size:10px;font-weight:bold;margin-bottom:10px;">М.П.</div>

<!-- Отпустил / Получил -->
<table style="width:100%;font-size:9px;">
  <tr>
    <td style="width:50%;vertical-align:top;">
      <table style="width:100%;">
        <tr>
          <td style="padding:2px 0;">Отпустил</td>
          <td style="text-align:center;">/</td>
          <td style="border-bottom:1px solid #000;width:30%;"></td>
          <td style="text-align:center;">/</td>
          <td style="border-bottom:1px solid #000;width:35%;"></td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">подпись</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">расшифровка подписи</td>
        </tr>
      </table>
    </td>
    <td style="width:50%;vertical-align:top;">
      <table style="width:100%;">
        <tr>
          <td style="padding:2px 0;">Запасы получил</td>
          <td style="text-align:center;">/</td>
          <td style="border-bottom:1px solid #000;width:30%;"></td>
          <td style="text-align:center;">/</td>
          <td style="border-bottom:1px solid #000;width:35%;"></td>
        </tr>
        <tr>
          <td></td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">подпись</td>
          <td></td>
          <td style="font-size:6.5px;font-style:italic;text-align:center;">расшифровка подписи</td>
        </tr>
      </table>
    </td>
  </tr>
</table>

</body></html>`;
}

module.exports = waybillTemplate;
