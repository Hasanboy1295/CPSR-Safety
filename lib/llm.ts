import OpenAI from "openai";
import type { RetrievedChunk } from "./rag";
import type { ProductInfo, ProductQuality } from "./wizard-types";
import type { CalcRow } from "./calc";
import type { Lang } from "./i18n";

const MODEL = "gpt-4o";

const LANG_NAME: Record<Lang, string> = {
  en: "English",
  ko: "Korean",
};

const PLACEHOLDER: Record<Lang, string> = {
  en: "review needed",
  ko: "검토필요",
};

const RESTRICTED_LABEL: Record<Lang, string> = {
  en: "restricted ingredient",
  ko: "제한성분",
};

const FINAL_MARKER: Record<Lang, string> = {
  en: "Review needed — assessor confirmation required",
  ko: "검토필요 — 평가자 확인 필요",
};

const SAFE_WORDS: Record<Lang, string> = {
  en: "SAFE / compliant",
  ko: "SAFE / 적합",
};

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY topilmadi (.env faylni tekshiring)");
  }
  return new OpenAI({ apiKey });
}

function ragSystemPrompt(lang: Lang): string {
  const other = LANG_NAME[lang === "ko" ? "en" : "ko"];
  return `You are a cosmetic safety (CPSR) assistant.
Strict rules:
1. Use ONLY the information in the "Context" section below.
2. If the context does not contain enough information to answer, state exactly:
   "Not enough information found in the provided documents." — never invent.
3. Cite every claim with its source as [source: <source_name>] so the user can verify.
4. Write the ENTIRE answer BILINGUALLY: first the full answer in ${LANG_NAME[lang]},
   then the identical answer in ${other}. Keep the two versions clearly separated
   (e.g. with a blank line and a language tag).`;
}

export type GroundedAnswer = {
  answer: string;
  model: string;
};

export async function generateGroundedAnswer(
  question: string,
  chunks: RetrievedChunk[],
  lang: Lang
): Promise<GroundedAnswer> {
  const client = getClient();

  const context = chunks
    .map(
      (c, i) =>
        `[${i + 1}] source: ${c.source_name} (similarity: ${c.similarity.toFixed(2)})\n${c.content}`
    )
    .join("\n\n---\n\n");

  const userMessage = `Context:\n${context || "(nothing found)"}\n\nQuestion: ${question}`;

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      { role: "system", content: ragSystemPrompt(lang) },
      { role: "user", content: userMessage },
    ],
  });

  return {
    answer: response.choices[0]?.message?.content ?? "",
    model: MODEL,
  };
}

// ---- CPSR Part A / Part B qoralama yozuvchi (report.ts orqali chaqiriladi) ----

function cpsrDraftSystemPrompt(lang: Lang): string {
  const other = LANG_NAME[lang === "ko" ? "en" : "ko"];
  return `You draft ONLY two sections of a CPSR (화장품 안전성 평가 자료) document:
- Part A: an OBJECTIVE DESCRIPTION of the product, its composition, and its physical/chemical,
  microbiological, and packaging characteristics (a structured restatement of the given data —
  corresponds to sections 2-6 of a real CPSR document).
- Part B "Weight-of-Evidence" REASONING: a discussion of what conclusion the given MoS /
  calculation results point toward (evidence -> reasoning path, but NOT the final decision).

STRICT RULES (taken verbatim from the CPSR_KR_dossier source document):
1. Do NOT write a final safety conclusion (safe / not safe). That is the human safety
   assessor's task. Instead mark: "${FINAL_MARKER[lang]}".
2. Do not automatically assert ${SAFE_WORDS[lang]}.
3. Do not invent an assessor name, signature, or certificate number.
4. Do not invent test numbers, DOIs, or certificate numbers. If no source exists,
   mark "${PLACEHOLDER[lang]}".
5. Every numeric claim (MoS, SED, etc.) must come from the calculation results given
   below — never invent numbers.
6. Cite each regulatory / scientific claim with [source: <source_name>], using ONLY the
   sources in the "Context" section below.
7. Anything not present in the context: mark "${PLACEHOLDER[lang]}", do not invent.
8. If an ingredient is flagged as a ${RESTRICTED_LABEL[lang]} in the calculation results,
   highlight it EXPLICITLY in Part A and Part B — it is the most important safety signal,
   never hide or soften it.

Write ALL output text BILINGUALLY: each section first in ${LANG_NAME[lang]}, then the
identical version in ${other}. Keep the two language versions clearly separated
(e.g. with a blank line and a language tag).

Output EXACTLY this format (two sections, nothing else):
### PART A
<text>

### PART B — WEIGHT OF EVIDENCE
<text>`;
}

export type CPSRDraft = {
  partA: string;
  partBReasoning: string;
  model: string;
};

export async function draftCPSRSections(
  productInfo: ProductInfo,
  productQuality: ProductQuality,
  calcRows: CalcRow[],
  context: RetrievedChunk[],
  lang: Lang
): Promise<CPSRDraft> {
  const client = getClient();

  const contextText = context
    .map((c, i) => `[${i + 1}] source: ${c.source_name}\n${c.content}`)
    .join("\n\n---\n\n");

  const calcText = calcRows
    .map(
      (r) =>
        `- ${r.inciName || PLACEHOLDER[lang]} (CAS ${r.cas || PLACEHOLDER[lang]}, ${r.percentInProduct}%): ` +
        `SED=${r.sed.toFixed(6)} mg/kg/day, NOAEL=${r.noael ?? PLACEHOLDER[lang]}, ` +
        `MoS=${r.mos === null ? PLACEHOLDER[lang] : r.mos.toFixed(1)}, status=${r.judgment}` +
        (r.toxSummary ? ` | toxicology profile: ${r.toxSummary}` : "") +
        (r.restrictedNote ? ` | ${RESTRICTED_LABEL[lang]}: ${r.restrictedNote}` : "")
    )
    .join("\n");

  const userMessage = [
    `Product information:`,
    `- Name: ${productInfo.productName || PLACEHOLDER[lang]}`,
    `- Type: ${productInfo.productType || PLACEHOLDER[lang]}`,
    `- Target user: ${productInfo.targetUser || PLACEHOLDER[lang]}`,
    `- Application: ${productInfo.rinseType}`,
    `- Manufacturer: ${productInfo.manufacturer || PLACEHOLDER[lang]}`,
    ``,
    `Physical/chemical, microbiological and packaging data (laboratory results entered by the user — do not modify, only describe):`,
    `- Appearance: ${productQuality.physicalForm || PLACEHOLDER[lang]}`,
    `- pH: ${productQuality.ph || PLACEHOLDER[lang]}`,
    `- Viscosity: ${productQuality.viscosityRange || PLACEHOLDER[lang]}`,
    `- Stability test: ${productQuality.stabilityResult || PLACEHOLDER[lang]}`,
    `- PAO: ${productQuality.paoMonths ? `${productQuality.paoMonths} months` : PLACEHOLDER[lang]}`,
    `- Microbial limit: ${productQuality.microbialLimitResult || PLACEHOLDER[lang]}`,
    `- Preservation (challenge) test: ${productQuality.challengeTestResult || PLACEHOLDER[lang]}`,
    `- Heavy metals: ${productQuality.heavyMetalsResult || PLACEHOLDER[lang]}`,
    `- Packaging: ${productQuality.packagingMaterial || PLACEHOLDER[lang]} (${productQuality.packagingSafetyNote || PLACEHOLDER[lang]})`,
    `- Fragrance allergens: ${productQuality.allergenNote || PLACEHOLDER[lang]}`,
    ``,
    `Calculation results (deterministic — do not modify them):`,
    calcText || "(no composition entered)",
    ``,
    `Context (use only this):`,
    contextText || `(no sources found — mark everything as "${PLACEHOLDER[lang]}")`,
  ].join("\n");

  const response = await client.chat.completions.create({
    model: MODEL,
    max_tokens: 1536,
    messages: [
      { role: "system", content: cpsrDraftSystemPrompt(lang) },
      { role: "user", content: userMessage },
    ],
  });

  const full = response.choices[0]?.message?.content ?? "";

  const partAMatch = full.match(/### PART A\s*([\s\S]*?)(?=### PART B|$)/i);
  const partBMatch = full.match(/### PART B.*?\n([\s\S]*)$/i);

  return {
    partA: partAMatch?.[1]?.trim() || full,
    partBReasoning: partBMatch?.[1]?.trim() || "",
    model: MODEL,
  };
}
