// Haqiqiy CPSR PDF hujjatini yasaydi — veneks/21512 kabi real namunalarning
// Part A / Part B tuzilishiga taqlid qilib. Koreyscha va inglizcha matn
// ikkalasi ham to'g'ri chiqishi uchun Noto Sans KR shrifti ichiga o'rnatiladi.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WizardData } from "./wizard-types";
import type { CPSRReportDraft } from "./report";

const PAGE_W = 595.28; // A4, pt
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

type Cursor = { page: PDFPage; y: number };

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let line = "";
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = trial;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

const LEGAL_INTRO =
  "본 보고서는 「화장품법」 제5조 및 동법 시행규칙에 따라 작성되었습니다. " +
  "화장품책임판매업자에게 제품 유통 전 인체 안전성을 입증할 수 있는 과학적 " +
  "자료를 확보·보관할 것을 의무화하는 규정에 근거하며, 유럽(SCCS), 미국(CIR), " +
  "중국(NMPA) 등 주요국 위해성 평가 원칙을 준용하여 작성되었습니다.";

export async function buildCPSRPdf(
  data: Pick<WizardData, "productInfo" | "ingredients" | "productQuality" | "exposure" | "certification">,
  report: CPSRReportDraft
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = readFileSync(join(process.cwd(), "assets/fonts/NotoSansKR-Regular.otf"));
  const font = await pdf.embedFont(fontBytes, { subset: true });
  // MUHIM: bold (Helvetica) faqat SOF LOTIN matn uchun ishlatiladi — Koreys
  // belgisi bo'lsa WinAnsi xato beradi. Deyarli barcha sarlavhalarimiz KO+EN
  // aralash bo'lgani uchun, farqlash faqat o'lcham/rang orqali qilinadi.
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.11, 0.1);
  const muted = rgb(0.45, 0.5, 0.47);
  const accent = rgb(0.11, 0.43, 0.36);
  const warn = rgb(0.65, 0.36, 0.09);
  const border = rgb(0.85, 0.87, 0.85);

  function newPage(): Cursor {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    return { page, y: PAGE_H - MARGIN };
  }

  let cur = newPage();

  function ensureSpace(c: Cursor, needed: number): Cursor {
    if (c.y - needed < MARGIN + 30) return newPage();
    return c;
  }

  function text(
    c: Cursor,
    str: string,
    opts: { size?: number; f?: PDFFont; color?: ReturnType<typeof rgb>; gap?: number } = {}
  ): Cursor {
    const size = opts.size ?? 10;
    const f = opts.f ?? font;
    const color = opts.color ?? ink;
    c = ensureSpace(c, size + 4);
    c.page.drawText(str, { x: MARGIN, y: c.y, size, font: f, color });
    return { page: c.page, y: c.y - size - (opts.gap ?? 6) };
  }

  function paragraph(c: Cursor, str: string, opts: { size?: number; color?: ReturnType<typeof rgb> } = {}): Cursor {
    const size = opts.size ?? 9.5;
    const lines = wrapText(str || "—", font, size, CONTENT_W);
    for (const line of lines) {
      c = ensureSpace(c, size + 3);
      c.page.drawText(line, { x: MARGIN, y: c.y, size, font, color: opts.color ?? ink });
      c = { page: c.page, y: c.y - size - 3 };
    }
    return { page: c.page, y: c.y - 6 };
  }

  function hr(c: Cursor): Cursor {
    c = ensureSpace(c, 10);
    c.page.drawLine({ start: { x: MARGIN, y: c.y }, end: { x: PAGE_W - MARGIN, y: c.y }, thickness: 0.7, color: border });
    return { page: c.page, y: c.y - 14 };
  }

  function sectionTitle(c: Cursor, str: string): Cursor {
    c = ensureSpace(c, 26);
    c.page.drawText(str, { x: MARGIN, y: c.y, size: 13, font, color: accent });
    return { page: c.page, y: c.y - 20 };
  }

  function tableRow(c: Cursor, cells: string[], widths: number[], opts: { header?: boolean; size?: number } = {}): Cursor {
    const size = opts.size ?? 8.5;
    c = ensureSpace(c, size + 8);
    let x = MARGIN;
    for (let i = 0; i < cells.length; i++) {
      const f = font;
      const color = opts.header ? accent : ink;
      const truncated = cells[i].length > 60 ? cells[i].slice(0, 57) + "..." : cells[i];
      c.page.drawText(truncated, { x, y: c.y, size, font: f, color });
      x += widths[i];
    }
    return { page: c.page, y: c.y - size - 7 };
  }

  // ---------- Cover ----------
  cur = text(cur, "COSMETIC PRODUCT SAFETY REPORT", { size: 18, f: bold, color: ink, gap: 4 });
  cur = text(cur, "화장품 안전성 평가 자료 · Part A + Part B (EC 1223/2009 Annex I 참조)", { size: 10.5, color: muted, gap: 16 });

  const statusColor = report.status === "draft_generated" ? warn : accent;
  cur = text(cur, `${data.productInfo.productName || "(제품명 미입력)"}`, { size: 15, gap: 4 });
  cur = text(cur, `Ref: ${report.integrity.runId}  ·  ${report.integrity.createdAt}`, { size: 9, color: muted, gap: 4 });
  cur = text(cur, `상태: ${report.status}${report.demo ? " (DEMO MODE — 실제 AI 아님)" : ""}`, { size: 9.5, color: statusColor, gap: 16 });
  cur = hr(cur);

  // ---------- 1. Introduction & legal basis ----------
  cur = sectionTitle(cur, "1. 서론 및 평가 개요 (Introduction & Legal Basis)");
  cur = paragraph(cur, LEGAL_INTRO, { size: 9 });

  // ---------- 2. Product Info ----------
  cur = sectionTitle(cur, "2. 제품 기본 정보 (Product Information)");
  const pi = data.productInfo;
  const infoRows: [string, string][] = [
    ["제품 유형 (Product type)", pi.productType],
    ["사용 대상 (Target user)", pi.targetUser],
    ["사용 방식 (Rinse type)", pi.rinseType],
    ["사용 부위 (Application area)", pi.applicationArea],
    ["제조업자 (Manufacturer)", pi.manufacturer],
    ["책임판매업자 (Responsible seller)", pi.responsibleSeller],
  ];
  for (const [k, v] of infoRows) {
    cur = tableRow(cur, [k, v || "검토필요"], [190, CONTENT_W - 190]);
  }
  cur = { page: cur.page, y: cur.y - 6 };
  cur = tableRow(
    cur,
    [
      `A(g/day)=${data.exposure.amountG}  RF=${data.exposure.retentionFactor}  BW(kg)=${data.exposure.bodyWeightKg}`,
    ],
    [CONTENT_W],
    { size: 8 }
  );
  cur = { page: cur.page, y: cur.y - 10 };

  // ---------- 3. Composition ----------
  cur = sectionTitle(cur, "3. 제품의 정량적·정성적 구성 (Composition)");
  const compWidths = [200, 90, 60];
  cur = tableRow(cur, ["INCI", "CAS", "% (제품중)"], compWidths, { header: true });
  cur = hr(cur);
  for (const row of report.calcRows) {
    cur = tableRow(cur, [row.inciName || "—", row.cas || "—", row.percentInProduct.toFixed(3)], compWidths);
  }
  cur = { page: cur.page, y: cur.y - 10 };

  // ---------- 4. Physicochemical properties & stability ----------
  const pq = data.productQuality;
  cur = sectionTitle(cur, "4. 물리·화학적 특성 및 제품 안정성 (Physicochemical & Stability)");
  cur = tableRow(cur, ["성상 (Physical form)", pq.physicalForm || "검토필요"], [160, CONTENT_W - 160]);
  cur = tableRow(cur, ["pH", pq.ph || "검토필요"], [160, CONTENT_W - 160]);
  cur = tableRow(cur, ["점도 (Viscosity)", pq.viscosityRange || "검토필요"], [160, CONTENT_W - 160]);
  cur = tableRow(cur, ["안정성 시험 결과 (Stability)", pq.stabilityResult || "검토필요"], [160, CONTENT_W - 160]);
  cur = tableRow(cur, ["개봉 후 사용기간 (PAO)", pq.paoMonths ? `${pq.paoMonths}개월` : "검토필요"], [160, CONTENT_W - 160]);
  cur = { page: cur.page, y: cur.y - 10 };

  // ---------- 5. Microbiological quality ----------
  cur = sectionTitle(cur, "5. 미생물학적 품질 및 보존력 (Microbiological Quality)");
  cur = tableRow(cur, ["미생물한도 시험 (Microbial limit)", pq.microbialLimitResult || "검토필요"], [200, CONTENT_W - 200]);
  cur = tableRow(cur, ["보존력 시험 (Challenge test)", pq.challengeTestResult || "검토필요"], [200, CONTENT_W - 200]);
  cur = { page: cur.page, y: cur.y - 10 };

  // ---------- 6. Impurities & packaging ----------
  cur = sectionTitle(cur, "6. 불순물 및 포장재 관련 정보 (Impurities & Packaging)");
  cur = tableRow(cur, ["중금속 등 불순물 (Heavy metals)", pq.heavyMetalsResult || "검토필요"], [200, CONTENT_W - 200]);
  cur = tableRow(cur, ["포장재 (Packaging material)", pq.packagingMaterial || "검토필요"], [200, CONTENT_W - 200]);
  cur = tableRow(cur, ["포장재 적합성 (Migration test)", pq.packagingSafetyNote || "검토필요"], [200, CONTENT_W - 200]);
  cur = tableRow(cur, ["알레르기 성분 검토 (Allergens)", pq.allergenNote || "검토필요"], [200, CONTENT_W - 200]);
  cur = { page: cur.page, y: cur.y - 10 };

  // ---------- 7. Exposure assessment & MoS ----------
  cur = sectionTitle(cur, "7. 노출 평가 및 안전역 (Exposure Assessment & MoS)");
  cur = tableRow(
    cur,
    [`A(g/day)=${data.exposure.amountG}  RF=${data.exposure.retentionFactor}  BW(kg)=${data.exposure.bodyWeightKg}`],
    [CONTENT_W],
    { size: 8 }
  );
  cur = { page: cur.page, y: cur.y - 6 };
  const widths = [130, 70, 55, 70, 65, 80];
  cur = tableRow(cur, ["INCI", "CAS", "%", "SED", "NOAEL", "MoS / 판정"], widths, { header: true });
  cur = hr(cur);
  for (const row of report.calcRows) {
    const mosStr = row.mos === null ? "검토필요" : `${row.mos.toFixed(1)} (${row.judgment})`;
    cur = tableRow(
      cur,
      [row.inciName || "—", row.cas || "—", row.percentInProduct.toFixed(3), row.sed.toFixed(5), row.noael?.toString() ?? "검토필요", mosStr],
      widths
    );
  }
  cur = { page: cur.page, y: cur.y - 10 };

  // ---------- 8. Per-ingredient toxicity & AI-drafted description ----------
  cur = sectionTitle(cur, "8. 성분별 독성 정보 및 서술 (Toxicity Information — AI 초안)");
  cur = paragraph(cur, report.partA);

  // ---------- 9. Overall conclusion (Weight of Evidence + assessor) ----------
  cur = sectionTitle(cur, "9. 안전성 평가 종합 결론 (Weight of Evidence — AI 초안)");
  cur = paragraph(cur, report.partBReasoning);

  cur = sectionTitle(cur, "9-1. 평가자 결론 (Assessor Conclusion)");
  if (data.certification.assessorName && data.certification.draftNotes) {
    cur = text(cur, `평가자 (Safety Assessor): ${data.certification.assessorName}`, { size: 10.5 });
    if (data.certification.assessorPosition || data.certification.assessorQualification) {
      cur = text(
        cur,
        `${data.certification.assessorPosition || "—"} · ${data.certification.assessorQualification || "—"}`,
        { size: 9.5, color: muted, gap: 4 }
      );
    }
    cur = text(cur, `검토일 (Review date): ${data.certification.reviewDate || "—"}`, { size: 9.5, color: muted, gap: 10 });
    cur = paragraph(cur, data.certification.draftNotes);
  } else {
    cur = text(cur, "not_reviewed — 평가자 미승인. 소프트웨어는 최종 안전성 결론을 자동 생성하지 않습니다.", {
      size: 10.5,
      color: warn,
    });
  }

  // ---------- 10. References annex (RAG sources) ----------
  if (report.sources.length > 0) {
    cur = sectionTitle(cur, "10. 참고문헌 및 근거 자료 (References — RAG Sources)");
    for (const s of report.sources) {
      cur = text(cur, `· ${s.source_name} (유사도 ${(s.similarity * 100).toFixed(0)}%)`, { size: 8.5, color: muted, gap: 4 });
    }
    cur = { page: cur.page, y: cur.y - 6 };
  }

  // ---------- Footer integrity ----------
  cur = { page: cur.page, y: cur.y - 10 };
  cur = hr(cur);
  cur = text(cur, `Config hash: ${report.integrity.configHash.slice(0, 32)}...`, { size: 7.5, color: muted, f: font });
  cur = text(cur, `Input hash: ${report.integrity.inputCsvSha.slice(0, 32)}...`, { size: 7.5, color: muted, f: font });
  cur = text(cur, `Model: ${report.model} · auto-cpsr`, { size: 7.5, color: muted, f: font });

  return pdf.save();
}
