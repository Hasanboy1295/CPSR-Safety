import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";

// E'tibor: RLS (supabase/auth_schema.sql) bu yerdagi so'rovlarni ham qo'shimcha
// himoya qiladi — hatto kod xato yozilgan taqdirda ham, boshqa foydalanuvchining
// loyihasini o'qib/yozib bo'lmaydi. Bu "juda mahkam security" — ikki qatlam.

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const supabase = await getSupabaseServerAuthClient();
  const { data, error } = await supabase
    .from("cpsr_projects")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ project: data });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  // Faqat ruxsat etilgan maydonlar yangilanadi — user o'zining status'ini
  // to'g'ridan-to'g'ri "submission_ready" qila olmaydi (bu assessor ishi,
  // pastdagi /api/review orqali).
  const allowed = ["product_info", "ingredients", "exposure", "certification", "report_result", "status"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }
  if (patch.status === "submission_ready") {
    delete patch.status; // bu holat faqat assessor tomonidan o'rnatiladi
  }

  const supabase = await getSupabaseServerAuthClient();
  const { error } = await supabase.from("cpsr_projects").update(patch).eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
