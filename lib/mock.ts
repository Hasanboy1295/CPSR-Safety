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

function demoText(lang: Lang, key: "banner" | "answer" | "draft" | "conclusion"): string {
  if (lang === "ko") {
    switch (key) {
      case "banner":
        return "[DEMO 모드 — 실제 AI가 아닌 키워드 매칭]";
      case "answer":
        return "당신의 질문";
      case "draft":
        return "[DEMO 모드 — 실 AI가 아닌 템플릿 텍스트]";
      case "conclusion":
        return "최종 결론: 검토필요 — 이 부분은 안전성 평가자가 작성합니다 (자동 아님).";
    }
  }
  switch (key) {
    case "banner":
      return "[DEMO MODE — keyword matching, not a real AI]";
    case "answer":
      return "Your question";
    case "draft":
      return "[DEMO MODE — template text, not a real AI]";
    case "conclusion":
      return "Final conclusion: review needed — this section is written by the safety assessor (not automatic).";
  }
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
  const answer = best
    ? [
        demoText(lang, "banner"),
        ``,
        `${lang === "ko" ? "당신의 질문" : "Your question"}: "${question}" — ${
          lang === "ko"
            ? "data/ 폴더의 문서 중 가장 가까운 부분:"
            : "closest part found in the data/ folder documents:"
        }`,
        ``,
        `"${best.content.slice(0, 400)}${best.content.length > 400 ? "..." : ""}"`,
        ``,
        `[source: ${best.source_name}]`,
        ``,
        lang === "ko"
          ? "이것은 실제 AI 답변이 아닙니다 — 실제 AI+RAG 답변을 보려면 .env 파일에"
        : "This is not a real AI answer — to see the real AI+RAG answer, add",
        lang === "ko"
          ? "OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL 및"
        : "OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL and",
        lang === "ko" ? "SUPABASE_SERVICE_ROLE_KEY를 설정하세요 (README.md 참조)." : "SUPABASE_SERVICE_ROLE_KEY to the .env file (see README.md).",
      ].join("\n")
    : lang === "ko"
      ? "[DEMO 모드] data/ 폴더에 .txt 파일이 없습니다."
      : "[DEMO MODE] No .txt files found in the data/ folder.";

  return { answer, sources, model: "demo-mock (real LLM emas)" };
}

/** Part A/B qoralamasining demo (LLM'siz) versiyasi. */
export function mockDraftCPSRSections(
  productInfo: ProductInfo,
  calcRows: CalcRow[],
  lang: Lang = "en"
): CPSRDraft {
  const partA = [
    demoText(lang, "draft"),
    ``,
    `${lang === "ko" ? "제품" : "Product"}: ${productInfo.productName || (lang === "ko" ? "검토필요" : "review needed")} (${
      productInfo.productType || (lang === "ko" ? "검토필요" : "review needed")
    })`,
    `${lang === "ko" ? "사용 대상" : "Target user"}: ${productInfo.targetUser || (lang === "ko" ? "검토필요" : "review needed")} · ${
      lang === "ko" ? "용법" : "Application"
    }: ${productInfo.rinseType}`,
    `${lang === "ko" ? "제조업자" : "Manufacturer"}: ${productInfo.manufacturer || (lang === "ko" ? "검토필요" : "review needed")}`,
    ``,
    `${lang === "ko" ? "성분" : "Composition"} (${calcRows.length} ${lang === "ko" ? "개 성분" : "ingredients"}):`,
    ...calcRows.map((r) => `- ${r.inciName || (lang === "ko" ? "검토필요" : "review needed")} — ${r.percentInProduct}%`),
  ].join("\n");

  const partBReasoning = [
    demoText(lang, "draft"),
    ``,
    ...calcRows.map((r) => {
      const review = lang === "ko" ? "검토필요" : "review needed";
      const judgment =
        r.judgment === "pass"
          ? lang === "ko"
            ? "계산상 ≥100"
            : "≥100 by calculation"
          : r.judgment === "review"
            ? lang === "ko"
              ? "검토필요 (<100)"
              : "review needed (<100)"
            : lang === "ko"
              ? "검토필요 (자료 부족)"
              : "review needed (insufficient data)";
      return `- ${r.inciName || review}: MoS=${r.mos === null ? review : r.mos.toFixed(1)} → ${judgment}`;
    }),
    ``,
    demoText(lang, "conclusion"),
  ].join("\n");

  return { partA, partBReasoning, model: "demo-mock (real LLM emas)" };
}
