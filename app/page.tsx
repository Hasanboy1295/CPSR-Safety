"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage, translateError } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AuthStatus } from "@/components/AuthStatus";

type Source = {
  source_name: string;
  content: string;
  similarity: number;
};

type ApiResponse = {
  answer?: string;
  sources?: Source[];
  model?: string;
  demo?: boolean;
  error?: string;
  error_code?: string;
  message?: string;
};

const STEP_STATUS: Record<string, "live" | "planned"> = {
  stepProductInfo: "live",
  stepIngredients: "live",
  stepToxicology: "live",
  stepCertification: "live",
};

const STEPS = [
  { key: "stepProductInfo", descKey: "stepProductInfoDesc" },
  { key: "stepIngredients", descKey: "stepIngredientsDesc" },
  { key: "stepToxicology", descKey: "stepToxicologyDesc" },
  { key: "stepCertification", descKey: "stepCertificationDesc" },
] as const;

const REGS = ["MFDS (KR)", "SCCS (EU)", "MoCRA (US)", "NMPA (CN)"];

function Section({
  id,
  children,
  muted,
}: {
  id?: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <section
      id={id}
      style={{
        background: muted ? "var(--surface)" : "transparent",
        borderTop: muted ? "1px solid var(--border)" : undefined,
        borderBottom: muted ? "1px solid var(--border)" : undefined,
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "64px 24px" }}>
        {children}
      </div>
    </section>
  );
}

export default function Home() {
  const { t, lang } = useLanguage();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ApiResponse | null>(null);

  async function ask() {
    if (!question.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/rag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as ApiResponse;
      setResult(json);
    } catch (err) {
      setResult({ error_code: "generic", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      {/* Header */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: "rgba(10,14,13,0.85)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: "0 auto",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 17, letterSpacing: "-0.01em" }}>
              {t("brand")}
            </span>
            <span
              style={{
                fontSize: 11,
                fontFamily: "var(--font-mono)",
                color: "var(--gold)",
                border: "1px solid var(--gold)",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              PROTOTYPE
            </span>
          </div>
          <nav style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <a href="#demo" style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none" }}>
              {t("navDemo")}
            </a>
            <a href="#pipeline" style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none" }}>
              {t("navPipeline")}
            </a>
            <a href="#compliance" style={{ fontSize: 14, color: "var(--text-muted)", textDecoration: "none" }}>
              {t("navCompliance")}
            </a>
            <LanguageToggle />
            <AuthStatus />
          </nav>
        </div>
      </header>

      {/* Hero */}
      <Section>
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "var(--accent)",
            margin: "0 0 16px",
          }}
        >
          {t("tagline")}
        </p>
        <h1
          style={{
            fontSize: "clamp(30px, 5vw, 44px)",
            lineHeight: 1.15,
            margin: "0 0 20px",
            maxWidth: "18ch",
          }}
        >
          {t("heroTitle")}
        </h1>
        <p style={{ fontSize: 17, color: "var(--text-muted)", maxWidth: 640, margin: "0 0 28px" }}>
          {t("heroBody")}
        </p>
        <a
          href="#demo"
          style={{
            display: "inline-block",
            background: "var(--accent)",
            color: "#06120d",
            fontWeight: 700,
            fontSize: 14,
            padding: "12px 22px",
            borderRadius: 999,
            textDecoration: "none",
          }}
        >
          {t("ctaTry")} →
        </a>
      </Section>

      {/* Live demo */}
      <Section id="demo" muted>
        <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>{t("demoTitle")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14.5, margin: "0 0 24px", maxWidth: 640 }}>
          {t("demoBody")}
        </p>

        <div
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: 20,
          }}
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={t("demoPlaceholder")}
            rows={3}
            style={{
              width: "100%",
              padding: 12,
              fontSize: 14,
              background: "var(--bg)",
              color: "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <button
            onClick={ask}
            disabled={loading}
            style={{
              marginTop: 12,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              background: "var(--accent)",
              color: "#06120d",
              border: "none",
              borderRadius: 8,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? t("demoButtonLoading") : t("demoButton")}
          </button>

          {result?.error && (
            <p style={{ color: "var(--danger)", marginTop: 16, fontSize: 14 }}>
              {translateError(result.error_code, result.error, lang)}
            </p>
          )}

          {result?.demo && (
            <p
              style={{
                marginTop: 16,
                padding: "10px 14px",
                background: "var(--gold-soft)",
                border: "1px solid var(--gold)",
                borderRadius: 8,
                fontSize: 13,
                color: "var(--gold)",
              }}
            >
              ⚠ {t("demoBanner")}
            </p>
          )}

          {result?.answer && (
            <div style={{ marginTop: 20 }}>
              <p
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--text-muted)",
                  margin: "0 0 6px",
                }}
              >
                {t("demoAnswerLabel")} · {result.model}
              </p>
              <p style={{ whiteSpace: "pre-wrap", fontSize: 14.5 }}>{result.answer}</p>

              {result.sources && result.sources.length > 0 && (
                <>
                  <p
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      margin: "20px 0 10px",
                    }}
                  >
                    {t("demoSourcesLabel")}
                  </p>
                  {result.sources.map((s, i) => (
                    <div
                      key={i}
                      style={{
                        borderLeft: "2px solid var(--accent)",
                        paddingLeft: 12,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600 }}>
                        {s.source_name}{" "}
                        <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>
                          ({s.similarity.toFixed(2)})
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                        {s.content.slice(0, 180)}...
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </Section>

      {/* Pipeline */}
      <Section id="pipeline">
        <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>{t("pipelineTitle")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14.5, margin: "0 0 20px" }}>
          {t("pipelineBody")}
        </p>
        <Link
          href="/dashboard/wizard"
          style={{
            display: "inline-block",
            marginBottom: 24,
            padding: "10px 18px",
            fontSize: 13.5,
            fontWeight: 600,
            borderRadius: 8,
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          {t("stepProductInfo")} → {t("stepCertification")} · {t("ctaTry")} →
        </Link>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {STEPS.map((step, i) => {
            const status = STEP_STATUS[step.key];
            return (
              <Link
                key={step.key}
                href="/dashboard/wizard"
                style={{
                  display: "block",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  padding: 18,
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-muted)" }}>
                    0{i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: status === "live" ? "var(--accent-soft)" : "var(--surface-2)",
                      color: status === "live" ? "var(--accent)" : "var(--text-muted)",
                      border: status === "live" ? "1px solid var(--accent)" : "1px solid var(--border)",
                    }}
                  >
                    {status === "live" ? t("statusLive") : t("statusPlanned")}
                  </span>
                </div>
                <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>{t(step.key)}</h3>
                <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{t(step.descKey)}</p>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* Compliance */}
      <Section id="compliance" muted>
        <h2 style={{ fontSize: 22, margin: "0 0 8px" }}>{t("complianceTitle")}</h2>
        <p style={{ color: "var(--text-muted)", fontSize: 14.5, margin: "0 0 24px", maxWidth: 640 }}>
          {t("complianceBody")}
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          {REGS.map((r) => (
            <span
              key={r}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                padding: "8px 16px",
                borderRadius: 8,
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
              }}
            >
              {r}
            </span>
          ))}
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", maxWidth: 640, marginBottom: 32 }}>
          {t("complianceNote")}
        </p>

        <h3 style={{ fontSize: 15, margin: "0 0 6px" }}>{t("timelineTitle")}</h3>
        <p style={{ color: "var(--text-muted)", fontSize: 13.5, margin: "0 0 16px", maxWidth: 640 }}>
          {t("timelineBody")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
          {(
            [
              { year: "2026", key: "timeline2026", tone: "var(--accent)" },
              { year: "2027–2030", key: "timeline2027", tone: "var(--gold)" },
              { year: "2031", key: "timeline2031", tone: "var(--danger)" },
            ] as const
          ).map((phase) => (
            <div
              key={phase.year}
              style={{
                borderLeft: `3px solid ${phase.tone}`,
                background: "var(--surface-2)",
                borderRadius: "0 8px 8px 0",
                padding: "12px 14px",
              }}
            >
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 12.5, fontWeight: 700, color: phase.tone }}>
                {phase.year}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>{t(phase.key)}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Footer */}
      <footer style={{ maxWidth: 920, margin: "0 auto", padding: "32px 24px 60px" }}>
        <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {t("brand")} · {t("footerNote")}
        </p>
      </footer>
    </main>
  );
}
