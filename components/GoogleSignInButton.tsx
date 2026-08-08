"use client";

import { useWizardText } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export function GoogleSignInButton({ next = "/dashboard/wizard", onError }: { next?: string; onError?: (msg: string) => void }) {
  const t = useWizardText();

  async function handleClick() {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) onError?.(error.message);
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("orContinueWith")}</span>
        <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>

      <button
        type="button"
        onClick={handleClick}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          width: "100%",
          padding: "10px 20px",
          fontSize: 14,
          fontWeight: 600,
          background: "#fff",
          color: "#1f1f1f",
          border: "1px solid var(--border)",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.91c1.7-1.57 2.69-3.87 2.69-6.64z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.27c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z" />
          <path fill="#FBBC05" d="M3.96 10.7A5.4 5.4 0 013.68 9c0-.59.1-1.17.28-1.7V4.96H.96A9 9 0 000 9c0 1.45.35 2.83.96 4.04l3-2.34z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.34C4.67 5.16 6.66 3.58 9 3.58z" />
        </svg>
        {t("continueWithGoogle")}
      </button>
    </>
  );
}
