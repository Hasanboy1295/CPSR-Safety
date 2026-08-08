"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWizardText } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { field, label, input, card, btnPrimary } from "@/lib/wizard-ui";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

function LoginForm() {
  const t = useWizardText();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push(searchParams.get("next") || "/dashboard/wizard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>{t("loginTitle")}</h1>
      <form onSubmit={handleSubmit} style={card}>
        <div style={field}>
          <label style={label}>{t("email")}</label>
          <input style={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("password")}</label>
          <input
            style={input}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 13.5, marginBottom: 14 }}>{error}</p>}
        <button style={{ ...btnPrimary, width: "100%" }} disabled={loading} type="submit">
          {t("login")}
        </button>
      </form>

      <GoogleSignInButton next={searchParams.get("next") || "/dashboard/wizard"} onError={setError} />

      <p style={{ marginTop: 16, fontSize: 13.5 }}>
        <Link href="/signup" style={{ color: "var(--accent)" }}>
          {t("noAccount")}
        </Link>
      </p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
