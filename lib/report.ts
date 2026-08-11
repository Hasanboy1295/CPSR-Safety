// Hamma narsani birlashtiruvchi orkestratsiya — diagrammadagi
// 1(Hisob-kitob) -> 2(RAG) -> 3(LLM) -> 7(Data Integrity) qadamlari.
// Bu — "real yo'l"ning to'liq amalga oshirilishi.

import type { ProductInfo, IngredientRow, ExposureParams, ProductQuality, Certification } from "./wizard-types";
import { flattenIngredients } from "./wizard-types";
import { calcSED, calcMoS, calcRelativeDailyExposure, judge, type CalcRow } from "./calc";
import { checkRestricted } from "./restricted-list";
import { ttcScreen, type CramerClass } from "./ttc";
import { retrieveChunks, hasRealCredentials, type RetrievedChunk } from "./rag";
import { draftCPSRSections } from "./llm";
import { mockDraftCPSRSections } from "./mock";
import { stampIntegrity, type IntegrityStamp } from "./integrity";
import type { Lang } from "./i18n";

/** Kitob bo'limlarining holati: PASS / 검토필요(REVIEW) / FAIL (표 0 status ta'rifi). */
export type ReportSectionStatus = "pass" | "review" | "fail";

/** Kitobning 21 betlik tuzilmasidagi barcha baholanadigan bo'limlar. */
export type ReportSections = {
  productInfo: ReportSectionStatus; // §1
  composition: ReportSectionStatus; // §2.1.1
  physchemStability: ReportSectionStatus; // §2.1.2
  microbiological: ReportSectionStatus; // §2.1.3
  impuritiesPackaging: ReportSectionStatus; // §2.1.4
  use: ReportSectionStatus; // §2.1.5
  exposure: ReportSectionStatus; // §2.1.6
  mosRisk: ReportSectionStatus; // §2.1.7
  toxicology: ReportSectionStatus; // §2.1.8
  undesirableEffects: ReportSectionStatus; // §2.1.9
  otherInfo: ReportSectionStatus; // §2.1.10
  discussion: ReportSectionStatus; // §2.2.1
  conclusion: ReportSectionStatus; // §2.2.2
  warnings: ReportSectionStatus; // §2.2.3
  assessor: ReportSectionStatus; // §2.3
};

export type TTCScreenRow = {
  inciName: string;
  cas: string;
  cramerClass: CramerClass;
  sedUgKgDay: number;
  thresholdUgKgDay: number;
  withinTTC: boolean;
};

export type WarningItem = {
  text: string;
  basis: string;
};

export type ExecSummaryRow = {
  area: string;
  result: string;
  interpretation: string;
  action: string;
};

export type ReportStatusCounts = { pass: number; review: number; fail: number };

export type CPSRReportDraft = {
  status: "draft_generated"; // CPSR_KR_dossier'dagi haqiqiy status qiymati
  calcRows: CalcRow[];
  partA: string;
  partBReasoning: string;
  model: string;
  demo: boolean;
  sources: RetrievedChunk[];
  integrity: IntegrityStamp;
  notReviewedNotice: string;
  // Kitobning qo'shimcha hosilaviy ma'lumotlari (PDF'da ko'rsatiladi)
  exposureE: number; // §2.1.6 표 2-8 — E = (A×RF×1000)/BW
  exposureParams: { A: number; RF: number; BW: number; F: number };
  ttcRows: TTCScreenRow[]; // §2.1.7 표 2-10 — NOAEL bo'lmaganlar uchun TTC
  minMos: number | null; // eng past MoS (agar hammasi bo'lsa)
  sections: ReportSections; // har bir bo'lim statusi
  statusCounts: ReportStatusCounts; // PASS/REVIEW/FAIL soni (표 0)
  warnings: WarningItem[]; // §2.2.3 표 B-2
  limitations: string[]; // §2.2.2 한계 및 가정
  execSummary: ExecSummaryRow[]; // 표 0 평가 결과 요약
};

const NOT_REVIEWED_NOTICE: Record<Lang, string> = {
  en: "not_reviewed — this document has not yet been reviewed and signed by a licensed safety assessor. The software does not auto-generate the final safety conclusion.",
  ko: "not_reviewed — 본 문서는 아직 자격을 갖춘 안전성 평가자의 검토와 서명을 받지 않았습니다. 소프트웨어는 최종 안전성 결론을 자동 생성하지 않습니다.",
};

/** Bo'sh maydonning kitobdagi ko'rinishi — "검토필요". */
export const REVIEW_NEEDED = "검토필요";

function hasNoael(c: { noael?: string }): boolean {
  const v = parseFloat(c.noael ?? "");
  return Number.isFinite(v) && v > 0;
}

function computeSections(input: {
  productInfo: ProductInfo;
  ingredients: IngredientRow[];
  productQuality: ProductQuality;
  exposure: ExposureParams;
  calcRows: CalcRow[];
}): ReportSections {
  const pi = input.productInfo;
  const pq = input.productQuality;
  const flat = flattenIngredients(input.ingredients);
  const totalPct = flat.reduce((s, c) => s + c.percentInProduct, 0);

  const productInfo =
    pi.productName && pi.productType && pi.manufacturer && pi.responsibleSeller ? "pass" : "review";

  const composition =
    flat.length === 0 || Math.abs(totalPct - 100) > 0.5
      ? "review"
      : input.calcRows.some((r) => r.restrictedNote)
        ? "review"
        : "pass";

  const physchemStability =
    pq.physicalForm && pq.ph && pq.viscosityRange && (pq.stabilityResult || pq.stabilityAcceleratedResult)
      ? "pass"
      : "review";

  const microbiological =
    pq.microbialLimitResult && pq.challengeTestResult ? "pass" : "review";

  const impuritiesPackaging =
    pq.heavyMetalsResult && pq.packagingMaterial ? "pass" : "review";

  const use = pi.useInstructions ? "pass" : "review";

  const A = parseFloat(input.exposure.amountG) || 0;
  const RF = parseFloat(input.exposure.retentionFactor) || 0;
  const BW = parseFloat(input.exposure.bodyWeightKg) || 0;
  const exposure = A > 0 && RF > 0 && BW > 0 ? "pass" : "review";

  const mosRisk =
    flat.length === 0 || !flat.every(hasNoael) || input.calcRows.some((r) => r.judgment !== "pass")
      ? "review"
      : "pass";

  const hasToxEvidence = flat.some((c) =>
    Object.entries(c.tox).some(([k, v]) => k !== "notes" && v === "available")
  );
  const toxicology = hasToxEvidence ? "pass" : "review";

  const hasRestrictedOrSensitive = input.calcRows.some((r) => r.restrictedNote);

  return {
    productInfo,
    composition,
    physchemStability,
    microbiological,
    impuritiesPackaging,
    use,
    exposure,
    mosRisk,
    toxicology,
    undesirableEffects: "review", // 회수·이상반응 데이터 manbasi yo'q — kitob ham 검토필요
    otherInfo: "review",
    discussion: "review", // 고찰 qoralamasi bor, lekin tasdiq assessorda
    conclusion: "review",
    warnings: hasRestrictedOrSensitive ? "review" : "pass",
    assessor: "review",
  };
}

function computeTtcRows(input: {
  ingredients: IngredientRow[];
  exposure: ExposureParams;
}): TTCScreenRow[] {
  const A = parseFloat(input.exposure.amountG) || 0;
  const RF = parseFloat(input.exposure.retentionFactor) || 0;
  const BW = parseFloat(input.exposure.bodyWeightKg) || 1;
  return flattenIngredients(input.ingredients)
    .filter((c): c is typeof c & { cramerClass: CramerClass } => !hasNoael(c) && c.cramerClass !== "")
    .map((c) => {
      const sed = calcSED({ amountG: A, retentionFactor: RF, bodyWeightKg: BW }, c.percentInProduct, 100);
      const screen = ttcScreen(c.cramerClass, sed);
      return {
        inciName: c.inciName,
        cas: c.cas,
        cramerClass: screen.cramerClass,
        sedUgKgDay: screen.sedUgKgDay,
        thresholdUgKgDay: screen.thresholdUgKgDay,
        withinTTC: screen.withinTTC,
      };
    });
}

function buildWarnings(input: {
  productInfo: ProductInfo;
  ingredients: IngredientRow[];
  calcRows: CalcRow[];
}): WarningItem[] {
  const warnings: WarningItem[] = [
    {
      text: "사용 중 또는 사용 후 이상 증상이 나타나면 사용을 중지하고 전문가와 상담",
      basis: "시행규칙 별표3 공통 [원문 대조]",
    },
    {
      text: "눈에 들어갔을 때 즉시 씻어낼 것 / 눈 주위 사용 주의",
      basis: "별표3 공통 · 예상 오용 (§2.1.5)",
    },
    {
      text: "어린이의 손이 닿지 않는 곳에 보관, 직사광선을 피해 서늘한 곳에 보관",
      basis: "별표3 공통",
    },
  ];

  const hasRetinol = flattenIngredients(input.ingredients).some((c) => c.cas === "68-26-8");
  if (hasRetinol) {
    warnings.push({
      text: "(RETINOL) 자외선 차단제 병행 권고 · 임부/수유부 사용 주의",
      basis: "EU 2024/996 요구 표시 [문안 확정]",
    });
  }

  for (const r of input.calcRows) {
    if (r.restrictedNote) {
      warnings.push({ text: `(제한성분 ${r.inciName}) ${r.restrictedNote}`, basis: "체크리스트 확인 필요" });
    }
  }

  if (input.productInfo.hasFragrance === "yes") {
    warnings.push({
      text: "향료 알레르겐 개별 표시 여부 확인 (Annex III / EU 2023/1545)",
      basis: "Annex III 알레르겐 확인",
    });
  }

  return warnings;
}

function buildLimitations(input: {
  productInfo: ProductInfo;
  productQuality: ProductQuality;
  ingredients: IngredientRow[];
}): string[] {
  const flat = flattenIngredients(input.ingredients);
  const missing: string[] = [];
  const pq = input.productQuality;
  if (!(pq.stabilityResult || pq.stabilityAcceleratedResult)) missing.push("12주 가속·광안정성 및 PAO 실측");
  if (!pq.microbialLimitResult || !pq.challengeTestResult) missing.push("미생물 실측·챌린지 log감소");
  if (!pq.heavyMetalsResult) missing.push("불순물 실측");
  if (flat.some((c) => !hasNoael(c))) missing.push("NOAEL 출처·신뢰도 (Klimisch)");

  return [
    "데이터 가정 — DAp는 측정값이 아닌 보수적 가정; 노출 파라미터는 SCCS 기본값 (SCCS/1647/22).",
    missing.length > 0
      ? `데이터 공백 — ${missing.join(", ")} (검토필요).`
      : "데이터 공백 — 확인된 실측 데이터 기준 완비 상태.",
    "해석 한계 — 「회수 미검출 ≠ 안전 입증」 · 「안내서-1506-01 = 참고용(법적 구속력 없음)」 · 경계값(at-limit) 성분은 자동 PASS가 아님.",
    "데이터 범위 — 모든 수치는 입력 기준이며 실측·임상·외부노출 결과가 아님.",
  ];
}

function buildExecSummary(input: {
  ingredients: IngredientRow[];
  calcRows: CalcRow[];
  statusCounts: ReportStatusCounts;
}): ExecSummaryRow[] {
  const flat = flattenIngredients(input.ingredients);
  const totalPct = flat.reduce((s, c) => s + c.percentInProduct, 0);
  const mosRows = input.calcRows.filter((r) => r.mos !== null);
  const minMos = mosRows.length > 0 ? Math.min(...mosRows.map((r) => r.mos as number)) : null;
  const hasRestricted = input.calcRows.some((r) => r.restrictedNote);

  return [
    {
      area: "Part A/B 구조",
      result: "Part A(정보) + Part B(평가) 2부 완비",
      interpretation: "EU Annex I 체계 충족",
      action: "Part B 본문 데이터 보강",
    },
    {
      area: "전성분 구성",
      result: flat.length > 0 ? `${flat.length}개 성분 · 총 ${totalPct.toFixed(2)}%` : "미입력",
      interpretation: Math.abs(totalPct - 100) <= 0.5 ? "함량 구조 정상" : "함량 합계 오류",
      action: "성분사전 국문명·정렬 확정",
    },
    {
      area: "안전역(MoS)",
      result: minMos === null ? "계산 불가 (NOAEL 미입력)" : `계산상 ${minMos.toFixed(0)} (전성분 MoS≥100 기준)`,
      interpretation:
        minMos === null
          ? "NOAEL 근거 필요"
          : minMos >= 100
            ? "여백 확보"
            : "임계 미달 — 검토필요",
      action: "DAp 근거·합산노출 정량화",
    },
    {
      area: "규제 리스크",
      result: hasRestricted ? "제한·금지 성분 검토필요" : "미검출",
      interpretation: hasRestricted ? "경계값 + 합산노출 우려" : "규제 대조 완료 필요",
      action: "표시경고·합산노출 재검토(우선)",
    },
    {
      area: "발행 가능성",
      result: `draft · not_reviewed (PASS ${input.statusCounts.pass} / REVIEW ${input.statusCounts.review} / FAIL ${input.statusCounts.fail})`,
      interpretation: "평가자 미승인 - 발행 불가",
      action: "§2.3 평가자 자격·서명 확보",
    },
  ];
}

function toCalcRows(ingredients: IngredientRow[], exposure: ExposureParams): CalcRow[] {
  const amountG = parseFloat(exposure.amountG) || 0;
  const retentionFactor = parseFloat(exposure.retentionFactor) || 0;
  const bodyWeightKg = parseFloat(exposure.bodyWeightKg) || 1;

  // Har INCI substansiya (xomashyo ichidagi har komponent) alohida hisoblanadi —
  // Kosili misolidagi kabi bitta xomashyoda bir nechta INCI bo'lishi mumkin.
  return flattenIngredients(ingredients).map((c) => {
    const dermalAbsorptionPercent = parseFloat(c.dermalAbsorptionPercent) || 0;
    const noael = c.noael ? parseFloat(c.noael) : undefined;

    const sed = calcSED({ amountG, retentionFactor, bodyWeightKg }, c.percentInProduct, dermalAbsorptionPercent);
    const mos = calcMoS(noael, sed);

    const toxLines = Object.entries(c.tox)
      .filter(([key, val]) => key !== "notes" && val === "available")
      .map(([key]) => key);
    const toxSummary =
      toxLines.length > 0
        ? `${toxLines.join(", ")} 확보${c.tox.notes ? ` (${c.tox.notes})` : ""}`
        : undefined;

    const restricted = checkRestricted(c.cas);

    return {
      inciName: c.inciName,
      cas: c.cas,
      percentInProduct: c.percentInProduct,
      noael,
      sed,
      mos,
      judgment: judge(mos),
      toxSummary,
      restrictedNote: restricted ? `${restricted.severity.toUpperCase()}: ${restricted.reason}` : undefined,
    };
  });
}

/**
 * 1-QADAM (hisob-kitob) + 2-QADAM (RAG) + 3-QADAM (LLM, faqat Part A/B) +
 * 7-QADAM (data integrity) — barchasini birlashtirib CPSR qoralamasini yaratadi.
 * Yakuniy xulosa va imzo (8-QADAM) BU YERDA YO'Q — inson bajaradi.
 */
export async function generateCPSRReport(input: {
  productInfo: ProductInfo;
  ingredients: IngredientRow[];
  productQuality: ProductQuality;
  exposure: ExposureParams;
  lang: Lang;
}): Promise<CPSRReportDraft> {
  // 1-QADAM: deterministik hisob-kitob (AI EMAS)
  const calcRows = toCalcRows(input.ingredients, input.exposure);

  // 2-QADAM: RAG qidiruv — mahsulot/tarkibga tegishli reglament kontekstini topadi
  const query = [
    input.productInfo.productType,
    input.productInfo.rinseType,
    ...flattenIngredients(input.ingredients).map((c) => c.inciName).filter(Boolean),
  ]
    .filter(Boolean)
    .join(" ");
  const { chunks, demo } = await retrieveChunks(query || "cosmetic safety", 6);

  // 3-QADAM: LLM — FAQAT Part A tavsif + Part B mulohaza
  const draft = demo
    ? mockDraftCPSRSections(input.productInfo, calcRows, input.lang)
    : await draftCPSRSections(input.productInfo, input.productQuality, calcRows, chunks, input.lang);

  // 7-QADAM: Data Integrity (ALCOA+) — input_csv_sha, config_hash, run_id
  const integrity = stampIntegrity(
    { productInfo: input.productInfo, ingredients: input.ingredients },
    { exposure: input.exposure, model: draft.model, retrievedSourceCount: chunks.length }
  );

  const exposureParams = {
    A: parseFloat(input.exposure.amountG) || 0,
    RF: parseFloat(input.exposure.retentionFactor) || 0,
    BW: parseFloat(input.exposure.bodyWeightKg) || 0,
    F: parseFloat(input.exposure.frequency) || 1,
  };
  const exposureE = calcRelativeDailyExposure({
    amountG: exposureParams.A,
    retentionFactor: exposureParams.RF,
    bodyWeightKg: exposureParams.BW || 1,
  });

  const sections = computeSections({ ...input, calcRows });
  const statusCounts = Object.values(sections).reduce<ReportStatusCounts>(
    (acc, s) => {
      acc[s] += 1;
      return acc;
    },
    { pass: 0, review: 0, fail: 0 }
  );

  const mosRows = calcRows.filter((r) => r.mos !== null);
  const minMos = mosRows.length > 0 ? Math.min(...mosRows.map((r) => r.mos as number)) : null;

  return {
    status: "draft_generated",
    calcRows,
    partA: draft.partA,
    partBReasoning: draft.partBReasoning,
    model: draft.model,
    demo: demo || !hasRealCredentials(),
    sources: chunks,
    integrity,
    notReviewedNotice: NOT_REVIEWED_NOTICE[input.lang],
    exposureE,
    exposureParams,
    ttcRows: computeTtcRows({ ingredients: input.ingredients, exposure: input.exposure }),
    minMos,
    sections,
    statusCounts,
    warnings: buildWarnings({ productInfo: input.productInfo, ingredients: input.ingredients, calcRows }),
    limitations: buildLimitations({ productInfo: input.productInfo, productQuality: input.productQuality, ingredients: input.ingredients }),
    execSummary: buildExecSummary({ ingredients: input.ingredients, calcRows, statusCounts }),
  };
}
