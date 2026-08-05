import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";

// Faqat role='assessor' bo'lgan foydalanuvchi kira oladi (server-side tekshiruv,
// middleware.ts'dagi sahifa-darajasidagi tekshiruvdan MUSTAQIL — ikkalasi ham
// ishlaydi, biri chetlab o'tilsa ham ikkinchisi ushlaydi).
export async function GET() {
  const assessor = await requireRole("assessor");
  if (!assessor) return NextResponse.json({ error: "Assessor access only" }, { status: 403 });

  const supabase = await getSupabaseServerAuthClient();
  // RLS (projects_assessor_select) bu so'rovni "status=draft_generated" bilan
  // qo'shimcha cheklaydi — kod xato yozilsa ham boshqa narsa qaytmaydi.
  const { data, error } = await supabase
    .from("cpsr_projects")
    .select("id, product_info, status, updated_at, user_id")
    .eq("status", "draft_generated")
    .order("updated_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}
