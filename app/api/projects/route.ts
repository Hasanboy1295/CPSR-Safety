import { NextRequest, NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth-guard";
import { getSupabaseServerAuthClient } from "@/lib/supabase-server-auth";
import { emptyProductInfo, emptyExposure, emptyCertification, emptyProductQuality } from "@/lib/wizard-types";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = await getSupabaseServerAuthClient();
  const { data, error } = await supabase
    .from("cpsr_projects")
    .select("id, product_info, ingredients, status, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ projects: data });
}

export async function POST(req: NextRequest) {
  const user = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const supabase = await getSupabaseServerAuthClient();

  // "login qilsa auto to'ldirilishi" — profildagi kompaniya nomi yangi
  // loyihaga avtomatik ko'chiriladi.
  const { data: profile } = await supabase
    .from("profiles")
    .select("company")
    .eq("id", user.id)
    .single();

  const productInfo = {
    ...emptyProductInfo,
    manufacturer: profile?.company ?? "",
    responsibleSeller: profile?.company ?? "",
  };

  const { data, error } = await supabase
    .from("cpsr_projects")
    .insert({
      user_id: user.id,
      product_info: productInfo,
      ingredients: [],
      product_quality: emptyProductQuality(),
      exposure: emptyExposure,
      certification: emptyCertification,
      status: "draft",
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
