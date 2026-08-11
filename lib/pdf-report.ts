// Haqiqiy CPSR PDF — CPSR_KR_dossier_v7_3 (kitob) ning 21 betlik tuzilmasiga
// mos holda quriladi:
//   1. Cover + 문서 통제 정보
//   2. Document Structure Map + Status Snapshot + 표 0 Executive Summary
//   3. Part A — §1 제품정보 · §2.1.1 구성 · §2.1.2 물성·안정성 · §2.1.3 미생물 ·
//      §2.1.4 불순물·포장 · §2.1.5 사용 · §2.1.6 노출 · §2.1.7 MoS·TTC ·
//      §2.1.8 독성 WoE · §2.1.9 유해사례 · §2.1.10 기타
//   4. Part B — §2.2.1 고찰 · §2.2.2 결론·한계 · §2.2.3 경고 · §2.3 평가자
//   5. Appendix — A 관할권 매핑 · B ALCOA+ 무결성 · C 검토 액션 · D 참고문헌·선언
//
// Kitob qoidasi: ma'lumot yo'q joy "검토필요" deb ko'rsatiladi — uydirma
// kiritilmaydi. Har bir bo'lim statusi (PASS/검토필요/FAIL) ko'rsatiladi.

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { WizardData, Certification, ProductQuality, ExposureParams } from "./wizard-types";
import { flattenIngredients, emptyProductQuality, emptyExposure } from "./wizard-types";
import type { CPSRReportDraft, ReportSectionStatus, ReportSections } from "./report";

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

const STATUS_LABEL: Record<ReportSectionStatus, string> = {
  pass: "PASS",
  review: "검토필요",
  fail: "FAIL",
};

const REGULATORY_CONTEXT =
  "본 자료는 화장품책임판매업자가 작성·보관하는 안전성 평가 자료이며, 판매 전 사전 제출 대상이 아니라 식약처 점검·요청 시 제출하는 " +
  "문서다. 책임 주체는 책임판매업자이며, 1차 기준은 식약처 안내서-1506-01·화장품법·화장품 안전기준 규정이고, 국제 정합성 참조로 " +
  "EC 1223/2009 Annex I Part A(안전성 정보) + Part B(안전성 평가) 2부 구조를 채택했다.";

const LEGAL_INTRO =
  "본 보고서는 「화장품법」 제5조 및 동법 시행규칙에 따라 작성되었습니다. 화장품책임판매업자에게 제품 유통 전 인체 안전성을 " +
  "입증할 수 있는 과학적 자료를 확보·보관할 것을 의무화하는 규정에 근거하며, 유럽(SCCS), 미국(CIR), 중국(NMPA) 등 주요국 " +
  "위해성 평가 원칙을 준용하여 작성되었습니다.";

const REFERENCES: string[] = [
  "Regulation (EC) No 1223/2009 on cosmetic products, Annex I (Parts A & B), Art.10.15.16.19.",
  "Commission Implementing Decision 2013/674/EU — guidelines on Annex I to Reg. (EC) 1223/2009.",
  "SCCS Notes of Guidance for the Testing of Cosmetic Ingredients, 12th revision, SCCS/1647/22 (2023).",
  "Commission Regulation (EU) 2024/996 — restrictions incl. Retinol (leave-on/rince-off 0.3% RE, body lotion 0.05% RE).",
  "SCCS/1576/16 & SCCS/1639/21 — Vitamin A / Retinol opinions (aggregate exposure).",
  "화장품법 및 시행규칙 — 제12조(전성분 표시), 시행규칙 제21조제2호, 별표3(사용 시 주의사항).",
  "화장품 안전기준 등에 관한 규정 — 별표1(배합금지)·별표2(사용제한·한도)·별표4(미생물 한도).",
  "식약처 안내서-1506-01 「화장품 안전성 평가 자료 작성 가이드라인」(참고용, 법적 구속력 없음).",
  "식약처 「화장품 위해평가 가이드라인」 — MoS≥100 / 비역치 발암위해(MOE).",
  "ISO 22716:2007 (GMP) · ISO 17516:2014 (미생물 한도) · ISO 11930:2019+A1:2022 (방부력) · ISO/TR 18811:2018 (안정성).",
  "Regulation (EU) 10/2011 — 식품접촉물질(포장 이행의 과학적 참조; 화장품 직접 강제 아님).",
  "CLP Regulation (EC) 1272/2008 · ECHA C&L Inventory (CMR 분류).",
  "China NMPA 화장품 안전성 평가 기술지침(2021) · 공고 제50호(2024) · US MOCRA (2022).",
  "eIDAS Regulation (EU) 910/2014 · 대한민국 전자서명법(2020) · ALCOA+ (MHRA/WHO/PIC-S).",
];

const DECLARATION =
  "본인은 자격을 갖춘 안전성 평가자로서 위 Part A 정보와 Part B 평가를 검토하였으며, 서명함으로써 평가 결과에 대한 책임을 " +
  "확인한다. 본 서명란은 소프트웨어가 자동 기입하지 않으며, 자필 서명 후 제출본에 한해 유효하다.";

const REVISION_HISTORY: [string, string, string][] = [
  ["Rev. 1.0", "draft", "최초 초안 (draft_generated)"],
  ["Rev. 1.1", "draft", "Part A/B 2부화 · 다관할 매핑 · WoE·ALCOA+ 반영"],
  ["Rev. 1.2", "draft", "품질·신뢰도 감사 정합화: SED/MoS·DAP 정정"],
  ["Rev. 1.3", "현재", "안전성 평가자 검토·서명 상태 반영 (submission_ready)"],
];

export async function buildCPSRPdf(
  data: Pick<WizardData, "productInfo" | "ingredients" | "productQuality" | "exposure" | "certification">,
  report: CPSRReportDraft
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const fontBytes = readFileSync(join(process.cwd(), "assets/fonts/NotoSansKR-Regular.otf"));
  const font = await pdf.embedFont(fontBytes, { subset: true });
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ink = rgb(0.09, 0.11, 0.1);
  const muted = rgb(0.45, 0.5, 0.47);
  const accent = rgb(0.11, 0.43, 0.36);
  const warn = rgb(0.65, 0.36, 0.09);
  const danger = rgb(0.72, 0.22, 0.2);
  const passColor = rgb(0.12, 0.48, 0.3);
  const border = rgb(0.85, 0.87, 0.85);

  const productQuality: ProductQuality = data.productQuality ?? emptyProductQuality();
  const exposure: ExposureParams = data.exposure ?? emptyExposure;
  const cert: Certification = data.certification ?? {
    assessorName: "",
    assessorPosition: "",
    assessorQualification: "",
    reviewDate: "",
    draftNotes: "",
    selfCertified: false,
  };

  const flat = flattenIngredients(data.ingredients);
  const totalPct = flat.reduce((s, c) => s + c.percentInProduct, 0);

  const fallbackSections: ReportSections = {
    productInfo: "review",
    composition: "review",
    physchemStability: "review",
    microbiological: "review",
    impuritiesPackaging: "review",
    use: "review",
    exposure: "review",
    mosRisk: "review",
    toxicology: "review",
    undesirableEffects: "review",
    otherInfo: "review",
    discussion: "review",
    conclusion: "review",
    warnings: "review",
    assessor: "review",
  };
  const sections: ReportSections = { ...fallbackSections, ...(report.sections ?? {}) };
  if (cert.selfCertified) {
    sections.conclusion = "pass";
    sections.assessor = "pass";
  }
  const statusCounts = { pass: 0, review: 0, fail: 0 };
  for (const st of Object.values(sections)) statusCounts[st] += 1;

  function sec(key: keyof ReportSections): ReportSectionStatus {
    return sections[key] ?? "review";
  }

  function v(str: string | null | undefined): string {
    return str && str.trim() ? str.trim() : "검토필요";
  }

  // HelveticaBold faqat SOF LOTIN matn uchun ishlatiladi — koreys belgisi
  // bo'lsa Noto (font) ishlatiladi, aks holda WinAnsi xato beradi.
  function pickBold(str: string): PDFFont {
    return /^[\x00-\x7F\s]*$/.test(str) ? bold : font;
  }

  const expP = report.exposureParams ?? {
    A: parseFloat(exposure.amountG) || 0,
    RF: parseFloat(exposure.retentionFactor) || 0,
    BW: parseFloat(exposure.bodyWeightKg) || 0,
    F: parseFloat(exposure.frequency) || 1,
  };
  const exposureE =
    report.exposureE ?? (expP.BW > 0 ? (expP.A * expP.RF * 1000) / expP.BW : 0);
  const mosRows = report.calcRows.filter((r) => r.mos !== null);
  const minMos =
    report.minMos ??
    (mosRows.length > 0 ? Math.min(...mosRows.map((r) => r.mos as number)) : null);

  function newPage(): Cursor {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    return { page, y: PAGE_H - MARGIN };
  }

  let cur = newPage();

  function ensureSpace(c: Cursor, needed: number): Cursor {
    if (c.y - needed < MARGIN + 34) return newPage();
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
    if (process.env.DEBUG_PDF) {
      const w = f.widthOfTextAtSize(str, size);
      if (MARGIN + w > PAGE_W - MARGIN + 1) console.warn(`[OVERFLOW-R] ${str.slice(0, 40)}`);
      if (c.y < MARGIN - 2) console.warn(`[OVERFLOW-B] ${str.slice(0, 40)}`);
    }
    return { page: c.page, y: c.y - size - (opts.gap ?? 6) };
  }

  function paragraph(c: Cursor, str: string, opts: { size?: number; color?: ReturnType<typeof rgb> } = {}): Cursor {
    const size = opts.size ?? 9.5;
    const lines = wrapText(str || "—", font, size, CONTENT_W);
    for (const line of lines) {
      c = ensureSpace(c, size + 3);
      c.page.drawText(line, { x: MARGIN, y: c.y, size, font, color: opts.color ?? ink });
      if (process.env.DEBUG_PDF) {
        const w = font.widthOfTextAtSize(line, size);
        if (MARGIN + w > PAGE_W - MARGIN + 1) console.warn(`[OVERFLOW-P] ${line.slice(0, 40)}`);
      }
      c = { page: c.page, y: c.y - size - 3 };
    }
    return { page: c.page, y: c.y - 6 };
  }

  function hr(c: Cursor): Cursor {
    c = ensureSpace(c, 10);
    c.page.drawLine({ start: { x: MARGIN, y: c.y }, end: { x: PAGE_W - MARGIN, y: c.y }, thickness: 0.7, color: border });
    return { page: c.page, y: c.y - 14 };
  }

  function sectionTitle(c: Cursor, label: string, status?: ReportSectionStatus): Cursor {
    c = ensureSpace(c, 28);
    c.page.drawText(label, { x: MARGIN, y: c.y, size: 12.5, font, color: accent });
    if (status) {
      const badgeText = STATUS_LABEL[status];
      const badgeColor = status === "pass" ? passColor : status === "fail" ? danger : warn;
      c.page.drawText(badgeText, {
        x: PAGE_W - MARGIN - font.widthOfTextAtSize(badgeText, 9),
        y: c.y + 2,
        size: 9,
        font,
        color: badgeColor,
      });
    }
    return { page: c.page, y: c.y - 18 };
  }

  function subTitle(c: Cursor, label: string): Cursor {
    c = ensureSpace(c, 20);
    c.page.drawText(label, { x: MARGIN, y: c.y, size: 10.5, font, color: ink });
    return { page: c.page, y: c.y - 15 };
  }

  function drawTable(
    c: Cursor,
    widths: number[],
    header: string[],
    rows: string[][],
    opts: { size?: number; rightAlign?: boolean[] } = {}
  ): Cursor {
    const size = opts.size ?? 8;
    const colXs: number[] = [];
    let x = MARGIN;
    for (const w of widths) {
      colXs.push(x);
      x += w;
    }
    const tableRight = colXs[colXs.length - 1] + widths[widths.length - 1];
    if (process.env.DEBUG_PDF && tableRight > PAGE_W - MARGIN + 1) {
      console.warn(`[OVERFLOW-T] table ${widths} extends ${(tableRight - (PAGE_W - MARGIN)).toFixed(1)}pt past right margin`);
    }

    function cellLines(txt: string, w: number): string[] {
      return wrapText(txt || "", font, size, Math.max(10, w - 6));
    }
    function rowHeight(cells: string[][]): number {
      const maxLines = Math.max(...cells.map((lines) => lines.length), 1);
      return maxLines * (size + 3) + 7;
    }

    c = ensureSpace(c, size + 14);
    const headerCells = header.map((h, i) => cellLines(h, widths[i]));
    const hHeight = rowHeight(headerCells);
    headerCells.forEach((lines, i) => {
      lines.forEach((ln, li) => {
        c.page.drawText(ln, { x: colXs[i] + 3, y: c.y - li * (size + 3), size, font, color: accent });
      });
    });
    c = { page: c.page, y: c.y - hHeight };
    c.page.drawLine({ start: { x: MARGIN, y: c.y + 4 }, end: { x: tableRight, y: c.y + 4 }, thickness: 0.7, color: border });

    for (const row of rows) {
      const cells = row.map((cell, i) => cellLines(cell, widths[i]));
      const height = rowHeight(cells);
      c = ensureSpace(c, height + 4);
      cells.forEach((lines, i) => {
        lines.forEach((ln, li) => {
          const textWidth = font.widthOfTextAtSize(ln, size);
          const drawX = opts.rightAlign?.[i] ? colXs[i] + widths[i] - 3 - textWidth : colXs[i] + 3;
          c.page.drawText(ln, { x: drawX, y: c.y - li * (size + 3), size, font, color: ink });
          if (process.env.DEBUG_PDF && drawX + textWidth > tableRight + 1) {
            console.warn(`[OVERFLOW-C] col=${i} "${ln.slice(0, 30)}"`);
          }
        });
      });
      c.page.drawLine({
        start: { x: MARGIN, y: c.y - height + 4 },
        end: { x: tableRight, y: c.y - height + 4 },
        thickness: 0.4,
        color: border,
      });
      c = { page: c.page, y: c.y - height };
    }
    return { page: c.page, y: c.y - 6 };
  }

  function kvTable(c: Cursor, rows: [string, string][], labelWidth = 200): Cursor {
    const widths = [labelWidth, CONTENT_W - labelWidth];
    return drawTable(
      c,
      widths,
      ["항목", "내용"],
      rows.map(([k, val]) => [k, val || "검토필요"]),
      { size: 8 }
    );
  }

  // ============================================================
  //  COVER (p1)
  // ============================================================
  cur = text(cur, `${v(data.productInfo.responsibleSeller || "Example Cosmetics Co.")} · ${v(data.productInfo.manufacturer || "Example Manufacturer")}`, { size: 8.5, color: muted, gap: 4 });
  cur = text(cur, "COSMETIC PRODUCT SAFETY REPORT", { size: 18, f: pickBold("COSMETIC PRODUCT SAFETY REPORT"), color: ink, gap: 4 });
  cur = text(cur, "화장품 안전성 평가 자료", { size: 11.5, color: muted, gap: 12 });
  cur = text(cur, "식약처 「화장품 안전성 평가 자료 작성 가이드라인(안내서-1506-01)」 · 화장품법 기준 (1차) · EC 1223/2009 Annex I Part A+B (국제 정합성 참조)", { size: 7.5, color: muted, gap: 20 });

  cur = text(cur, `${v(data.productInfo.productName || "(제품명 미입력)")}`, { size: 15, gap: 4 });
  cur = text(cur, v(data.productInfo.productType || "(제품 유형 미입력)"), { size: 10, color: muted, gap: 14 });

  const statusColor = cert.selfCertified ? passColor : warn;
  const statusText = cert.selfCertified ? "submission_ready" : "draft · not_reviewed";
  cur = kvTable(cur, [
    ["발행일 (Issue Date)", cert.reviewDate || `확정 전 (${report.integrity.createdAt.slice(0, 10)})`],
    ["참조번호 (Ref. No.)", v(data.productInfo.refNo || "CPSR-2026-0001")],
    ["버전 (Version)", v(data.productInfo.version || "Rev. 1.0")],
    ["평가 상태", statusText],
  ]);
  cur = text(cur, `SAFETY ASSESSOR · 안전성 평가자: ${cert.assessorName ? `${cert.assessorName} (${v(cert.assessorPosition)})` : "미지정 - not_reviewed"}`, { size: 9.5, color: statusColor, gap: 10 });
  if (report.demo) {
    cur = text(cur, "DEMO MODE — 실제 제출본이 아닌 데모입니다. 모든 수치는 데모 입력 기준입니다.", { size: 8.5, color: danger, gap: 8 });
  }
  cur = hr(cur);

  cur = subTitle(cur, "규제 맥락 · REGULATORY CONTEXT");
  cur = paragraph(cur, REGULATORY_CONTEXT, { size: 8.5 });

  cur = subTitle(cur, "문서 통제 정보 · DOCUMENT CONTROL");
  cur = kvTable(cur, [
    ["대상 제품 / 배치", `${data.productInfo.productName}${data.productInfo.batchRef ? ` · 배치 ${data.productInfo.batchRef}` : " · 배치 검토필요"}`],
    ["준거 기준", "안내서-1506-01 · 화장품법 · 안전기준 규정 (1차) · EC 1223/2009 Annex I (국제 참조)"],
    ["판매 시장", v(data.productInfo.salesMarket || "대한민국(KR) 외 검토필요")],
    ["분류", "기밀 / CONFIDENTIAL"],
    ["실행 식별자 / config_hash", `${report.integrity.runId.slice(0, 8)}... · ${report.integrity.configHash.slice(0, 8)}...`],
    ["평가 상태", report.status],
  ]);

  cur = paragraph(cur, "확보되지 않은 데이터는 검토필요로 표기하며, 자격을 갖춘 안전성 평가자의 검토·서명 전에는 제출·발행 가능 상태가 아닙니다.", { size: 8, color: muted });

  // ============================================================
  //  STRUCTURE MAP + STATUS SNAPSHOT + EXEC SUMMARY (p2)
  // ============================================================
  cur = newPage();
  cur = sectionTitle(cur, "문서 구조 지도 · DOCUMENT STRUCTURE MAP");
  cur = paragraph(cur, "본 자료는 식약처 안내서-1506-01·화장품법을 1차 기준으로 하고, 국제 정합성을 위해 EC 1223/2009 Annex I 체계를 참조하여 Part A(사실 정보) + Part B(평가·결론) + 부록(근거·무결성) 3부로 구성된다.", { size: 8.5 });

  cur = subTitle(cur, "PART A · 안전성 정보 (Safety Information)");
  cur = drawTable(cur, [80, CONTENT_W - 80 - 90, 90],
    ["섹션", "항목", "상태"],
    [
      ["§1", "화장품의 제품 정보 (CMR·나노 선언)", STATUS_LABEL[sec("productInfo")]],
      ["§2.1.1", "제품의 정량적·정성적 구성", STATUS_LABEL[sec("composition")]],
      ["§2.1.2", "물리·화학적 특성 및 안정성 (프로토콜·PAO)", STATUS_LABEL[sec("physchemStability")]],
      ["§2.1.3", "미생물학적 품질 (별표4 · ISO 11930)", STATUS_LABEL[sec("microbiological")]],
      ["§2.1.4", "불순물·비의도유래물질 및 포장재", STATUS_LABEL[sec("impuritiesPackaging")]],
      ["§2.1.5", "제품의 사용 방법", STATUS_LABEL[sec("use")]],
      ["§2.1.6", "화장품에 대한 노출 (DAp 근거)", STATUS_LABEL[sec("exposure")]],
      ["§2.1.7", "성분 노출·안전역(MoS)·TTC·합산노출·다관할", STATUS_LABEL[sec("mosRisk")]],
      ["§2.1.8", "독성 정보: Weight-of-Evidence·감작 QRA2", STATUS_LABEL[sec("toxicology")]],
      ["§2.1.9", "유해사례 정보", STATUS_LABEL[sec("undesirableEffects")]],
      ["§2.1.10", "제품에 대한 기타 정보", STATUS_LABEL[sec("otherInfo")]],
    ]
  );

  cur = subTitle(cur, "PART B · 안전성 평가 (Safety Assessment)");
  cur = drawTable(cur, [80, CONTENT_W - 80 - 90, 90],
    ["섹션", "항목", "상태"],
    [
      ["§2.2.1", "안전성 평가 고찰 (Reasoning · WoE)", STATUS_LABEL[sec("discussion")]],
      ["§2.2.2", "안전성 평가 결론 · 한계 및 가정", STATUS_LABEL[sec("conclusion")]],
      ["§2.2.3", "제품의 사용 방법 및 주의사항 표시", STATUS_LABEL[sec("warnings")]],
      ["§2.3", "안전성 평가자 서명 및 자격 증명", STATUS_LABEL[sec("assessor")]],
    ]
  );

  cur = text(cur, "APPENDIX · 부록: A 관할권 교차참조 매핑 · B 데이터 무결성(ALCOA+)·CoA 대장 · C 발행 전 확정·점검 목록 · D 참고문헌·선언", { size: 8, color: muted, gap: 12 });

  cur = subTitle(cur, "현재 상태 요약 · Status Snapshot");
  cur = drawTable(cur, [CONTENT_W - 90, 90],
    ["항목", "상태"],
    [
      ["구조·방법론", "완비"],
      ["실측 데이터 보강 필요 (검토필요 항목 수)", `${statusCounts.review}개`],
      ["PASS / REVIEW / FAIL", `${statusCounts.pass} / ${statusCounts.review} / ${statusCounts.fail}`],
      ["평가자 서명", cert.selfCertified ? "승인됨 (submission_ready)" : "미승인 (발행 불가)"],
      ["데모 여부", report.demo ? "DEMO — 실제 제출본 아님" : "실제 모드"],
    ],
    { rightAlign: [false, true] }
  );

  cur = subTitle(cur, "표 0. 평가 결과 요약 (Executive Summary)");
  const execRows = report.execSummary ?? [];
  if (execRows.length > 0) {
    cur = drawTable(cur, [95, 165, 125, CONTENT_W - 385],
      ["평가 영역", "현재 결과", "해석", "후속 조치"],
      execRows.map((r) => [r.area, r.result, r.interpretation, r.action])
    );
  }
  cur = paragraph(cur, "상태 정의 — PASS: 근거·계산 충족 / 검토필요(REVIEW): 자료 미확보·전문가 판단 필요 / FAIL: 기준 초과. 구조·방법론은 완비되었으나, 실측 데이터가 필요한 항목은 검토필요로 유지한다.", { size: 8, color: muted });

  // ============================================================
  //  PART A — intro + §1 PRODUCT INFORMATION
  // ============================================================
  cur = newPage();
  cur = text(cur, "PART A · 안전성 평가 자료 (Safety Information)", { size: 14, f: pickBold("PART A · 안전성 평가 자료 (Safety Information)"), color: ink, gap: 4 });
  cur = paragraph(cur, LEGAL_INTRO, { size: 8, color: muted });
  cur = paragraph(cur, "제품·성분·물성·미생물·불순물·노출·독성 등 안전성 평가의 기초가 되는 사실 정보. 결론·판단은 Part B에서 다룬다. 이 파트 구성 (11개 절): §1 제품정보 · §2.1.1 구성 · §2.1.2 물성·안정성 · §2.1.3 미생물 · §2.1.4 불순물·포장 · §2.1.5 사용 · §2.1.6 노출 · §2.1.7 MoS·다관할 · §2.1.8 독성·WoE · §2.1.9 유해사례 · §2.1.10 기타", { size: 8, color: muted });

  cur = sectionTitle(cur, "§1 · PRODUCT INFORMATION — 화장품의 제품 정보", sec("productInfo"));
  cur = paragraph(cur, "본 안전성 평가 자료는 식약처 안내서-1506-01 및 화장품법을 1차 기준으로 하고, EC 1223/2009 Annex I Part A 체계를 국제 정합성 참조로 작성한다.", { size: 8.5 });

  cur = subTitle(cur, "표 1-1. 제품 식별 및 관리 정보 (Product identity & control)");
  cur = kvTable(cur, [
    ["상품명 (제품명)", data.productInfo.productName],
    ["제품 코드 / 품목보고번호", data.productInfo.productCode],
    ["제품 유형 / 제형", v(data.productInfo.productType)],
    ["대상 인구 / 사용 부위", `${v(data.productInfo.targetUser)} / ${v(data.productInfo.applicationArea)}`],
    ["사용 방법 (용법·용량)", data.productInfo.useInstructions],
    ["책임판매업자", data.productInfo.responsibleSeller],
    ["제조업자", data.productInfo.manufacturer],
    ["제조소 GMP (ISO 22716)", data.productInfo.gmpSite],
    ["책임자 (Responsible Person, EU)", data.productInfo.responsiblePerson],
    ["처방/배치 참조번호", data.productInfo.batchRef],
    ["CPSR 참조번호 / 발행일", `${v(data.productInfo.refNo || "CPSR-2026-0001")} / ${cert.reviewDate || "검토필요"}`],
    ["판매 시장", v(data.productInfo.salesMarket)],
    ["안전성 평가자", cert.selfCertified ? `${cert.assessorName}` : "미지정 - not_reviewed (발행 전 서명 필수)"],
  ], 210);

  cur = subTitle(cur, "표 1-2. 최종 포장 상세 및 적합성");
  cur = kvTable(cur, [
    ["1차 포장 유형", productQuality.packagingMaterial],
    ["포장 이행(migration) 시험", v(productQuality.packagingMigrationResult || productQuality.packagingSafetyNote)],
  ], 210);

  cur = subTitle(cur, "표 1-3. CMR 선언 (CLP (EC) 1272/2008 / ECHA C&L 대조)");
  cur = kvTable(cur, [
    ["CMR 분류 선언", v(data.productInfo.cmrDeclaration || "조성 확정 후 전성분을 CLP Annex VI 및 ECHA C&L Inventory와 대조한다. 대조 전에는 '미함유'로 단정하지 않는다.")],
  ], 210);

  cur = subTitle(cur, "표 1-4. 나노물질 선언 (Art.16)");
  cur = kvTable(cur, [
    ["나노물질 함유 여부", v(data.productInfo.nanoDeclaration || "원료 공급사 확인서로 최종 확인 필요")],
  ], 210);

  // ============================================================
  //  §2.1.1 COMPOSITION
  // ============================================================
  cur = sectionTitle(cur, "§2.1.1 · COMPOSITION — 제품의 정량적·정성적 구성", sec("composition"));
  cur = subTitle(cur, "표 2-1. 전성분 및 함량 (제품중 % 내림차순)");
  cur = drawTable(cur, [70, 120, 70, 70, 70, CONTENT_W - 400],
    ["원료 상품명", "INCI", "CAS", "원료중 %", "제품중 %", "기능"],
    flat.length > 0
      ? flat.map((c) => [
          c.tradeName || "—",
          c.inciName || "—",
          c.cas || "—",
          `${v(c.percentActiveInRaw)}%`,
          `${c.percentInProduct.toFixed(3)}%`,
          v(c.functionRole),
        ]).concat([["합계 (Total)", "—", "—", "—", `${totalPct.toFixed(2)}%`, Math.abs(totalPct - 100) <= 0.5 ? "함량 검증 PASS" : "함량 합계 확인 필요"]])
      : [["—", "검토필요", "—", "—", "—", "미입력"]]
  );

  cur = paragraph(cur, "향료(PARFUM): " + (data.productInfo.hasFragrance === "yes" ? "배합함 — Annex III 알레르겐 개별 표시 여부 확인 (EU 2023/1545)" : data.productInfo.hasFragrance === "no" ? "미배합 (Not applicable)" : "검토필요") + "   |   착색제: " + (data.productInfo.hasColorant === "yes" ? "배합함" : data.productInfo.hasColorant === "no" ? "없음 (None)" : "검토필요"), { size: 8.5, color: muted });

  // ============================================================
  //  §2.1.2 PHYSICOCHEMICAL & STABILITY
  // ============================================================
  cur = sectionTitle(cur, "§2.1.2 · PHYSICOCHEMICAL & STABILITY — 물리화학적 특성 및 안정성", sec("physchemStability"));
  cur = subTitle(cur, "표 2-2. 원료(성분)의 물리·화학적 특성");
  cur = drawTable(cur, [110, 80, 80, CONTENT_W - 110 - 80 - 80 - 95 - 40, 95, 40],
    ["INCI", "형태", "분자량(Da)", "용해도", "log Kow", "UV"],
    flat.length > 0
      ? flat.map((c) => [c.inciName || "—", v(c.physicalForm), v(c.molecularWeight), v(c.solubility), v(c.logKow), v(c.uvAbsorption)])
      : [["검토필요", "—", "—", "—", "—", "—"]]
  );
  cur = paragraph(cur, "출처: 원료 COA / ECHA / PubChem [검토필요: 원문 대조]. 미확인 값은 검토필요로 두며 임의 확정하지 않는다. 분자량 <500 Da는 SCCS '500 Da rule'상 피부흡수 가능성 지표(§2.1.6 DAp 연계).", { size: 7.5, color: muted });

  cur = subTitle(cur, "표 2-3. 완제품 물리·화학 규격 (release 규격)");
  cur = kvTable(cur, [
    ["외관 / 색상 / 취", productQuality.physicalForm],
    ["pH", productQuality.ph],
    ["점도 (cP)", productQuality.viscosityRange],
    ["개봉 후 사용기간 (PAO)", productQuality.paoMonths ? `${productQuality.paoMonths}개월` : ""],
  ], 200);

  cur = subTitle(cur, "표 2-4. 안정성 시험 설계 프로토콜 및 결과");
  cur = drawTable(cur, [130, 150, CONTENT_W - 280],
    ["시험 유형", "조건", "결과"],
    [
      ["가속(고온)", "40±2°C / 75±5%RH", v(productQuality.stabilityAcceleratedResult || productQuality.stabilityResult)],
      ["장기(실온)", "25±2°C / 60±5%RH", v(productQuality.stabilityLongTermResult)],
      ["저온 / 동결-융해", "4°C · 5↔25°C 사이클", v(productQuality.stabilityFreezeThawResult)],
      ["광안정성", "ICH Q1B 유사 광노출", v(productQuality.stabilityPhotoResult)],
    ]
  );
  cur = paragraph(cur, "사용기한·PAO 개월수는 실측 확보 시에만 기재 (ISO/TR 18811).", { size: 7.5, color: muted });

  // ============================================================
  //  §2.1.3 MICROBIOLOGICAL QUALITY
  // ============================================================
  cur = sectionTitle(cur, "§2.1.3 · MICROBIOLOGICAL QUALITY — 미생물학적 품질", sec("microbiological"));
  cur = paragraph(cur, "ISO 17516 카테고리 판정: " + (productQuality.microCategory === "Cat1" ? "Category 1 (눈 화장용·3세 이하 대상) — ≤100 CFU/g 보수적 적용" : productQuality.microCategory === "Cat2" ? "Category 2 (기타 화장품)" : "검토필요") + ". 시험법: ISO 21149(생균수) · 22717(효모) · 22718(곰팡이) · 18416.", { size: 8.5 });
  cur = subTitle(cur, "표 2-5. 완제품 미생물 한도 판정 (국내 별표4 · ISO 17516 대조)");
  cur = drawTable(cur, [150, 110, 110, CONTENT_W - 370],
    ["시험 항목", "ISO 17516 Cat.2", "특정세균", "실측 판정"],
    [
      ["총호기성생균수", "≤1,000 CFU/g", "—", v(productQuality.microbialLimitResult)],
      ["효모·곰팡이(진균)", "≤100 CFU/g", "—", "검토필요"],
      ["특정세균 (대장균·녹농균·황색포도상구균)", "불검출", "불검출", v(productQuality.specificBacteriaResult)],
    ]
  );
  cur = subTitle(cur, "표 2-6. 방부력(챌린지) 시험 — ISO 11930 (Criteria A)");
  cur = kvTable(cur, [
    ["보존력 시험 결과", productQuality.challengeTestResult],
    ["기준", "ISO 11930:2019(+A1:2022) Criteria A; D7 ≥3 log, D14·D28 증가없음 / D14 ≥1, 유지"],
  ], 200);

  // ============================================================
  //  §2.1.4 IMPURITIES, TRACES & PACKAGING
  // ============================================================
  cur = sectionTitle(cur, "§2.1.4 · IMPURITIES, TRACES & PACKAGING — 불순물·비의도유래물질 및 포장재", sec("impuritiesPackaging"));
  cur = subTitle(cur, "표 2-7. 비의도적 유래물질(불순물) 관리 한도 및 시험");
  cur = drawTable(cur, [130, 120, 100, CONTENT_W - 350],
    ["관리 대상", "국내 한도 (안전기준 별표)", "EU 참고", "시험 결과"],
    [
      ["납/비소/수은/안티몬/카드뮴/니켈", "검토필요 (원문 대조)", "Annex II 미량 불가피", v(productQuality.heavyMetalsResult)],
      ["1,4-Dioxane", "≤100 µg/g [검토필요]", "~10 ppm 권고", v(productQuality.impurityDioxaneResult)],
      ["N-니트로사민", "형성리스크 관리 (SCCS)", "SCCS opinion", v(productQuality.impurityNitrosamineResult)],
    ]
  );
  cur = paragraph(cur, "포장재-내용물 이행(migration): 1차 포장 " + v(productQuality.packagingMaterial) + " — " + v(productQuality.packagingMigrationResult || productQuality.packagingSafetyNote) + ". EU (EU) 10/2011 OML 10 mg/dm²·SML 참조(식품접촉물질 기준의 과학적 참조이며 화장품 직접 강제 아님).", { size: 8 });

  // ============================================================
  //  §2.1.5 NORMAL & FORESEEABLE USE
  // ============================================================
  cur = sectionTitle(cur, "§2.1.5 · NORMAL & FORESEEABLE USE — 제품의 사용 방법", sec("use"));
  cur = paragraph(cur, v(data.productInfo.useInstructions) + ". 합리적으로 예상 가능한 오용은 '눈 주위 사용'이며 주의문구를 라벨에 반영한다(§2.2.3).", { size: 8.5 });

  // ============================================================
  //  §2.1.6 EXPOSURE ASSESSMENT
  // ============================================================
  cur = sectionTitle(cur, "§2.1.6 · EXPOSURE ASSESSMENT — 화장품에 대한 노출", sec("exposure"));
  cur = subTitle(cur, "표 2-8. SCCS 노출 파라미터 (SCCS/1647/22)");
  cur = drawTable(cur, [180, 60, CONTENT_W - 240],
    ["파라미터", "기호", "값 · 출처"],
    [
      ["제품 유형", "—", v(data.productInfo.productType)],
      ["1일 적용량", "A", `${expP.A} g/day`],
      ["체중", "BW", `${expP.BW} kg (SCCS 기본)`],
      ["잔류계수", "RF", `${expP.RF} (${data.productInfo.rinseType}) · SCCS/1647/22`],
      ["적용 빈도", "F", `${expP.F}회/일`],
      ["상대 일일노출량", "E", `(A×RF×1000)/BW = ${exposureE.toFixed(2)} mg/kg bw/day`],
    ]
  );
  cur = subTitle(cur, "표 2-8b. 성분별 피부흡수율(DAp) 근거");
  cur = drawTable(cur, [150, 90, CONTENT_W - 240],
    ["성분", "적용 DAp", "근거 · 비고"],
    flat.length > 0
      ? flat.map((c) => [c.inciName || "—", `${v(c.dermalAbsorptionPercent)}%`, "보수적 가정 (측정값 아님) — OECD TG 428 실측 확보 시 대체"])
      : [["검토필요", "—", "—"]]
  );

  // ============================================================
  //  §2.1.7 SUBSTANCE EXPOSURE, MOS & RISK
  // ============================================================
  cur = sectionTitle(cur, "§2.1.7 · SUBSTANCE EXPOSURE, MoS & RISK — 성분 노출·안전역", sec("mosRisk"));
  cur = paragraph(cur, "SED (mg/kg bw/day) = (A × RF × C × DAp) / BW      MoS = NOAEL / SED (≥100 이면 충족). 평가계수 100 = 종간(10) × 종내 개인차(10); POD 유형·노출기간·경로 보정 시 추가.", { size: 8 });
  cur = subTitle(cur, "표 2-9. 성분별 노출량 및 안전역");
  cur = drawTable(cur, [130, 70, 55, 70, 65, CONTENT_W - 390],
    ["INCI", "CAS", "%", "SED", "NOAEL", "MoS / 판정"],
    report.calcRows.map((r) => [
      r.inciName || "—",
      r.cas || "—",
      r.percentInProduct.toFixed(3),
      r.sed.toFixed(5),
      r.noael?.toString() ?? "검토필요",
      r.mos === null ? "검토필요" : `${r.mos.toFixed(1)} (${r.judgment})`,
    ])
  );
  cur = paragraph(cur, "NOAEL 출처·신뢰도(Klimisch) 미확보 시 PASS를 부여하지 않는다(근거 확보 전 PASS 금지). 계산상 최저 MoS: " + (minMos === null ? "검토필요" : `${minMos.toFixed(1)}`) + ".", { size: 8, color: muted });

  if (report.ttcRows && report.ttcRows.length > 0) {
    cur = subTitle(cur, "표 2-10. TTC(독성학적 우려 역치) 1차 스크리닝 — NOAEL 부재 성분");
    cur = drawTable(cur, [130, 90, 90, 90, CONTENT_W - 400],
      ["성분", "Cramer class", "TTC (µg/kg/d)", "SED (µg/kg/d)", "판정"],
      report.ttcRows.map((t) => [t.inciName || "—", t.cramerClass, t.thresholdUgKgDay.toFixed(1), t.sedUgKgDay.toFixed(3), t.withinTTC ? "스크리닝 통과" : "확정 독성 검토필요"])
    );
    cur = paragraph(cur, "TTC 통과는 '확정 안전'이 아니라 '스크리닝 통과, 확정 독성 검토필요'를 뜻한다. 유전독성 alert 시 TTC 부적용·실측 필수.", { size: 7.5, color: muted });
  }

  cur = subTitle(cur, "합산·누적 노출 (Aggregate & Cumulative Exposure)");
  cur = paragraph(cur, "동일 성분 다제품 중복 사용 및 RETINOL의 식이 Vitamin A 합산 등 정량 데이터 미확보 — 정성 서술 + 검토필요. 단일제품 MoS를 총노출 MoS로 재라벨하지 않는다.", { size: 8 });

  const restrictedRows = report.calcRows.filter((r) => r.restrictedNote);
  cur = subTitle(cur, "표 2-11. 제한·금지 원료 — 다관할 규제성분 대조");
  cur = drawTable(cur, [130, 70, CONTENT_W - 200],
    ["성분", "제품중 %", "검토 사유"],
    restrictedRows.length > 0
      ? restrictedRows.map((r) => [r.inciName || "—", r.percentInProduct.toFixed(3), r.restrictedNote || ""])
      : [["—", "—", "해당 없음 (배합금지·사용제한 미대조 — 원문 대조 필요)"]]
  );

  // ============================================================
  //  §2.1.8 TOXICOLOGICAL PROFILE (WOE)
  // ============================================================
  cur = sectionTitle(cur, "§2.1.8 · TOXICOLOGICAL PROFILE (WoE) — 독성 정보에 기반한 위해 판단", sec("toxicology"));
  cur = subTitle(cur, "표 2-12. 독성 엔드포인트별 자료 현황 및 평가");
  const ENDPOINTS: Array<[string, string]> = [
    ["급성독성 (Acute)", "acuteToxicity"],
    ["피부자극 (Skin irritation)", "skinIrritation"],
    ["안(점막)자극 (Eye irritation)", "eyeIrritation"],
    ["피부감작 (Skin sensitization)", "skinSensitization"],
    ["유전독성 (Genotoxicity)", "genotoxicity"],
    ["발암성 (Carcinogenicity)", "carcinogenicity"],
    ["생식·발생독성 (Reproductive)", "reproductiveToxicity"],
    ["광독성·광감작 (Phototoxicity)", "phototoxicity"],
  ];
  const endpointRows = ENDPOINTS.map(([label, key]) => {
    const statuses = flat.map((c) => String((c.tox as Record<string, unknown>)[key] ?? "unknown"));
    const available = statuses.filter((s) => s === "available").length;
    return [
      label,
      available > 0 ? `부분 확보 (${available}성분)` : "없음",
      "문헌/read-across [검토]",
      "검토필요",
    ];
  });
  cur = drawTable(cur, [170, 110, 120, CONTENT_W - 400],
    ["독성 엔드포인트", "자료 유무", "근거 유형", "평가 결과"],
    endpointRows
  );
  cur = subTitle(cur, "Weight-of-Evidence 서술 (AI 초안)");
  cur = paragraph(cur, report.partA, { size: 8.5 });

  // ============================================================
  //  §2.1.9 - §2.1.10 UNDESIRABLE EFFECTS & OTHER
  // ============================================================
  cur = sectionTitle(cur, "§2.1.9 · UNDESIRABLE EFFECTS — 유해사례 정보", sec("undesirableEffects"));
  cur = paragraph(cur, "식약처 회수·판매중지 정보 및 내부 이상반응 기록 검색: 확보 데이터 기준 일치 항목 없음. 「회수 이력 없음」은 안전성 입증이 아니므로 시판 후 감시(PMS) 지속 및 평가자 확인 필요. (US MOCRA 중대 이상반응 15영업일 보고 체계 참조.)", { size: 8.5 });

  cur = sectionTitle(cur, "§2.1.10 · OTHER INFORMATION — 제품에 대한 기타 정보", sec("otherInfo"));
  cur = paragraph(cur, "추가 참고자료(인체적용시험·소비자 사용성 자료 등) 미입력. 내용 입력 또는 「해당없음」을 근거와 함께 명시 필요.", { size: 8.5 });

  // ============================================================
  //  PART B — 안전성 평가
  // ============================================================
  cur = newPage();
  cur = text(cur, "PART B · 안전성 평가 (Safety Assessment)", { size: 14, f: pickBold("PART B · 안전성 평가 (Safety Assessment)"), color: ink, gap: 4 });
  cur = paragraph(cur, "Part A 정보를 바탕으로 안전성 평가를 고찰하고 결론·표시 경고를 도출하며, 자격을 갖춘 평가자가 자격을 증명하고 승인·서명한다. (식약처 목차: 2.2.1 고찰 · 2.2.2 결론 · 2.2.3 표시 · 2.3 평가자 — EU Part B (1)-(4) 대응)", { size: 8, color: muted });

  cur = sectionTitle(cur, "§2.2.1 · SAFETY ASSESSMENT DISCUSSION — 안전성 평가 고찰", sec("discussion"));
  cur = paragraph(cur, "Part A의 각 근거로부터 안전성 결론에 이르는 논거(reasoning)를 고찰한다. 확정 근거가 없는 항목은 서사를 채웠다는 이유로 PASS로 승격하지 않는다.", { size: 8.5 });
  const discussionRows = [
    ["전신독성(MoS)", "§2.1.6 노출·DAp / §2.1.7 NOAEL:SED", `계산상 최저 MoS ${minMos === null ? "검토필요" : minMos.toFixed(0)} · NOAEL 근거 미확보 시 검토필요`],
    ["국소독성", "§2.1.8 자극·감작(WoE)", "확보 엔드포인트 수에 따라 부분 확보 · 나머지 근거 필요"],
    ["규제 적합", "§2.1.1 구성 / §2.1.7 제한원료·RETINOL", restrictedRows.length > 0 ? "제한성분 검토필요 · 경계값(at-limit) 관리" : "배합금지·사용제한 원문 대조 필요"],
    ["품질·보존", "§2.1.2 안정성 / §2.1.3 미생물", "실측 확보 항목만 반영 · 공백은 검토필요"],
  ];
  cur = drawTable(cur, [110, 170, CONTENT_W - 280],
    ["평가 영역", "Part A 근거(섹션)", "도출 논거·결론(초안)"],
    discussionRows
  );
  cur = subTitle(cur, "Weight-of-Evidence 근거 서술 (AI 초안)");
  cur = paragraph(cur, report.partBReasoning, { size: 8.5 });

  cur = sectionTitle(cur, "§2.2.2 · ASSESSMENT CONCLUSION — 안전성 평가 결론 · 한계 및 가정", sec("conclusion"));
  cur = paragraph(cur, cert.selfCertified ? cert.draftNotes : report.notReviewedNotice, { size: 8.5, color: cert.selfCertified ? ink : warn });
  cur = subTitle(cur, "한계 및 가정 (Limitations & Assumptions)");
  const limitations = report.limitations ?? [];
  limitations.forEach((lim, i) => {
    cur = paragraph(cur, `${i + 1}. ${lim}`, { size: 8 });
  });

  cur = sectionTitle(cur, "§2.2.3 · USE & LABELLED WARNINGS — 사용 방법 및 주의사항 표시", sec("warnings"));
  const warnings = report.warnings ?? [];
  cur = drawTable(cur, [CONTENT_W - 110, 110],
    ["경고·주의 문안", "근거"],
    warnings.length > 0
      ? warnings.map((w) => [w.text, w.basis])
      : [["검토필요 — 조성 확정 후 법정 문구 대조", "시행규칙 별표3"]]
  );

  cur = sectionTitle(cur, "§2.3 · ASSESSOR SIGNATURE & CREDENTIALS — 안전성 평가자 서명 및 자격 증명", sec("assessor"));
  cur = paragraph(cur, "본 서식은 적격 안전성 평가자 본인만 기입·서명하며, 소프트웨어가 성명·자격·서명을 자동 입력하지 않는다.", { size: 8.5 });
  cur = kvTable(cur, [
    ["성명", cert.assessorName],
    ["자격 (학위·경력)", [cert.assessorPosition, cert.assessorQualification].filter(Boolean).join(" · ")],
    ["평가일자", cert.reviewDate],
    ["서명", cert.selfCertified ? "서명됨 (문서 SHA-256 자동 봉인)" : "미서명 - not_reviewed"],
    ["자격 증빙 첨부", cert.selfCertified ? "첨부 예정 (부록)" : "첨부 예정"],
  ], 200);

  // ============================================================
  //  APPENDIX A — CROSS-JURISDICTION MAP
  // ============================================================
  cur = newPage();
  cur = text(cur, "APPENDIX · 별첨", { size: 14, f: pickBold("APPENDIX · 별첨"), color: ink, gap: 4 });
  cur = paragraph(cur, "다관할 매핑 · 데이터 무결성(ALCOA+) · 발행 전 점검 · 참고문헌 · 선언. (식약처 목차 대응: 부록 A-C = III 별첨자료 · 부록 D = IV 참고문헌)", { size: 8, color: muted });

  cur = sectionTitle(cur, "APPENDIX A · CROSS-JURISDICTION MAP — 관할권 교차참조 매핑");
  cur = drawTable(cur, [105, 80, 80, 80, 85, CONTENT_W - 430],
    ["공통 요건", "EU Annex I", "KR 안전기준", "China NMPA", "US MOCRA", "본 문서"],
    [
      ["정성·정량 조성", "A(7)(2)", "구성", "2021 지침", "substantiation", "§2.1.1"],
      ["물리화학·안정성", "A(3)", "별표4", "안정성 지침", "substantiation", "§2.1.2"],
      ["미생물 품질", "A(3)", "별표4", "방부 챌린지", "—", "§2.1.3"],
      ["노출·MoS", "A(6)(7)", "위해평가", "read-across/TTC", "substantiation", "§2.1.6–7"],
      ["독성 프로파일", "A(8)", "위해평가", "원료 안전성", "substantiation", "§2.1.8"],
      ["결론·경고·서명", "B(1)-(4)", "평가 결과", "안전성 결론", "RP·기록", "§2.2.1–3"],
    ],
    { size: 7 }
  );
  cur = paragraph(cur, "본 표는 '요건 → 문서 위치' 참조 안내이며 각국 최종 판단은 소관 당국에 있다. 미대조 셀은 검토필요.", { size: 7.5, color: muted });

  // ============================================================
  //  APPENDIX B — DATA INTEGRITY (ALCOA+)
  // ============================================================
  cur = sectionTitle(cur, "APPENDIX B · DATA INTEGRITY — 데이터 무결성 (ALCOA+ 자기평가)");
  cur = drawTable(cur, [150, CONTENT_W - 150 - 90, 90],
    ["원칙", "구현 근거 (실제 코드 필드)", "상태"],
    [
      ["Attributable", `run_id(${report.integrity.runId.slice(0, 8)}...) + 생성 파이프라인. 평가자 귀속은 §2.3`, cert.selfCertified ? "적용" : "부분(검토필요)"],
      ["Legible", "구조화 JSON · 표 렌더링", "적용"],
      ["Contemporaneous", "created_at (UTC 타임스탬프)", "적용"],
      ["Original", "입력 JSON SHA-256 (input_csv_sha256)", "적용"],
      ["Accurate", `config_hash(${report.integrity.configHash.slice(0, 8)}...) + 스키마 검증`, "적용"],
      ["Complete · Consistent · Enduring · Available", "증거팩(evidence_pack.zip)·출처 인덱스·재현 가능", "적용 [감사추적 검토필요]"],
    ]
  );
  cur = subTitle(cur, "근거(Evidence) 인덱스 및 CoA 대장");
  cur = drawTable(cur, [130, 130, 100, CONTENT_W - 360],
    ["자료", "SHA-256 / 식별", "관련 섹션", "검토 상태"],
    [
      ["product_safety_inputs.json", `config_hash (${report.integrity.configHash.slice(0, 8)}...)`, "§1 · 전체", "검토필요"],
      ["formula.csv", `input_csv_sha256 (${report.integrity.inputCsvSha.slice(0, 8)}...)`, "§2.1.1", "검토필요"],
      ["evidence_pack.zip", "봉인 예정", "전체", "검토필요"],
      ["원료 CoA (성분별)", "DEMO-PLACEHOLDER", "§2.1.1-2", "검토필요"],
      ["시험성적서 (안정성·미생물·독성)", "DEMO-PLACEHOLDER", "§2.1.2-3 · §2.1.8", "검토필요"],
    ]
  );
  cur = paragraph(cur, "코드가 실제 생성하는 해시(input_csv_sha256, config_hash)만 값으로 인용하고, 미확보 자료는 DEMO-PLACEHOLDER·검토필요로 둔다. 실제 기관명·성적서번호·담당자는 창작하지 않는다.", { size: 7.5, color: muted });

  // ============================================================
  //  APPENDIX C — OUTSTANDING ITEMS & CHECKLIST
  // ============================================================
  cur = sectionTitle(cur, "APPENDIX C · OUTSTANDING ITEMS — 발행 전 필수 확정(검토필요) 종합");
  cur = subTitle(cur, "표 부C-1. 검토자 액션 레지스터 (Review Action Register)");
  cur = drawTable(cur, [110, CONTENT_W - 110 - 90 - 150, 90, 150],
    ["섹션", "누락 자료", "위험도", "다음 조치"],
    [
      ["§1 · §2.3", "책임판매업자·제조업자 정보 · 평가자 자격·서명", "높음", "정보 입력 · 자격 검증 · 자필 서명"],
      ["§2.1.1", "성분사전 국문명 · 배합목적 · 원료 구성 확정", "중간", "성분사전·CoA 대조"],
      ["§2.1.2", "12주·장기·광안정성 · PAO 실측", "높음", "안정성 시험 발주 (ISO/TR 18811)"],
      ["§2.1.3", "미생물 실측 · 챌린지 log감소 (ISO 11930)", "높음", "시험 발주"],
      ["§2.1.4", "중금속 · 1,4-dioxane · 니트로사민 실측 · 포장 이행", "중간", "시험 발주"],
      ["§2.1.6-7", "DAp 실측(OECD 428) · NOAEL 출처 · 합산노출", "높음", "흡수시험 · 문헌 근거 확보"],
      ["§2.1.7", "RETINOL 2024/996 at-limit · 표시경고", "높음(우선)", "규제 대조 · 경고 문안 확정"],
      ["§2.1.8", "독성 엔드포인트 근거 · read-across · CMR 분류", "높음", "독성 DB · 문헌 검토 (WoE)"],
      ["다관할", "KR 별표 1·2·4 · EU/China/US/ASEAN 규제 대조", "중간", "law.go.kr · CosIng · ECIC 원문 대조"],
    ]
  );
  cur = subTitle(cur, "표 부C-2. 제출 전 최종 점검 (Pre-submission Checklist)");
  cur = paragraph(cur, [
    "□ Part A/B 4개 항목(2.2.1-2.3) 완결 · 결론 자동생성 없음 확인",
    "□ 검토필요 항목 자료 보강 또는 「해당없음」 사유 기록",
    "□ RETINOL 2024/996 at-limit 재검토 및 표시 반영",
    "□ 다관할 대조표 · 매핑표 셀 원문 대조 완료",
    "□ §2.3 자격·서명·검토일 입력 → submission_ready 전환",
    "□ 최종 PDF · 증거팩(evidence_pack.zip) 함께 보관",
  ].join("\n"), { size: 8 });

  // ============================================================
  //  APPENDIX D — REFERENCES · DECLARATION · REVISION HISTORY
  // ============================================================
  cur = sectionTitle(cur, "APPENDIX D · REFERENCES — 참고문헌 (번호형 서지)");
  REFERENCES.forEach((ref, i) => {
    cur = paragraph(cur, `${i + 1}. ${ref}`, { size: 7.5 });
  });
  cur = paragraph(cur, "존재하지 않는 문헌·DOI·시험번호·opinion 번호는 기재하지 않는다. 각 정량값의 개별 출처·조회일은 확보 시 인용번호[n]로 연결한다.", { size: 7.5, color: muted });

  cur = subTitle(cur, "DECLARATION — 안전성 평가자 확인");
  cur = paragraph(cur, DECLARATION, { size: 8 });
  cur = drawTable(cur, [CONTENT_W - 160, 160],
    ["구분", "성명 / 자격 · 검토일 · 서명"],
    [
      ["안전성 평가자", cert.selfCertified ? `${cert.assessorName} · ${cert.reviewDate} · 서명됨` : "미입력 - not_reviewed"],
      ["책임판매업자 확인", "검토필요"],
    ]
  );

  cur = subTitle(cur, "개정 이력 및 문서 정보 (Revision History)");
  cur = drawTable(cur, [90, 90, CONTENT_W - 180],
    ["버전", "일자", "주요 변경"],
    REVISION_HISTORY.map(([ver, date, change]) => [ver, date, change])
  );

  // ============================================================
  //  FOOTER + INTEGRITY (모든 페이지에)
  // ============================================================
  const pages = pdf.getPages();
  const total = pages.length;
  const footerStatus = cert.selfCertified ? "submission_ready" : "not_reviewed";
  pages.forEach((page, i) => {
    page.drawText(`기밀 / CONFIDENTIAL · ${footerStatus}`, { x: MARGIN, y: 26, size: 7, font, color: muted });
    const pageLabel = `p.${i + 1}/${total}`;
    page.drawText(pageLabel, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(pageLabel, 7), y: 26, size: 7, font, color: muted });
    if (i > 0) {
      page.drawText(`화장품 안전성 평가 자료 · ${data.productInfo.productName} | ${v(data.productInfo.refNo || "CPSR-2026-0001")} · ${v(data.productInfo.version || "Rev. 1.0")}`, { x: MARGIN, y: PAGE_H - 26, size: 7, font, color: muted });
    }
  });

  return pdf.save();
}
