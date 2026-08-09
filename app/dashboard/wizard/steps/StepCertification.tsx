"use client";

import { useState } from "react";
import { useLanguage, useWizardText, translateError } from "@/lib/i18n";
import type { WizardData, Certification } from "@/lib/wizard-types";
import { flattenIngredients } from "@/lib/wizard-types";
import { calcSED, calcMoS, judge } from "@/lib/calc";
import type { CalcRow } from "@/lib/calc";
import type { RetrievedChunk } from "@/lib/rag";
import { field, label, input, card, badge, btnPrimary, btnGradient } from "@/lib/wizard-ui";

type ReportResult = {
  partA?: string;
  partBReasoning?: string;
  demo?: boolean;
  model?: string;
  calcRows?: CalcRow[];
  sources?: RetrievedChunk[];
  integrity?: { runId: string; createdAt: string; inputCsvSha: string; configHash: string };
  error?: string;
  error_code?: string;
  message?: string;
  saved?: boolean;
};

export function StepCertification({
  data,
  onChange,
  projectId,
  projectStatus,
  onStatusChange,
}: {
  data: WizardData;
  onChange: (next: Certification) => void;
  projectId: string | null;
  projectStatus: string;
  onStatusChange: (next: string) => void;
}) {
  const { lang } = useLanguage();
  const t = useWizardText();
  const [report, setReport] = useState<ReportResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState(projectStatus !== "draft");

  // "submission_ready" — /api/review orqali, HAQIQIY baholovchi tasdiqlagan
  // holat. Bu yerda bo'lmasa, hozircha faqat qoralama (not_reviewed).
  const isSigned = projectStatus === "submission_ready";

  async function generateDraft() {
    setGenerating(true);
    setReport(null);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId ?? undefined,
          productInfo: data.productInfo,
          ingredients: data.ingredients,
          productQuality: data.productQuality,
          exposure: data.exposure,
        }),
      });
      const json = (await res.json()) as ReportResult;
      setReport(json);

      // MUHIM XAVFSIZLIK: qoralama endi mijoz orqali SAQLANMAYDI — /api/generate-report
      // server tomonidan o'zi saqlaydi (status -> draft_generated) va json.saved=true
      // qaytaradi. Bu yerda hech qachon "submission_ready" o'rnatilmaydi — faqat
      // /api/review orqali, haqiqiy baholovchi tomonidan.
      if (json.saved) {
        setSubmitted(true);
        onStatusChange("draft_generated");
      }
    } catch (err) {
      setReport({ error_code: "generic", error: err instanceof Error ? err.message : String(err) });
    } finally {
      setGenerating(false);
    }
  }

  function set<K extends keyof Certification>(key: K, v: Certification[K]) {
    onChange({ ...data.certification, [key]: v });
  }

  const A = parseFloat(data.exposure.amountG) || 0;
  const RF = parseFloat(data.exposure.retentionFactor) || 0;
  const BW = parseFloat(data.exposure.bodyWeightKg) || 1;

  const flatComponents = flattenIngredients(data.ingredients);
  const worstMoS = flatComponents.reduce<number | null>((worst, c) => {
    const DAp = parseFloat(c.dermalAbsorptionPercent) || 0;
    const NOAEL = c.noael ? parseFloat(c.noael) : undefined;
    const sed = calcSED({ amountG: A, retentionFactor: RF, bodyWeightKg: BW }, c.percentInProduct, DAp);
    const mos = calcMoS(NOAEL, sed);
    if (mos === null) return worst;
    if (worst === null || mos < worst) return mos;
    return worst;
  }, null);
  const overallVerdict = judge(worstMoS);

  return (
    <div style={card}>
      <div
        style={{
          background: "var(--gold-soft)",
          border: "1px solid var(--gold)",
          borderRadius: 8,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <span style={badge("review")}>{t("statusDraft")}</span>
        <p style={{ fontSize: 13.5, color: "var(--gold)", margin: "10px 0 0" }}>
          {t("statusDraftBody")}
        </p>
      </div>

      <h3 style={{ fontSize: 14, marginBottom: 10 }}>{t("summaryTitle")}</h3>
      <div
        style={{
          fontSize: 13.5,
          color: "var(--text-muted)",
          marginBottom: 24,
          display: "grid",
          gap: 6,
        }}
      >
        <div>
          {t("productName")}: <b style={{ color: "var(--text)" }}>{data.productInfo.productName || "—"}</b>
        </div>
        <div>
          {t("stepIngredients")}:{" "}
          <b style={{ color: "var(--text)" }}>{data.ingredients.length}</b>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {t("mos")} ({t("judgment")}):
          {worstMoS === null ? (
            <span style={badge("insufficient")}>{t("judgmentInsufficient")}</span>
          ) : (
            <span style={badge(overallVerdict === "pass" ? "pass" : "review")}>
              {worstMoS.toFixed(1)} —{" "}
              {overallVerdict === "pass" ? t("judgmentPass") : t("judgmentReview")}
            </span>
          )}
        </div>
      </div>

      <div style={field}>
        <label style={label}>{t("draftNotes")}</label>
        <textarea
          style={{ ...input, minHeight: 90, resize: "vertical" }}
          value={data.certification.draftNotes}
          onChange={(e) => set("draftNotes", e.target.value)}
          placeholder={t("draftNotesHint")}
        />
      </div>

      {/* Tayyorlovchi bu yerda "baholovchi" maydonlarini o'zi to'ldirmaydi —
          bu maydonlar (ism/lavozim/malaka/sana) FAQAT /api/review orqali,
          haqiqiy assessor tomonidan, serverda o'rnatiladi. */}
      {isSigned ? (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "10px 14px",
            marginBottom: 20,
            background: "var(--success-soft)",
            border: "1px solid var(--success)",
            borderRadius: 8,
            fontSize: 12.5,
          }}
        >
          <span style={{ color: "var(--success)" }}>
            ✓ {t("signedByLabel")}: {data.certification.assessorName || "—"}
            {data.certification.assessorPosition && ` · ${data.certification.assessorPosition}`}
          </span>
          <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {data.certification.reviewDate}
          </span>
        </div>
      ) : (
        submitted && (
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 20,
              background: "var(--gold-soft)",
              border: "1px solid var(--gold)",
              borderRadius: 8,
              fontSize: 12.5,
              color: "var(--gold)",
            }}
          >
            ⏳ {t("waitingForAssessor")}
          </div>
        )
      )}

      <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 20, marginTop: 4 }}>
        <button style={btnPrimary} onClick={generateDraft} disabled={generating || data.ingredients.length === 0}>
          {generating ? t("generatingDraft") : t("generateDraft")}
        </button>

        {report?.error && (
          <p style={{ color: "var(--danger)", fontSize: 13.5, marginTop: 14 }}>
            {translateError(report.error_code, report.error, lang)}
          </p>
        )}

        {submitted && (
          <p
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: "var(--accent-soft)",
              border: "1px solid var(--accent)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--accent)",
            }}
          >
            ✓ {t("submitForReview")}
          </p>
        )}

        {submitted && projectId && (
          <>
            {/* Qoralama PDF — har doim mavjud, lekin ANIQ "not_reviewed" deb
                belgilangan (lib/pdf-report.ts cover sahifasida ko'rsatiladi). */}
            <a
              href={`/api/projects/${projectId}/pdf`}
              style={{
                display: "inline-block",
                marginTop: 14,
                padding: "10px 18px",
                fontSize: 13.5,
                fontWeight: 600,
                textDecoration: "none",
                borderRadius: 8,
                ...(isSigned ? btnGradient : { ...btnPrimary, background: "var(--surface-2)", color: "var(--text-muted)" }),
              }}
            >
              ⬇ {isSigned ? t("downloadPdfSigned") : t("downloadPdfDraft")}
            </a>
            <a
              href={`/api/projects/${projectId}/evidence-pack`}
              style={{
                display: "inline-block",
                marginTop: 14,
                marginLeft: 10,
                padding: "10px 18px",
                fontSize: 13.5,
                fontWeight: 600,
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              ⬇ {t("downloadEvidencePack")}
            </a>
          </>
        )}

        {report?.demo && (
          <p
            style={{
              marginTop: 14,
              padding: "10px 14px",
              background: "var(--gold-soft)",
              border: "1px solid var(--gold)",
              borderRadius: 8,
              fontSize: 13,
              color: "var(--gold)",
            }}
          >
            ⚠ {t("demoNotice")}
          </p>
        )}

        {report?.calcRows && report.calcRows.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13.5, marginBottom: 8 }}>{t("resultsTableTitle")}</h4>
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)", textAlign: "left" }}>
                    <th style={{ padding: "9px 12px" }}>{t("inciCol")}</th>
                    <th style={{ padding: "9px 12px" }}>{t("sedCol")}</th>
                    <th style={{ padding: "9px 12px" }}>{t("noaelCol")}</th>
                    <th style={{ padding: "9px 12px" }}>{t("mosCol")}</th>
                    <th style={{ padding: "9px 12px" }}>{t("judgmentCol")}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.calcRows.map((r, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>
                        {r.inciName || "—"}
                        {r.restrictedNote && (
                          <div style={{ marginTop: 3 }}>
                            <span style={badge("insufficient")}>⚠ {r.restrictedNote}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono)" }}>{r.sed.toFixed(4)}</td>
                      <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                        {r.noael ?? "검토필요"}
                      </td>
                      <td style={{ padding: "9px 12px", fontFamily: "var(--font-mono)" }}>
                        {r.mos === null ? "—" : r.mos.toFixed(1)}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={badge(r.judgment === "pass" ? "pass" : r.judgment === "review" ? "review" : "insufficient")}>
                          {r.judgment === "pass" ? t("judgmentPass") : r.judgment === "review" ? t("judgmentReview") : t("judgmentInsufficient")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report?.partA && (
          <div style={{ marginTop: 20 }}>
            <h4 style={{ fontSize: 13.5, marginBottom: 8 }}>{t("partATitle")}</h4>
            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                fontSize: 13.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {report.partA}
            </div>

            <h4 style={{ fontSize: 13.5, margin: "18px 0 8px" }}>{t("partBTitle")}</h4>
            <div
              style={{
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                fontSize: 13.5,
                whiteSpace: "pre-wrap",
              }}
            >
              {report.partBReasoning}
            </div>

            {report.sources && report.sources.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <h4 style={{ fontSize: 13.5, marginBottom: 8 }}>{t("sourcesTitle")}</h4>
                <div style={{ display: "grid", gap: 6 }}>
                  {report.sources.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        fontSize: 12,
                        color: "var(--text-muted)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <span>{s.source_name}</span>
                      <span style={{ fontFamily: "var(--font-mono)" }}>{(s.similarity * 100).toFixed(0)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.integrity && (
              <>
                <h4 style={{ fontSize: 13.5, margin: "18px 0 8px" }}>{t("dataIntegrityTitle")}</h4>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    color: "var(--text-muted)",
                    display: "grid",
                    gap: 4,
                  }}
                >
                  <div>
                    {t("runId")}: {report.integrity.runId}
                  </div>
                  <div>
                    {t("generatedAt")}: {report.integrity.createdAt}
                  </div>
                  <div>
                    {t("inputHash")}: {report.integrity.inputCsvSha.slice(0, 24)}...
                  </div>
                  <div>
                    {t("configHash")}: {report.integrity.configHash.slice(0, 24)}...
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
