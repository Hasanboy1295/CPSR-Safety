"use client";

import { useState } from "react";
import { useWizardText } from "@/lib/i18n";
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
          productQuality: data.productQuality,
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
          <label style={label}>{t("assessorPosition")}</label>
          <input
            style={input}
            value={data.certification.assessorPosition}
            onChange={(e) => set("assessorPosition", e.target.value)}
          />
        </div>
        <div style={field}>
          <label style={label}>{t("assessorQualification")}</label>
          <input
            style={input}
            value={data.certification.assessorQualification}
            onChange={(e) => set("assessorQualification", e.target.value)}
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

      <label style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "var(--text-muted)", marginBottom: 20, cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={data.certification.selfCertified}
          onChange={(e) => set("selfCertified", e.target.checked)}
          style={{ marginTop: 2 }}
        />
        {t("selfCertifyLabel")}
      </label>

      {data.certification.selfCertified && report?.integrity && (
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
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--success)" }}>
            ✓ {t("integrityVerified")}: SHA256 {report.integrity.inputCsvSha.slice(0, 8)}...{report.integrity.inputCsvSha.slice(-6)}
          </span>
          <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {t("issuedOn")}: {new Date(report.integrity.createdAt).toLocaleDateString()}
          </span>
        </div>
      )}

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
                textDecoration: "none",
                borderRadius: 8,
                pointerEvents: data.certification.selfCertified ? "auto" : "none",
                opacity: data.certification.selfCertified ? 1 : 0.5,
                ...(data.certification.selfCertified ? btnGradient : { ...btnPrimary, background: "var(--surface-2)", color: "var(--text-muted)" }),
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
                pointerEvents: data.certification.selfCertified ? "auto" : "none",
                opacity: data.certification.selfCertified ? 1 : 0.5,
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
