import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { parseDocumentToText } from "@/lib/document-parse";
import { extractToxicologyFromText } from "@/lib/extract-llm";

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const knownComponentsRaw = form.get("knownComponents");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "'file' maydoni shart" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fayl hajmi 10MB dan katta" }, { status: 400 });
  }

  let knownComponents: { inciName: string; cas: string }[] = [];
  try {
    knownComponents = JSON.parse(typeof knownComponentsRaw === "string" ? knownComponentsRaw : "[]");
  } catch {
    knownComponents = [];
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseDocumentToText(buffer, file.name);
    if (!text.trim()) {
      return NextResponse.json({ error: "Hujjatdan matn chiqmadi (bo'sh yoki tanib bo'lmaydigan format)" }, { status: 400 });
    }
    const updates = await extractToxicologyFromText(text, knownComponents);
    return NextResponse.json({ updates });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Noma'lum xato";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
