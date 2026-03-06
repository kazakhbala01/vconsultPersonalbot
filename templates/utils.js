/**
 * Общие утилиты для шаблонов
 */

function formatNum(n) {
  if (n === null || n === undefined || n === "") return "";
  return Number(n).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

module.exports = { formatNum, escapeHtml };
