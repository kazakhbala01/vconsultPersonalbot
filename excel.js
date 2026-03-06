/**
 * Excel Generator — генерирует .xlsx документы через exceljs
 * Формат идентичен PDF-шаблонам, но в редактируемом Excel
 */

const ExcelJS = require("exceljs");
const path = require("path");
const os = require("os");

function formatNum(n) {
  if (!n && n !== 0) return "";
  return Number(n).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function generateInvoiceXLS(doc) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Счёт на оплату");
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const items = doc.items || [];
  const total = doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);

  ws.columns = [
    { width: 5 }, { width: 8 }, { width: 32 }, { width: 8 }, { width: 6 }, { width: 14 }, { width: 14 },
  ];

  const border = { top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"} };
  const boldFont = { bold: true, size: 10, name: "Times New Roman" };
  const normalFont = { size: 10, name: "Times New Roman" };
  const smallFont = { size: 8, name: "Times New Roman" };

  // Предупреждение
  let row = 1;
  ws.getCell(`A${row}`).value = "Внимание! Оплата данного счета означает согласие с условиями поставки товара.";
  ws.getCell(`A${row}`).font = { ...smallFont, italic: true };
  ws.mergeCells(`A${row}:G${row}`);

  // Банковские реквизиты
  row = 3;
  ws.getCell(`A${row}`).value = "Бенефициар:";
  ws.getCell(`A${row}`).font = boldFont;
  ws.getCell(`A${row+1}`).value = s.name || "";
  ws.getCell(`A${row+1}`).font = normalFont;
  ws.getCell(`A${row+2}`).value = `БИН: ${s.bin || ""}`;
  ws.getCell(`A${row+2}`).font = normalFont;

  ws.getCell(`E${row}`).value = "ИИК";
  ws.getCell(`E${row}`).font = boldFont;
  ws.getCell(`F${row}`).value = s.iik || "";
  ws.getCell(`F${row}`).font = normalFont;
  ws.mergeCells(`F${row}:G${row}`);

  ws.getCell(`E${row+1}`).value = "Банк:";
  ws.getCell(`E${row+1}`).font = boldFont;
  ws.getCell(`F${row+1}`).value = `${s.bank || ""}, БИК: ${s.bik || ""}`;
  ws.getCell(`F${row+1}`).font = normalFont;
  ws.mergeCells(`F${row+1}:G${row+1}`);

  ws.getCell(`E${row+2}`).value = `Кбе: ${s.kbe || "19"} | КНП: ${s.knp || "859"}`;
  ws.getCell(`E${row+2}`).font = smallFont;
  ws.mergeCells(`E${row+2}:G${row+2}`);

  // Заголовок
  row = 8;
  ws.getCell(`A${row}`).value = `Счёт на оплату № ${doc.number || "1"} от ${doc.date || ""}`;
  ws.getCell(`A${row}`).font = { bold: true, size: 14, name: "Times New Roman" };
  ws.getCell(`A${row}`).alignment = { horizontal: "center" };
  ws.mergeCells(`A${row}:G${row}`);

  // Поставщик / Покупатель
  row = 10;
  ws.getCell(`A${row}`).value = `Поставщик: БИН/ИИН ${s.bin || ""}, ${s.name || ""}${s.address ? ", " + s.address : ""}`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.mergeCells(`A${row}:G${row}`);

  row = 11;
  ws.getCell(`A${row}`).value = `Покупатель: ${b.name || ""}${b.bin ? ", БИН/ИИН " + b.bin : ""}${b.address ? ", " + b.address : ""}`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.mergeCells(`A${row}:G${row}`);

  row = 12;
  ws.getCell(`A${row}`).value = `Договор: ${doc.contract || "Без договора"}`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.mergeCells(`A${row}:G${row}`);

  // Заголовки таблицы
  row = 14;
  const headers = ["№", "Код", "Наименование", "Кол-во", "Ед.", "Цена", "Сумма"];
  headers.forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = boldFont;
    cell.border = border;
    cell.alignment = { horizontal: "center" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF5F5F5" } };
  });

  // Строки товаров
  items.forEach((item, i) => {
    row++;
    const vals = [i + 1, item.code || "", item.name, item.qty, item.unit || "усл", item.price, item.total];
    vals.forEach((v, j) => {
      const cell = ws.getCell(row, j + 1);
      cell.value = v;
      cell.font = normalFont;
      cell.border = border;
      if (j === 0 || j === 3 || j === 4) cell.alignment = { horizontal: "center" };
      if (j >= 5) { cell.numFmt = "#,##0.00"; cell.alignment = { horizontal: "right" }; }
    });
  });

  // Итого
  row++;
  ws.getCell(row, 6).value = "Итого:";
  ws.getCell(row, 6).font = boldFont;
  ws.getCell(row, 7).value = total;
  ws.getCell(row, 7).font = boldFont;
  ws.getCell(row, 7).numFmt = "#,##0.00";

  // Всего к оплате
  row += 2;
  ws.getCell(`A${row}`).value = `Всего наименований ${items.length}, на сумму ${formatNum(total)} KZT`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.mergeCells(`A${row}:G${row}`);

  row++;
  ws.getCell(`A${row}`).value = `Всего к оплате: ${doc.totalWords || ""} тенге 00 тиын`;
  ws.getCell(`A${row}`).font = boldFont;
  ws.mergeCells(`A${row}:G${row}`);

  // Подписи
  row += 3;
  ws.getCell(`A${row}`).value = "Исполнитель _______________";
  ws.getCell(`A${row}`).font = normalFont;
  ws.getCell(`E${row}`).value = "Главный Бухгалтер _______________";
  ws.getCell(`E${row}`).font = normalFont;

  return wb;
}

async function generateActXLS(doc) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Акт", { pageSetup: { orientation: "landscape" } });
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const items = doc.items || [];
  const total = doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);

  ws.columns = [
    { width: 5 }, { width: 30 }, { width: 12 }, { width: 18 }, { width: 7 }, { width: 9 }, { width: 13 }, { width: 13 },
  ];

  const border = { top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"} };
  const boldFont = { bold: true, size: 10, name: "Times New Roman" };
  const normalFont = { size: 9, name: "Times New Roman" };

  let row = 1;
  ws.getCell(`F${row}`).value = "Приложение 50 к приказу Министра финансов РК от 20.12.2012 №562";
  ws.getCell(`F${row}`).font = { size: 8, name: "Times New Roman", italic: true };
  ws.mergeCells(`F${row}:H${row}`);

  row = 2;
  ws.getCell(`H${row}`).value = "Форма Р-1";
  ws.getCell(`H${row}`).font = { size: 8, name: "Times New Roman" };

  row = 4;
  ws.getCell(`A${row}`).value = `Заказчик: ${b.name || ""}${b.address ? ", " + b.address : ""}`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`G${row}`).value = "ИИН/БИН";
  ws.getCell(`G${row}`).font = { size: 8, name: "Times New Roman" };
  ws.getCell(`H${row}`).value = b.bin || "";
  ws.getCell(`H${row}`).font = boldFont;
  ws.getCell(`H${row}`).border = border;

  row = 5;
  ws.getCell(`A${row}`).value = `Исполнитель: ${s.name || ""}${s.address ? ", " + s.address : ""}`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`H${row}`).value = s.bin || "";
  ws.getCell(`H${row}`).font = boldFont;
  ws.getCell(`H${row}`).border = border;

  row = 6;
  ws.getCell(`A${row}`).value = `Договор: ${doc.contract || "Без договора"}`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.getCell(`F${row}`).value = `№ ${doc.number || "1"}`;
  ws.getCell(`F${row}`).font = boldFont;
  ws.getCell(`F${row}`).border = border;
  ws.getCell(`G${row}`).value = "Дата";
  ws.getCell(`G${row}`).font = { size: 8, name: "Times New Roman" };
  ws.getCell(`H${row}`).value = doc.date || "";
  ws.getCell(`H${row}`).font = boldFont;
  ws.getCell(`H${row}`).border = border;

  row = 8;
  ws.getCell(`A${row}`).value = "АКТ ВЫПОЛНЕННЫХ РАБОТ (ОКАЗАННЫХ УСЛУГ)";
  ws.getCell(`A${row}`).font = { bold: true, size: 12, name: "Times New Roman" };
  ws.getCell(`A${row}`).alignment = { horizontal: "center" };
  ws.mergeCells(`A${row}:H${row}`);

  // Заголовки
  row = 10;
  ["№","Наименование работ","Дата выполнения","Сведения об отчете","Ед.","Кол-во","Цена за ед.","Стоимость"].forEach((h,i) => {
    const cell = ws.getCell(row, i+1);
    cell.value = h;
    cell.font = { bold:true, size:8, name:"Times New Roman" };
    cell.border = border;
    cell.alignment = { horizontal:"center", wrapText:true, vertical:"middle" };
  });

  items.forEach((item, i) => {
    row++;
    [i+1, item.name, item.completionDate||"", "", item.unit||"усл", item.qty, item.price, item.total].forEach((v,j) => {
      const cell = ws.getCell(row, j+1);
      cell.value = v;
      cell.font = normalFont;
      cell.border = border;
      if(j===0||j>=4) cell.alignment = { horizontal:"center" };
      if(j>=6) { cell.numFmt="#,##0.00"; cell.alignment={horizontal:"right"}; }
    });
  });

  row++;
  ws.getCell(row,5).value = "Итого";
  ws.getCell(row,5).font = boldFont;
  ws.getCell(row,5).border = border;
  ws.getCell(row,7).value = "x";
  ws.getCell(row,7).font = normalFont;
  ws.getCell(row,7).border = border;
  ws.getCell(row,8).value = total;
  ws.getCell(row,8).font = boldFont;
  ws.getCell(row,8).border = border;
  ws.getCell(row,8).numFmt = "#,##0.00";

  row += 2;
  ws.getCell(`A${row}`).value = `Всего к оплате: ${doc.totalWords || ""} тенге 00 тиын`;
  ws.getCell(`A${row}`).font = boldFont;
  ws.mergeCells(`A${row}:H${row}`);

  row += 2;
  ws.getCell(`A${row}`).value = "Сдал (Исполнитель) _________ / _________ /";
  ws.getCell(`E${row}`).value = "Принял (Заказчик) _________ / _________ /";

  return wb;
}

async function generateWaybillXLS(doc) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Накладная", { pageSetup: { orientation: "landscape" } });
  const s = doc.seller || {};
  const b = doc.buyer || {};
  const items = doc.items || [];
  const total = doc.grandTotal || items.reduce((sum, i) => sum + (i.total || 0), 0);
  const totalQty = items.reduce((sum, i) => sum + (i.qty || 0), 0);

  ws.columns = [
    { width: 5 }, { width: 28 }, { width: 12 }, { width: 7 }, { width: 9 }, { width: 9 }, { width: 13 }, { width: 13 }, { width: 11 },
  ];

  const border = { top:{style:"thin"}, left:{style:"thin"}, bottom:{style:"thin"}, right:{style:"thin"} };
  const boldFont = { bold: true, size: 10, name: "Times New Roman" };
  const normalFont = { size: 9, name: "Times New Roman" };

  let row = 1;
  ws.getCell(`G${row}`).value = "Приложение 26 к приказу Министра финансов РК от 20.12.2012 №562";
  ws.getCell(`G${row}`).font = { size: 8, name: "Times New Roman", italic: true };
  ws.mergeCells(`G${row}:I${row}`);

  row = 2;
  ws.getCell(`I${row}`).value = "Форма З-2";
  ws.getCell(`I${row}`).font = { size: 8, name: "Times New Roman" };

  row = 4;
  ws.getCell(`A${row}`).value = `Организация: ${s.name || ""}`;
  ws.getCell(`A${row}`).font = normalFont;
  ws.mergeCells(`A${row}:F${row}`);
  ws.getCell(`G${row}`).value = "ИИН/БИН";
  ws.getCell(`G${row}`).font = { size: 8, name: "Times New Roman" };
  ws.getCell(`H${row}`).value = s.bin || "";
  ws.getCell(`H${row}`).font = boldFont;
  ws.getCell(`H${row}`).border = border;

  row = 6;
  ws.getCell(`A${row}`).value = `НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ  № ${doc.number || ""} от ${doc.date || ""}`;
  ws.getCell(`A${row}`).font = { bold: true, size: 12, name: "Times New Roman" };
  ws.getCell(`A${row}`).alignment = { horizontal: "center" };
  ws.mergeCells(`A${row}:I${row}`);

  // Стороны
  row = 8;
  ["Отправитель", "Получатель", "Ответственный", "Транспорт", "ТТН"].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 8, name: "Times New Roman" };
    cell.border = border;
    cell.alignment = { horizontal: "center", wrapText: true };
  });
  row = 9;
  [s.name || "", b.name || "", doc.responsible || "", "", ""].forEach((v, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = v;
    cell.font = normalFont;
    cell.border = border;
    cell.alignment = { horizontal: "center", wrapText: true };
  });

  // Заголовки таблицы
  row = 11;
  ["№", "Наименование", "Номенкл. номер", "Ед. изм.", "Подлежит", "Отпущено", "Цена, KZT", "Сумма с НДС", "Сумма НДС"].forEach((h, i) => {
    const cell = ws.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 8, name: "Times New Roman" };
    cell.border = border;
    cell.alignment = { horizontal: "center", wrapText: true, vertical: "middle" };
  });

  items.forEach((item, i) => {
    row++;
    [i + 1, item.name, item.code || "", item.unit || "шт", item.qty, item.qty, item.price, item.total, item.nds || 0].forEach((v, j) => {
      const cell = ws.getCell(row, j + 1);
      cell.value = v;
      cell.font = normalFont;
      cell.border = border;
      if (j === 0 || j >= 3) cell.alignment = { horizontal: "center" };
      if (j >= 6) { cell.numFmt = "#,##0.00"; cell.alignment = { horizontal: "right" }; }
    });
  });

  // Итого
  row++;
  ws.getCell(row, 4).value = "Итого"; ws.getCell(row, 4).font = boldFont; ws.getCell(row, 4).border = border;
  ws.getCell(row, 5).value = totalQty; ws.getCell(row, 5).font = boldFont; ws.getCell(row, 5).border = border;
  ws.getCell(row, 6).value = totalQty; ws.getCell(row, 6).font = boldFont; ws.getCell(row, 6).border = border;
  ws.getCell(row, 7).value = "x"; ws.getCell(row, 7).font = normalFont; ws.getCell(row, 7).border = border;
  ws.getCell(row, 8).value = total; ws.getCell(row, 8).font = boldFont; ws.getCell(row, 8).border = border; ws.getCell(row, 8).numFmt = "#,##0.00";
  ws.getCell(row, 9).value = ""; ws.getCell(row, 9).border = border;

  row += 2;
  ws.getCell(`A${row}`).value = `Всего к оплате: ${doc.totalWords || ""} 00 тиын`;
  ws.getCell(`A${row}`).font = boldFont;
  ws.mergeCells(`A${row}:I${row}`);

  row += 2;
  ws.getCell(`A${row}`).value = "Отпуск разрешил _________ / _________ /";
  ws.getCell(`F${row}`).value = "Получил _________ / _________ /";

  return wb;
}

async function generateExcel(doc) {
  let wb;
  switch (doc.type) {
    case "act": wb = await generateActXLS(doc); break;
    case "waybill": wb = await generateWaybillXLS(doc); break;
    default: wb = await generateInvoiceXLS(doc); break;
  }

  const safeName = (doc.title || "Документ").replace(/[^\wа-яА-ЯёЁ\s-]/gi,"").replace(/\s+/g,"_").substring(0,50);
  const safeNum = (doc.number || "").replace(/[^\wа-яА-ЯёЁ-]/gi,"_");
  const fileName = `${safeName}${safeNum ? "_"+safeNum : ""}.xlsx`;
  const filePath = path.join(os.tmpdir(), `docagent_${Date.now()}_${fileName}`);

  await wb.xlsx.writeFile(filePath);
  return { filePath, fileName };
}

module.exports = { generateExcel };
