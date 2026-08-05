"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWizardText } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthStatus() {
  const t = useWizardText();
  const router = useRouter();
  const [email, setEmail] = useState<string | null | undefined>(undefined); // undefined = loading

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      setEmail(null); // Supabase sozlanmagan (DEMO rejim) — auth ko'rsatilmaydi
      return;
    }
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (email === undefined) return null;

  if (!email) {
    return (
      <Link
        href="/login"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--accent)",
          textDecoration: "none",
          padding: "6px 12px",
          border: "1px solid var(--accent)",
          borderRadius: 999,
        }}
      >
        {t("login")}
      </Link>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{email}</span>
      <button
        onClick={handleLogout}
        style={{
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--text-muted)",
          background: "transparent",
          border: "1px solid var(--border)",
          borderRadius: 999,
          padding: "5px 12px",
          cursor: "pointer",
        }}
      >
        {t("logout")}
      </button>
    </div>
  );
}
