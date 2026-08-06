import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "cpsr-artifacts";

/** Faylni bir marta yozadi — path run_id'ga bog'liq bo'lgani uchun overwrite bo'lmaydi (immutable). */
export async function uploadArtifact(
  supabase: SupabaseClient,
  projectId: string,
  runId: string,
  filename: string,
  bytes: Uint8Array,
  contentType: string
): Promise<string> {
  const path = `${projectId}/${runId}/${filename}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error && !error.message.includes("already exists")) throw error;
  return path;
}

export async function downloadArtifact(supabase: SupabaseClient, path: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  return new Uint8Array(await data.arrayBuffer());
}
