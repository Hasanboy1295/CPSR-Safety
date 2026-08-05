"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useWizardText } from "@/lib/i18n";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { field, label, input, card, btnPrimary } from "@/lib/wizard-ui";

export default function SignupPage() {
  const t = useWizardText();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
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
      // Rol hech qachon bu yerdan yuborilmaydi — profiles.role har doim
      // 'user' bo'lib boshlanadi (DB trigger orqali), 'assessor'ga faqat
      // admin SQL orqali o'tkazadi. Foydalanuvchi o'zini assessor qila olmaydi.
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName, company } },
      });
      if (error) throw error;
      router.push("/dashboard/wizard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: "0 24px" }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>{t("signupTitle")}</h1>
      <form onSubmit={handleSubmit} style={card}>
        <div style={field}>
          <label style={label}>{t("fullName")}</label>
          <input style={input} required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div style={field}>
          <label style={label}>{t("company")}</label>
          <input style={input} value={company} onChange={(e) => setCompany(e.target.value)} />
        </div>
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p style={{ color: "var(--danger)", fontSize: 13.5, marginBottom: 14 }}>{error}</p>}
        <button style={{ ...btnPrimary, width: "100%" }} disabled={loading} type="submit">
          {t("signup")}
        </button>
      </form>
      <p style={{ marginTop: 16, fontSize: 13.5 }}>
        <Link href="/login" style={{ color: "var(--accent)" }}>
          {t("alreadyHaveAccount")}
        </Link>
      </p>
    </main>
  );
}
