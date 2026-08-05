import { getSupabaseServerAuthClient } from "./supabase-server-auth";

export type AuthedUser = {
  id: string;
  email: string | undefined;
  role: "user" | "assessor";
};

/**
 * API route'ning boshida chaqiriladi. Trip Agency'dagi AuthGuard bilan bir xil
 * vazifa: token/sessiya yo'q bo'lsa null qaytaradi, route esa 401 qaytaradi.
 * Client'dan kelgan "men shu userman" degan da'voga HECH QACHON ishonilmaydi —
 * sessiya har doim serverda, cookie orqali qayta tekshiriladi.
 */
export async function getAuthedUser(): Promise<AuthedUser | null> {
  // Supabase hali sozlanmagan bo'lsa (DEMO rejim) — "login qilinmagan" deb
  // hisoblanadi, 500 xato bilan qulamaydi.
  let supabase;
  try {
    supabase = await getSupabaseServerAuthClient();
  } catch {
    return null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: user.email,
    role: (profile?.role as "user" | "assessor") ?? "user",
  };
}

/**
 * Trip Agency'dagi RolesGuard ekvivalenti — faqat berilgan rolga ruxsat.
 * Route handler'da: const user = await requireRole("assessor"); agar null
 * bo'lsa, chaqiruvchi 403 qaytarishi kerak.
 */
export async function requireRole(
  role: AuthedUser["role"]
): Promise<AuthedUser | null> {
  const user = await getAuthedUser();
  if (!user || user.role !== role) return null;
  return user;
}
