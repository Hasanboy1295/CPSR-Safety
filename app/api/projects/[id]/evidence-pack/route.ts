import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { buildEvidencePack } from "@/lib/evidence-pack";
import { downloadArtifact } from "@/lib/storage";
import type { CPSRReportDraft } from "@/lib/report";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { id } = await params;
  const supabase = await getSupabaseServerAuthClient();
  const { data: project, error } = await supabase
    .from("cpsr_projects")
    .select("product_info, ingredients, product_quality, exposure, report_result, evidence_pack_path")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  if (!project.report_result) {
    return NextResponse.json({ error: "Hali CPSR qoralamasi yaratilmagan" }, { status: 400 });
  }

  // Avval DOIMIY saqlangan faylni izlaydi (ALCOA+ "Enduring" — hech qachon qayta
  // yaratilmaydi). Faqat u topilmasa (eski/demo ma'lumot) — on-the-fly yasaydi.
  let bytes: Uint8Array;
  if (project.evidence_pack_path) {
    bytes = await downloadArtifact(supabase, project.evidence_pack_path);
  } else {
    bytes = await buildEvidencePack(
      {
        productInfo: project.product_info,
        ingredients: project.ingredients,
        productQuality: project.product_quality,
        exposure: project.exposure,
      },
      project.report_result as CPSRReportDraft
    );
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="evidence_pack_${id.slice(0, 8)}.zip"`,
    },
  });
}
