"use client";

import { useState } from "react";
import { useWizardText } from "@/lib/i18n";
import type { WizardData, Certification } from "@/lib/wizard-types";
import { flattenIngredients } from "@/lib/wizard-types";
import { calcSED, calcMoS, judge } from "@/lib/calc";
import { field, label, input, card, badge, btnPrimary } from "@/lib/wizard-ui";

type ReportResult = {
  partA?: string;
  partBReasoning?: string;
  demo?: boolean;
  model?: string;
  integrity?: { runId: string; createdAt: string; inputCsvSha: string; configHash: string };
  error?: string;
};

export function StepCertification({
  data,
  onChange,
  projectId,
}: {
  data: WizardData;
  onChange: (next: Certification) => void;
  projectId: string | null;
}) {
  const t = useWizardText();
  const [report, setReport] = useState<ReportResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function generateDraft() {
    setGenerating(true);
    setReport(null);
    setSubmitted(false);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productInfo: data.productInfo,
          ingredients: data.ingredients,
          exposure: data.exposure,
        }),
      });
      const json = (await res.json()) as ReportResult;
      setReport(json);

      // Login qilingan bo'lsa — natijani saqlab, baholovchi navbatiga qo'shadi
      // (status: draft -> draft_generated). Demo rejimda buni qilmaymiz.
      if (projectId && !json.error && !json.demo) {
        await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report_result: json, status: "draft_generated" }),
        });
        setSubmitted(true);
      }
    } catch (err) {
      setReport({ error: err instanceof Error ? err.message : String(err) });
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0 16px" }}>
        <div style={field}>
          <label style={label}>{t("assessorName")}</label>
          <input
            style={input}
            value={data.certification.assessorName}
            onChange={(e) => set("assessorName", e.target.value)}
            placeholder="not_reviewed"
          />
        </div>
        <div style={field}>
          <label style={label}>{t("reviewDate")}</label>
          <input
            style={input}
            type="date"
            value={data.certification.reviewDate}
            onChange={(e) => set("reviewDate", e.target.value)}
          />
        </div>
      </div>
      <div style={field}>
        <label style={label}>{t("draftNotes")}</label>
        <textarea
          style={{ ...input, minHeight: 90, resize: "vertical" }}
          value={data.certification.draftNotes}
          onChange={(e) => set("draftNotes", e.target.value)}
        />
      </div>

      <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 20, marginTop: 4 }}>
        <button style={btnPrimary} onClick={generateDraft} disabled={generating || data.ingredients.length === 0}>
          {generating ? t("generatingDraft") : t("generateDraft")}
        </button>

        {report?.error && (
          <p style={{ color: "var(--danger)", fontSize: 13.5, marginTop: 14 }}>Error: {report.error}</p>
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
            <a
              href={`/api/projects/${projectId}/pdf`}
              style={{
                display: "inline-block",
                marginTop: 14,
                padding: "10px 18px",
                fontSize: 13.5,
                fontWeight: 600,
                color: "#06120d",
                background: "var(--accent)",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              ⬇ {t("downloadPdf")}
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
