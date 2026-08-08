import { NextResponse } from "next/server";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerClient } from "@/lib/supabase";
import { embedDocuments } from "@/lib/embeddings";
import { chunkText } from "@/lib/chunk";

// Vaqtinchalik admin endpoint — data/*.txt fayllarni Supabase'ning `documents`
// jadvaliga (RAG bilim bazasi) yuklaydi. Idempotent — qayta ishga tushirilsa,
// eski qatorlarni o'chirib qayta yozadi. Faqat login qilgan foydalanuvchi
// chaqira oladi (RLS'dan mustaqil, chunki bu service-role orqali yoziladi).

const CHUNK_SIZE = 700;
const CHUNK_OVERLAP = 80;

export async function POST() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const dataDir = join(process.cwd(), "data");
  const files = readdirSync(dataDir).filter((f) => f.endsWith(".txt"));
  const supabase = getSupabaseServerClient();
  const results: { file: string; chunks: number }[] = [];

  for (const fileName of files) {
    const raw = readFileSync(join(dataDir, fileName), "utf-8");
    const chunks = chunkText(raw, CHUNK_SIZE, CHUNK_OVERLAP);

    await supabase.from("documents").delete().eq("source_name", fileName);

    const BATCH = 20;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batchChunks = chunks.slice(i, i + BATCH);
      const embeddings = await embedDocuments(batchChunks);
      const rows = batchChunks.map((content, j) => ({
        source_name: fileName,
        chunk_index: i + j,
        content,
        embedding: embeddings[j],
        metadata: {},
      }));
      const { error } = await supabase.from("documents").insert(rows);
      if (error) {
        return NextResponse.json({ error: `${fileName}: ${error.message}` }, { status: 500 });
      }
    }
    results.push({ file: fileName, chunks: chunks.length });
  }

  return NextResponse.json({ ok: true, results });
}
