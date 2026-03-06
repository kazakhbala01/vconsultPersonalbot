/**
 * PDF Generator — Docker Edition
 * Использует системный Chromium через env PUPPETEER_EXECUTABLE_PATH
 */

const puppeteer = require("puppeteer");
const path = require("path");
const os = require("os");

const invoiceTemplate = require("./templates/invoice");
const actTemplate = require("./templates/act");
const waybillTemplate = require("./templates/waybill");
const commercialTemplate = require("./templates/commercial");
const genericTemplate = require("./templates/generic");

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: "new",
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--single-process",
      ],
    });
  }
  return browser;
}

function getTemplate(doc) {
  switch (doc.type) {
    case "invoice": return invoiceTemplate(doc);
    case "act": return actTemplate(doc);
    case "waybill": return waybillTemplate(doc);
    case "commercial": return commercialTemplate(doc);
    default: return genericTemplate(doc);
  }
}

async function generatePDF(doc) {
  const html = getTemplate(doc);
  const br = await getBrowser();
  const page = await br.newPage();

  try {
    await page.setContent(html, { waitUntil: "networkidle0" });

    const safeName = (doc.title || "Документ").replace(/[^\wа-яА-ЯёЁ\s-]/gi, "").replace(/\s+/g, "_").substring(0, 50);
    const safeNum = (doc.number || "").replace(/[^\wа-яА-ЯёЁ-]/gi, "_");
    const fileName = `${safeName}${safeNum ? "_" + safeNum : ""}.pdf`;
    const filePath = path.join(os.tmpdir(), `docagent_${Date.now()}_${fileName}`);

    const isLandscape = doc.type === "act" || doc.type === "waybill";
    const isCommercial = doc.type === "commercial";

    await page.pdf({
      path: filePath,
      format: "A4",
      landscape: isLandscape,
      margin: isCommercial
        ? { top: "0mm", right: "0mm", bottom: "10mm", left: "0mm" }
        : { top: "10mm", right: "10mm", bottom: "10mm", left: "10mm" },
      printBackground: true,
      preferCSSPageSize: true,
    });

    return { filePath, fileName };
  } finally {
    await page.close();
  }
}

async function closeBrowser() {
  if (browser) { await browser.close(); browser = null; }
}

module.exports = { generatePDF, closeBrowser };
