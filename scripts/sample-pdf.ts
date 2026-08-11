// Namuna CPSR PDF yaratadi — CPSR_KR_dossier_v7_3 (kitob) dagi
// "Example Serum" ma'lumotlari bilan. Kompaniyaga ko'rsatish uchun:
//   npm run sample-pdf  →  sample-cpsr.pdf (bitta fayl)
// .env da kalitlar bo'lmasa demo (mock) rejimda, bo'lsa real RAG+LLM rejimida.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateCPSRReport } from "@/lib/report";
import { buildCPSRPdf } from "@/lib/pdf-report";
import { sampleProductWizard } from "./sample-data";

// tsx .env ni avtomatik yuklamaydi — e2e kabi o'zi o'qiydi.
for (const line of readFileSync(".env", "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const sample = sampleProductWizard;

async function main() {
  const report = await generateCPSRReport({
    productInfo: sample.productInfo,
    ingredients: sample.ingredients,
    productQuality: sample.productQuality,
    exposure: sample.exposure,
    lang: "ko",
  });

  const pdfBytes = await buildCPSRPdf(sample, report);
  const out = join(process.cwd(), "sample-cpsr.pdf");
  writeFileSync(out, pdfBytes);

  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdfBytes);
  console.log(`OK → ${out}`);
  console.log(`Pages: ${doc.getPageCount()}`);
  console.log(`Status: ${report.status} | demo: ${report.demo}`);
  console.log(
    `Sections: PASS ${report.statusCounts.pass} / REVIEW ${report.statusCounts.review} / FAIL ${report.statusCounts.fail}`
  );
  console.log(`minMoS: ${report.minMos} | TTC rows: ${report.ttcRows.length} | warnings: ${report.warnings.length}`);
  for (const r of report.calcRows) {
    console.log(
      `  ${r.inciName.padEnd(14)} %=${r.percentInProduct} SED=${r.sed.toFixed(3)} MoS=${r.mos === null ? "—" : r.mos.toFixed(0)}${r.restrictedNote ? " (restricted)" : ""}`
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
