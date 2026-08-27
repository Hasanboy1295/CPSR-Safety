// Yuklangan hujjatni (xlsx/pdf/csv/txt) tekst'ga aylantiradi — bu tekst
// keyin LLM'ga (extract-llm.ts) yuborilib, tuzilgan ma'lumotga aylantiriladi.
// Deterministik qism (fayl parsing) va AI qismi (mazmunni tushunish)
// qat'iy ajratilgan — LLM faylning o'zini emas, faqat undan chiqarilgan
// tekstni ko'radi.

// NOTE: pdf-parse @2 (pdfjs-dist 5) Vercel/Node'da "Object.defineProperty
// called on non-object" bilan qulaydi — shuning uchun barqaror @1.1.1
// (pdfjs 1.10, serverless uchun sinovdan o'tgan) ishlatiladi.
// Excel uchun esa exceljs o'rniga SheetJS (xlsx) — u ham .xlsx, ham eski
// .xls (binary OLE) formatini o'qiydi (exceljs faqat .xlsx zip'ni o'qir edi).

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
  const XLSX = (await import("xlsx")).default ?? (await import("xlsx"));
  const workbook = XLSX.read(buffer, { type: "buffer" });

  const lines: string[] = [];
  for (const name of workbook.SheetNames) {
    lines.push(`--- varaq: ${name} ---`);
    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[name], { blankrows: false });
    for (const row of csv.split("\n")) {
      if (row.trim()) lines.push(row);
    }
  }
  return lines.join("\n");
}

async function parsePdf(buffer: Buffer): Promise<string> {
  // pdf-parse @1 — default eksport funksiyasi; qaytaradi: { text, numpages, ... }
  const parsePdfBuffer = (await import("pdf-parse")).default;
  const result = await parsePdfBuffer(buffer);
  return result.text;
}
