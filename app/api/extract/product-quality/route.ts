import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { parseDocumentToText } from "@/lib/document-parse";
import { extractProductQualityFromText } from "@/lib/extract-llm";

const MAX_BYTES = 4 * 1024 * 1024; // 4MB — Vercel serverless funksiyalarining qattiq chegarasi (4.5MB) dan past

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "'file' maydoni shart" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Fayl hajmi 4MB dan katta" }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await parseDocumentToText(buffer, file.name);
    if (!text.trim()) {
      return NextResponse.json({ error: "Hujjatdan matn chiqmadi" }, { status: 400 });
    }
    const fields = await extractProductQualityFromText(text);
    return NextResponse.json({ fields });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Noma'lum xato";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
