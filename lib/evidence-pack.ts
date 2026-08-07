// Evidence Pack — CPSR_KR_dossier'ning o'z talabi: "evidence_pack.zip" —
// 1 yil o'tib ham "bu xulosaga qanday kelindi"ni tekshirish uchun barcha
// kirish/chiqish/manba/hash'larni bitta ZIP'ga jamlaydi.

import JSZip from "jszip";
import type { WizardData } from "./wizard-types";
import type { CPSRReportDraft } from "./report";

export async function buildEvidencePack(
  data: Pick<WizardData, "productInfo" | "ingredients" | "productQuality" | "exposure">,
  report: CPSRReportDraft
): Promise<Uint8Array> {
  const zip = new JSZip();

  // 1) Kirish ma'lumoti — aslida formula.csv/product_safety_inputs.json
  // o'rnini bosadi (CPSR_KR_dossier'dagi haqiqiy pipeline shu nomlarni ishlatadi)
  zip.file("input/product_info.json", JSON.stringify(data.productInfo, null, 2));
  zip.file("input/ingredients.json", JSON.stringify(data.ingredients, null, 2));
  zip.file("input/product_quality.json", JSON.stringify(data.productQuality, null, 2));
  zip.file("input/exposure_params.json", JSON.stringify(data.exposure, null, 2));

  // 2) Deterministik hisob-kitob natijalari (AI aralashuvisiz)
  zip.file("calculations/sed_mos_results.json", JSON.stringify(report.calcRows, null, 2));

  // 3) RAG orqali topilgan manbalar — LLM javobi qaysi matnga asoslanganini isbotlaydi
  zip.file("rag_sources/retrieved_chunks.json", JSON.stringify(report.sources, null, 2));

  // 4) LLM qoralamasi (Part A / Part B) — aniq shu holatda saqlanadi
  zip.file("draft/part_a.txt", report.partA);
  zip.file("draft/part_b_weight_of_evidence.txt", report.partBReasoning);

  // 5) Data Integrity — ALCOA+ dalillari
  zip.file(
    "integrity/manifest.json",
    JSON.stringify(
      {
        run_id: report.integrity.runId,
        created_at: report.integrity.createdAt,
        input_csv_sha256: report.integrity.inputCsvSha,
        config_hash: report.integrity.configHash,
        model: report.model,
        demo_mode: report.demo,
        status: report.status,
      },
      null,
      2
    )
  );

  // 6) Inson uchun o'qish tartibi
  zip.file(
    "README.txt",
    [
      "EVIDENCE PACK — auto-cpsr",
      "==========================",
      "",
      `Run ID: ${report.integrity.runId}`,
      `Yaratilgan: ${report.integrity.createdAt}`,
      `Holat: ${report.status} (${report.demo ? "DEMO rejim" : "REAL"})`,
      "",
      "Bu papka CPSR qoralamasining barcha kirish, chiqish, manba va hash",
      "dalillarini o'z ichiga oladi — istalgan vaqt 'bu xulosaga qanday",
      "kelindi' savoliga javob berish uchun.",
      "",
      "input/          — foydalanuvchi kiritgan xom ma'lumot",
      "calculations/   — SED/MoS deterministik hisob-kitob (LLM aralashmagan)",
      "rag_sources/    — LLM javobi asoslangan haqiqiy manba matnlari",
      "draft/          — LLM tomonidan yozilgan Part A/B qoralama matni",
      "integrity/      — SHA-256 xeshlar (input_csv_sha, config_hash)",
      "",
      "ESLATMA: bu hujjat 'not_reviewed' holatida — yakuniy xavfsizlik",
      "xulosasi va imzo faqat xavfsizlik baholovchisi tomonidan qo'shiladi.",
    ].join("\n")
  );

  return zip.generateAsync({ type: "uint8array" });
}
