// Ishga tushirish: npm run ingest
// data/ papkasidagi har bir .txt faylni bo'laklarga bo'lib, embedding qilib,
// Supabase'ning `documents` jadvaliga yozadi. Har safar qayta ishga tushirsangiz,
// avval o'sha source_name'ga tegishli eski qatorlarni o'chirib, qayta yozadi
// (idempotent — ikki marta bosib nusxa ko'paymaydi).

import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getSupabaseServerClient } from "../lib/supabase";
import { embedDocuments } from "../lib/embeddings";
import { chunkText } from "../lib/chunk";

const DATA_DIR = join(__dirname, "..", "data");
const CHUNK_SIZE = 700; // so'z hisobida, taxminan
const CHUNK_OVERLAP = 80;

async function ingestFile(fileName: string) {
  const fullPath = join(DATA_DIR, fileName);
  const raw = readFileSync(fullPath, "utf-8");
  const chunks = chunkText(raw, CHUNK_SIZE, CHUNK_OVERLAP);

  console.log(`[${fileName}] ${chunks.length} ta bo'lakka bo'lindi`);

  const supabase = getSupabaseServerClient();

  // eski nusxalarni tozalash (qayta ishga tushirilganda dublikat bo'lmasin)
  await supabase.from("documents").delete().eq("source_name", fileName);

  // OpenAI'ga bir martada juda ko'p matn yubormaslik uchun kichik guruhlarga bo'lamiz
  const BATCH = 10;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batchChunks = chunks.slice(i, i + BATCH);
    const embeddings = await embedDocuments(batchChunks);

    const rows = batchChunks.map((content, j) => ({
      source_name: fileName,
      chunk_index: i + j,
      content,
      embedding: embeddings[j],
      metadata: { char_length: content.length },
    }));

    const { error } = await supabase.from("documents").insert(rows);
    if (error) {
      throw new Error(`Supabase insert xatosi (${fileName}): ${error.message}`);
    }
    console.log(`  -> ${i + batchChunks.length}/${chunks.length} yozildi`);
  }
}

async function main() {
  const files = readdirSync(DATA_DIR).filter((f) => f.endsWith(".txt"));
  if (files.length === 0) {
    console.log(`data/ papkasida .txt fayl topilmadi (${DATA_DIR})`);
    return;
  }
  for (const file of files) {
    await ingestFile(file);
  }
  console.log("Tayyor.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
