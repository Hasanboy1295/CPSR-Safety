// Hamma narsani birlashtiruvchi orkestratsiya — diagrammadagi
// 1(Hisob-kitob) -> 2(RAG) -> 3(LLM) -> 7(Data Integrity) qadamlari.
// Bu — "real yo'l"ning to'liq amalga oshirilishi.

import type { ProductInfo, IngredientRow, ExposureParams } from "./wizard-types";
import { calcSED, calcMoS, judge, type CalcRow } from "./calc";
import { retrieveChunks, hasRealCredentials, type RetrievedChunk } from "./rag";
import { draftCPSRSections } from "./claude";
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

  return ingredients.map((row) => {
    const percentInProduct = parseFloat(row.percentInProduct) || 0;
    const dermalAbsorptionPercent = parseFloat(row.dermalAbsorptionPercent) || 0;
    const noael = row.noael ? parseFloat(row.noael) : undefined;

    const sed = calcSED({ amountG, retentionFactor, bodyWeightKg }, percentInProduct, dermalAbsorptionPercent);
    const mos = calcMoS(noael, sed);

    return {
      inciName: row.inciName,
      cas: row.cas,
      percentInProduct,
      noael,
      sed,
      mos,
      judgment: judge(mos),
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
  exposure: ExposureParams;
}): Promise<CPSRReportDraft> {
  // 1-QADAM: deterministik hisob-kitob (AI EMAS)
  const calcRows = toCalcRows(input.ingredients, input.exposure);

  // 2-QADAM: RAG qidiruv — mahsulot/tarkibga tegishli reglament kontekstini topadi
  const query = [
    input.productInfo.productType,
    input.productInfo.rinseType,
    ...input.ingredients.map((i) => i.inciName).filter(Boolean),
  ]
    .filter(Boolean)
    .join(" ");
  const { chunks, demo } = await retrieveChunks(query || "cosmetic safety", 6);

  // 3-QADAM: LLM — FAQAT Part A tavsif + Part B mulohaza
  const draft = demo
    ? mockDraftCPSRSections(input.productInfo, calcRows)
    : await draftCPSRSections(input.productInfo, calcRows, chunks);

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
