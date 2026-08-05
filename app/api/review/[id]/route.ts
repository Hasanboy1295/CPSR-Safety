import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";

/**
 * Assessor tasdiqi (imzo). MUHIM xavfsizlik qoidasi: assessorName Client'dan
 * OLINMAYDI — server o'zi, hozir login qilgan foydalanuvchining haqiqiy
 * ismidan oladi (profiles.full_name). Shuning uchun hech kim "men X assessorman"
 * deb boshqa birovning nomidan imzo qo'ya olmaydi.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const assessor = await requireRole("assessor");
  if (!assessor) return NextResponse.json({ error: "Assessor access only" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json()) as { finalConclusion?: string };
  if (!body.finalConclusion?.trim()) {
    return NextResponse.json({ error: "'finalConclusion' shart" }, { status: 400 });
  }

  const supabase = await getSupabaseServerAuthClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", assessor.id)
    .single();

  // RLS (projects_assessor_update) bu yozuvni faqat status='draft_generated'
  // bo'lgan loyihalarga cheklaydi — allaqachon imzolangan hujjatni qayta
  // yoza olmaydi.
  const { error } = await supabase
    .from("cpsr_projects")
    .update({
      status: "submission_ready",
      reviewed_by: assessor.id,
      reviewed_at: new Date().toISOString(),
      certification: {
        assessorName: profile?.full_name ?? assessor.email ?? "assessor",
        reviewDate: new Date().toISOString().slice(0, 10),
        draftNotes: body.finalConclusion,
      },
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
