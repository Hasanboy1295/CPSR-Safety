// Yuklangan hujjatni (xlsx/pdf/csv/txt) tekst'ga aylantiradi — bu tekst
// keyin LLM'ga (extract-llm.ts) yuborilib, tuzilgan ma'lumotga aylantiriladi.
// Deterministik qism (fayl parsing) va AI qismi (mazmunni tushunish)
// qat'iy ajratilgan — LLM faylning o'zini emas, faqat undan chiqarilgan
// tekstni ko'radi.

import ExcelJS from "exceljs";

export async function parseDocumentToText(buffer: Buffer, filename: string): Promise<string> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";

  if (ext === "xlsx" || ext === "xls") {
    return parseExcel(buffer);
  }

  if (ext === "pdf") {
    return parsePdf(buffer);
  }

  if (ext === "docx") {
    return parseDocx(buffer);
  }

  // csv/txt — to'g'ridan-to'g'ri tekst
  return buffer.toString("utf-8");
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function parseExcel(buffer: Buffer): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`--- varaq: ${sheet.name} ---`);
    sheet.eachRow((row) => {
      const cells = (row.values as unknown[]).slice(1).map((v) => {
        if (v == null) return "";
        if (typeof v === "object" && "text" in (v as object)) return (v as { text: string }).text;
        if (typeof v === "object" && "result" in (v as object)) return String((v as { result: unknown }).result);
        return String(v);
      });
      lines.push(cells.join(" | "));
    });
  });
  return lines.join("\n");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}
