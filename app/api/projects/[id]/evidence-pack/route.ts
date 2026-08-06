import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { buildEvidencePack } from "@/lib/evidence-pack";
import type { CPSRReportDraft } from "@/lib/report";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const supabase = await getSupabaseServerAuthClient();
  // RLS shu yerda ham himoya qiladi — faqat egasi yoki (draft_generated bo'lsa) assessor o'qiy oladi.
  const { data: project, error } = await supabase
    .from("cpsr_projects")
    .select("product_info, ingredients, exposure, report_result")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  if (!project.report_result) {
    return NextResponse.json({ error: "Hali CPSR qoralamasi yaratilmagan" }, { status: 400 });
  }

  const zipBytes = await buildEvidencePack(
    {
      productInfo: project.product_info,
      ingredients: project.ingredients,
      exposure: project.exposure,
    },
    project.report_result as CPSRReportDraft
  );

  return new NextResponse(Buffer.from(zipBytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="evidence_pack_${id.slice(0, 8)}.zip"`,
    },
  });
}
