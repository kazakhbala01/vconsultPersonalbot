/**
 * Сумма прописью на русском — без AI
 */

const ones = ["","один","два","три","четыре","пять","шесть","семь","восемь","девять"];
const onesF = ["","одна","две","три","четыре","пять","шесть","семь","восемь","девять"];
const teens = ["десять","одиннадцать","двенадцать","тринадцать","четырнадцать","пятнадцать","шестнадцать","семнадцать","восемнадцать","девятнадцать"];
const tens = ["","","двадцать","тридцать","сорок","пятьдесят","шестьдесят","семьдесят","восемьдесят","девяносто"];
const hundreds = ["","сто","двести","триста","четыреста","пятьсот","шестьсот","семьсот","восемьсот","девятьсот"];

function plural(n, one, two, five) {
  n = Math.abs(n) % 100;
  if (n >= 11 && n <= 19) return five;
  n = n % 10;
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return two;
  return five;
}

function numberToWords(num) {
  num = Math.floor(num);
  if (num === 0) return "ноль тенге";

  let result = "";

  // Миллиарды
  const billions = Math.floor(num / 1000000000);
  if (billions > 0) {
    result += triplet(billions, false) + " " + plural(billions, "миллиард", "миллиарда", "миллиардов") + " ";
    num %= 1000000000;
  }

  // Миллионы
  const millions = Math.floor(num / 1000000);
  if (millions > 0) {
    result += triplet(millions, false) + " " + plural(millions, "миллион", "миллиона", "миллионов") + " ";
    num %= 1000000;
  }

  // Тысячи (женский род: одна тысяча, две тысячи)
  const thousands = Math.floor(num / 1000);
  if (thousands > 0) {
    result += triplet(thousands, true) + " " + plural(thousands, "тысяча", "тысячи", "тысяч") + " ";
    num %= 1000;
  }

  // Остаток
  if (num > 0) {
    result += triplet(num, false);
  }

  result = result.trim();
  // Первая буква заглавная
  result = result.charAt(0).toUpperCase() + result.slice(1);
  return result + " тенге";
}

function triplet(n, feminine) {
  const parts = [];
  const h = Math.floor(n / 100);
  if (h > 0) parts.push(hundreds[h]);

  const remainder = n % 100;
  if (remainder >= 10 && remainder <= 19) {
    parts.push(teens[remainder - 10]);
  } else {
    const t = Math.floor(remainder / 10);
    const o = remainder % 10;
    if (t > 0) parts.push(tens[t]);
    if (o > 0) parts.push(feminine ? onesF[o] : ones[o]);
  }

  return parts.join(" ");
}

module.exports = { numberToWords };
