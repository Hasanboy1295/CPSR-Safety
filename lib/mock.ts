// DEMO REJIMI — .env'da haqiqiy API kalitlar bo'lmaganda ishlatiladi.
// OpenAI/Supabase o'rniga: data/*.txt fayllarni to'g'ridan-to'g'ri
// o'qib, oddiy kalit-so'z mosligi bilan "eng yaqin" bo'lakni topadi va
// shablon javob qaytaradi. Bu HAQIQIY AI emas — faqat butun quvurning
// shaklini (savol -> qidiruv -> javob+manba) ko'rsatish uchun.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkText } from "./chunk";
import type { RagResult, RetrievedChunk } from "./rag";
import type { ProductInfo } from "./wizard-types";
import type { CalcRow } from "./calc";
import type { CPSRDraft } from "./llm";
import type { Lang } from "./i18n";

const DATA_DIR = join(process.cwd(), "data");

// DEMO javoblar ham xuddi real AI kabi ikki tilli (KO + EN) bo'ladi.
const DEMO = {
  bannerKo: "[DEMO 모드 — 실제 AI가 아닌 키워드 매칭]",
  bannerEn: "[DEMO MODE — keyword matching, not a real AI]",
  draftKo: "[DEMO 모드 — 실제 AI가 아닌 템플릿 텍스트]",
  draftEn: "[DEMO MODE — template text, not a real AI]",
  conclusionKo: "최종 결론: 검토필요 — 이 부분은 안전성 평가자가 작성합니다 (자동 아님).",
  conclusionEn:
    "Final conclusion: review needed — this section is written by the safety assessor (not automatic).",
};

/** Sayt tilini "birinchi keladigan til" qilib, ikkala tilda ham bitta nusxa qaytaradi. */
function bilingual(lang: Lang, ko: string, en: string): string {
  return lang === "ko" ? `${ko}\n\n${en}` : `${en}\n\n${ko}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function loadLocalChunks(): { source_name: string; content: string }[] {
  let files: string[] = [];
  try {
    files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".txt"));
  } catch {
    return [];
  }
  return files.flatMap((file) => {
    const raw = readFileSync(join(DATA_DIR, file), "utf-8");
    return chunkText(raw, 250, 30).map((content) => ({
      source_name: file,
      content,
    }));
  });
}

/** Kalit-so'z mosligiga asoslangan sodda skorlash (embedding emas). */
function scoreChunk(questionWords: string[], chunk: string): number {
  const chunkWords = new Set(tokenize(chunk));
  let hits = 0;
  for (const w of questionWords) {
    if (chunkWords.has(w)) hits++;
  }
  return questionWords.length === 0 ? 0 : hits / questionWords.length;
}

/** Faqat qidiruv qismi — report.ts kabi boshqa joylardan ham qayta ishlatiladi. */
export function mockRetrieveChunks(query: string, matchCount = 3): RetrievedChunk[] {
  const queryWords = tokenize(query);
  const allChunks = loadLocalChunks();

  const scored = allChunks
    .map((c) => ({ ...c, similarity: scoreChunk(queryWords, c.content) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  return scored.map((c, i) => ({
    id: i,
    source_name: c.source_name,
    content: c.content,
    metadata: { mode: "demo-keyword-match" },
    similarity: c.similarity,
  }));
}

export function mockAnswerWithRag(question: string, matchCount = 3, lang: Lang = "en"): RagResult {
  const sources = mockRetrieveChunks(question, matchCount);
  const best = sources[0];
  if (!best) {
    return {
      answer: bilingual(
        lang,
        "[DEMO 모드] data/ 폴더에 .txt 파일이 없습니다.",
        "[DEMO MODE] No .txt files found in the data/ folder."
      ),
      sources,
      model: "demo-mock (real LLM emas)",
    };
  }

  const ko = [
    DEMO.bannerKo,
    ``,
    `질문 "${question}"에 대해 data/ 폴더의 문서에서 가장 가까운 부분:`,
    ``,
    `"${best.content.slice(0, 400)}${best.content.length > 400 ? "..." : ""}"`,
    ``,
    `[출처: ${best.source_name}]`,
    ``,
    "이것은 실제 AI 답변이 아닙니다 — 실제 AI+RAG 답변을 보려면 .env 파일에 OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY를 설정하세요 (README.md 참조).",
  ].join("\n");

  const en = [
    DEMO.bannerEn,
    ``,
    `For your question "${question}", the closest part found in the data/ folder documents:`,
    ``,
    `"${best.content.slice(0, 400)}${best.content.length > 400 ? "..." : ""}"`,
    ``,
    `[source: ${best.source_name}]`,
    ``,
    "This is not a real AI answer — to see the real AI+RAG answer, add OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to the .env file (see README.md).",
  ].join("\n");

  return { answer: bilingual(lang, ko, en), sources, model: "demo-mock (real LLM emas)" };
}

/** Part A/B qoralamasining demo (LLM'siz) versiyasi. */
export function mockDraftCPSRSections(
  productInfo: ProductInfo,
  calcRows: CalcRow[],
  lang: Lang = "en"
): CPSRDraft {
  const reviewKo = "검토필요";
  const reviewEn = "review needed";

  const partA = bilingual(
    lang,
    [
      DEMO.draftKo,
      ``,
      `제품: ${productInfo.productName || reviewKo} (${productInfo.productType || reviewKo})`,
      `사용 대상: ${productInfo.targetUser || reviewKo} · 용법: ${productInfo.rinseType}`,
      `제조업자: ${productInfo.manufacturer || reviewKo}`,
      ``,
      `성분 (${calcRows.length}개):`,
      ...calcRows.map((r) => `- ${r.inciName || reviewKo} — ${r.percentInProduct}%`),
    ].join("\n"),
    [
      DEMO.draftEn,
      ``,
      `Product: ${productInfo.productName || reviewEn} (${productInfo.productType || reviewEn})`,
      `Target user: ${productInfo.targetUser || reviewEn} · Application: ${productInfo.rinseType}`,
      `Manufacturer: ${productInfo.manufacturer || reviewEn}`,
      ``,
      `Composition (${calcRows.length} ingredients):`,
      ...calcRows.map((r) => `- ${r.inciName || reviewEn} — ${r.percentInProduct}%`),
    ].join("\n")
  );

  const judgmentKo = (r: CalcRow) =>
    r.judgment === "pass"
      ? "계산상 ≥100"
      : r.judgment === "review"
        ? "검토필요 (<100)"
        : "검토필요 (자료 부족)";
  const judgmentEn = (r: CalcRow) =>
    r.judgment === "pass"
      ? "≥100 by calculation"
      : r.judgment === "review"
        ? "review needed (<100)"
        : "review needed (insufficient data)";

  const partBReasoning = bilingual(
    lang,
    [
      DEMO.draftKo,
      ``,
      ...calcRows.map((r) => `- ${r.inciName || reviewKo}: MoS=${r.mos === null ? reviewKo : r.mos.toFixed(1)} → ${judgmentKo(r)}`),
      ``,
      DEMO.conclusionKo,
    ].join("\n"),
    [
      DEMO.draftEn,
      ``,
      ...calcRows.map((r) => `- ${r.inciName || reviewEn}: MoS=${r.mos === null ? reviewEn : r.mos.toFixed(1)} → ${judgmentEn(r)}`),
      ``,
      DEMO.conclusionEn,
    ].join("\n")
  );

  return { partA, partBReasoning, model: "demo-mock (real LLM emas)" };
}
