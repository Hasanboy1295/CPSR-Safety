// DEMO REJIMI — .env'da haqiqiy API kalitlar bo'lmaganda ishlatiladi.
// Voyage/Claude/Supabase o'rniga: data/*.txt fayllarni to'g'ridan-to'g'ri
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

const DATA_DIR = join(process.cwd(), "data");

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

export function mockAnswerWithRag(question: string, matchCount = 3): RagResult {
  const sources = mockRetrieveChunks(question, matchCount);
  const best = sources[0];
  const answer = best
    ? [
        `[DEMO REJIMI — haqiqiy AI emas, kalit so'z mosligi]`,
        ``,
        `Savolingiz "${question}" bo'yicha data/ papkasidagi hujjatlardan eng yaqin topilgan qism:`,
        ``,
        `"${best.content.slice(0, 400)}${best.content.length > 400 ? "..." : ""}"`,
        ``,
        `[manba: ${best.source_name}]`,
        ``,
        `Bu haqiqiy Claude javobi emas — real AI+RAG javobi uchun .env fayliga`,
        `OPENAI_API_KEY, VOYAGE_API_KEY, NEXT_PUBLIC_SUPABASE_URL va`,
        `SUPABASE_SERVICE_ROLE_KEY qo'shing (README.md'ga qarang).`,
      ].join("\n")
    : `[DEMO REJIMI] data/ papkasida hech qanday .txt fayl topilmadi.`;

  return { answer, sources, model: "demo-mock (real LLM emas)" };
}

/** Part A/B qoralamasining demo (LLM'siz) versiyasi. */
export function mockDraftCPSRSections(
  productInfo: ProductInfo,
  calcRows: CalcRow[]
): CPSRDraft {
  const partA = [
    `[DEMO REJIMI — bu Claude emas, shablon matn]`,
    ``,
    `Mahsulot: ${productInfo.productName || "검토필요"} (${productInfo.productType || "검토필요"})`,
    `Foydalanuvchi: ${productInfo.targetUser || "검토필요"} · Qo'llash: ${productInfo.rinseType}`,
    `Ishlab chiqaruvchi: ${productInfo.manufacturer || "검토필요"}`,
    ``,
    `Tarkib (${calcRows.length} ta ingredient):`,
    ...calcRows.map((r) => `- ${r.inciName || "검토필요"} — ${r.percentInProduct}%`),
  ].join("\n");

  const partBReasoning = [
    `[DEMO REJIMI]`,
    ``,
    ...calcRows.map(
      (r) =>
        `- ${r.inciName || "검토필요"}: MoS=${r.mos === null ? "검토필요 (NOAEL yo'q)" : r.mos.toFixed(1)} → ${
          r.judgment === "pass" ? "hisob-kitob bo'yicha ≥100" : r.judgment === "review" ? "검토필요 (<100)" : "검토필요 (ma'lumot yetarli emas)"
        }`
    ),
    ``,
    `Yakuniy xulosa: 검토필요 — bu qism xavfsizlik baholovchisi tomonidan yoziladi (avtomatik emas).`,
  ].join("\n");

  return { partA, partBReasoning, model: "demo-mock (real LLM emas)" };
}
