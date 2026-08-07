// Hamma narsani birlashtiruvchi orkestratsiya — diagrammadagi
// 1(Hisob-kitob) -> 2(RAG) -> 3(LLM) -> 7(Data Integrity) qadamlari.
// Bu — "real yo'l"ning to'liq amalga oshirilishi.

import type { ProductInfo, IngredientRow, ExposureParams, ProductQuality } from "./wizard-types";
import { flattenIngredients } from "./wizard-types";
import { calcSED, calcMoS, judge, type CalcRow } from "./calc";
import { checkRestricted } from "./restricted-list";
import { retrieveChunks, hasRealCredentials, type RetrievedChunk } from "./rag";
import { draftCPSRSections } from "./llm";
import { mockDraftCPSRSections } from "./mock";
import { stampIntegrity, type IntegrityStamp } from "./integrity";

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
};

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
    ? mockDraftCPSRSections(input.productInfo, calcRows)
    : await draftCPSRSections(input.productInfo, input.productQuality, calcRows, chunks);

  // 7-QADAM: Data Integrity (ALCOA+) — input_csv_sha, config_hash, run_id
  const integrity = stampIntegrity(
    { productInfo: input.productInfo, ingredients: input.ingredients },
    { exposure: input.exposure, model: draft.model, retrievedSourceCount: chunks.length }
  );

  return {
    status: "draft_generated",
    calcRows,
    partA: draft.partA,
    partBReasoning: draft.partBReasoning,
    model: draft.model,
    demo: demo || !hasRealCredentials(),
    sources: chunks,
    integrity,
    notReviewedNotice:
      "not_reviewed — bu hujjat hali xavfsizlik baholovchisi tomonidan ko'rib chiqilmagan va imzolanmagan. Software yakuniy xavfsizlik xulosasini avtomatik yozmaydi.",
  };
}
