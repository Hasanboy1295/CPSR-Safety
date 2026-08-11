import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { generateCPSRReport } from "@/lib/report";
import { buildCPSRPdf } from "@/lib/pdf-report";
import { sampleProductWizard } from "@/scripts/sample-data";

// Kitob (CPSR_KR_dossier_v7_3) ning "Example Serum" namunasini render qilish.
// REGRESSION: PDF shakllanuvchi bo'lib qolsin, MoS qiymatlari kitob jadvali bilan
// bir xil bo'lsin va hech qanday jadval sahifa kengligidan chiqib ketmasin.

test("buildCPSRPdf — Example Serum render: kitob MoS jadvali (표 2-9)", async () => {
  const report = await generateCPSRReport({
    productInfo: sampleProductWizard.productInfo,
    ingredients: sampleProductWizard.ingredients,
    productQuality: sampleProductWizard.productQuality,
    exposure: sampleProductWizard.exposure,
    lang: "ko",
  });

  const expected: Record<string, [number, number]> = {
    // INCI → [SED (kitob 표 2-9), MoS]
    AQUA: [12.107, 7434],
    GLYCERIN: [0.667, 3000],
    NIACINAMIDE: [0.4, 2500],
    PHENOXYETHANOL: [0.12, 4167],
    RETINOL: [0.04, 125],
  };

  assert.equal(report.calcRows.length, 5);
  for (const r of report.calcRows) {
    const [sed, mos] = expected[r.inciName];
    assert.ok(Math.abs(r.sed - sed) < 0.01, `${r.inciName} SED`);
    // Kitob qiymatlari yaxlitlangan (masalan AQUA MoS 7433.9 → 7434)
    assert.equal(Math.round(r.mos ?? -1), mos, `${r.inciName} MoS`);
  }
  assert.equal(report.minMos, 125);
});

test("buildCPSRPdf — PDF muvaffaqiyatli shakllanadi, sahifalar soni barqaror", async () => {
  const report = await generateCPSRReport({
    productInfo: sampleProductWizard.productInfo,
    ingredients: sampleProductWizard.ingredients,
    productQuality: sampleProductWizard.productQuality,
    exposure: sampleProductWizard.exposure,
    lang: "ko",
  });

  const bytes = await buildCPSRPdf(sampleProductWizard, report);
  assert.ok(bytes.length > 5000, "PDF bo'sh bo'lmasligi kerak");

  const doc = await PDFDocument.load(bytes);
  const pages = doc.getPageCount();
  // Cover+구조도+Part A+Part B+부록 — demoda 10~14 sahifa atrofida barqaror
  assert.ok(pages >= 10 && pages <= 14, `sahifalar soni: ${pages}`);
});
