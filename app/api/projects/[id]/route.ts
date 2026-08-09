import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { clientError } from "@/lib/errors";

// E'tibor: RLS (supabase/auth_schema.sql) bu yerdagi so'rovlarni ham qo'shimcha
// himoya qiladi — hatto kod xato yozilgan taqdirda ham, boshqa foydalanuvchining
// loyihasini o'qib/yozib bo'lmaydi. Bu "juda mahkam security" — ikki qatlam.
//
// XAVFSIZLIK (qoralama saqlash): report_result va status maydonlari bu yerda
// YO'Q — foydalanuvchi o'zining status'ini ("draft_generated") yoki "AI
// natijasi"ni o'zi yozib bo'lmaydi. Ikkalasi ham faqat server tomonidan,
// /api/generate-report'da (loyiha egasi tekshirilgandan keyin) yoziladi.
// "submission_ready" esa faqat /api/review orqali, haqiqiy assessor qo'yadi.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return clientError("not_authenticated", undefined, 401);

  const { id } = await params;
  const supabase = await getSupabaseServerAuthClient();
  const { data, error } = await supabase
    .from("cpsr_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return clientError("not_found", undefined, 404);
  return NextResponse.json({ project: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return clientError("not_authenticated", undefined, 401);

  const { id } = await params;
  const body = await req.json();

  // Faqat forma maydonlari yangilanadi. status/report_result bu yerda
  // UMUMAN qabul qilinmaydi (server-generatsiyalangan, yuqoridagi izoh).
  const allowed = ["product_info", "ingredients", "product_quality", "exposure", "certification"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const supabase = await getSupabaseServerAuthClient();
  const { error } = await supabase.from("cpsr_projects").update(patch).eq("id", id);

  if (error) return clientError("supabase_query", undefined, 500);

  return NextResponse.json({ ok: true });
}
