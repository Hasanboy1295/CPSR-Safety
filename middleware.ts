import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Bu — Trip Agency'dagi AuthGuard/RolesGuard'ning Next.js ekvivalenti:
// har so'rovda sessiyani tekshiradi va himoyalangan route'larni qo'riqlaydi.
// Bu — SERVER'da ishlaydi, Client uni chetlab o'ta olmaydi.

const PROTECTED_PREFIXES = ["/dashboard"];
const ASSESSOR_ONLY_PREFIXES = ["/review"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    // Kalitlar hali sozlanmagan (masalan DEMO rejim) — auth tekshiruvini
    // o'tkazib yuboramiz, RAG/LLM demo qismi baribir ishlayveradi.
    return response;
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const needsAuth = PROTECTED_PREFIXES.some((p) => path.startsWith(p));
  const needsAssessor = ASSESSOR_ONLY_PREFIXES.some((p) => path.startsWith(p));

  if ((needsAuth || needsAssessor) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  if (needsAssessor && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "assessor") {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/review/:path*"],
};
