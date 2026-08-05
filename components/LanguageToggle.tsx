"use client";

import { useLanguage } from "@/lib/i18n";

export function LanguageToggle() {
  const { lang, setLang } = useLanguage();

  const btn = (value: "en" | "ko", label: string) => (
    <button
      onClick={() => setLang(value)}
      style={{
        padding: "6px 12px",
        fontSize: 13,
        fontWeight: 600,
        borderRadius: 999,
        border: "1px solid var(--border)",
        background: lang === value ? "var(--accent)" : "transparent",
        color: lang === value ? "#06120d" : "var(--text-muted)",
        cursor: "pointer",
        transition: "background 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 3,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        borderRadius: 999,
      }}
    >
      {btn("en", "EN")}
      {btn("ko", "한국어")}
    </div>
  );
}
