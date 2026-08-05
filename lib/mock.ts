// DEMO REJIMI — .env'da haqiqiy API kalitlar bo'lmaganda ishlatiladi.
// Voyage/Claude/Supabase o'rniga: data/*.txt fayllarni to'g'ridan-to'g'ri
// o'qib, oddiy kalit-so'z mosligi bilan "eng yaqin" bo'lakni topadi va
// shablon javob qaytaradi. Bu HAQIQIY AI emas — faqat butun quvurning
// shaklini (savol -> qidiruv -> javob+manba) ko'rsatish uchun.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chunkText } from "./chunk";
import type { RagResult, RetrievedChunk } from "./rag";

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

export function mockAnswerWithRag(question: string, matchCount = 3): RagResult {
  const questionWords = tokenize(question);
  const allChunks = loadLocalChunks();

  const scored = allChunks
    .map((c) => ({ ...c, similarity: scoreChunk(questionWords, c.content) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, matchCount);

  const sources: RetrievedChunk[] = scored.map((c, i) => ({
    id: i,
    source_name: c.source_name,
    content: c.content,
    metadata: { mode: "demo-keyword-match" },
    similarity: c.similarity,
  }));

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
        `ANTHROPIC_API_KEY, VOYAGE_API_KEY, NEXT_PUBLIC_SUPABASE_URL va`,
        `SUPABASE_SERVICE_ROLE_KEY qo'shing (README.md'ga qarang).`,
      ].join("\n")
    : `[DEMO REJIMI] data/ papkasida hech qanday .txt fayl topilmadi.`;

  return { answer, sources, model: "demo-mock (real LLM emas)" };
}
