"use client";

import { useWizardText } from "@/lib/i18n";
import type { WizardData, Certification } from "@/lib/wizard-types";
import { calcSED, calcMoS, judge } from "@/lib/calc";
import { field, label, input, card, badge } from "@/lib/wizard-ui";

export function StepCertification({
  data,
  onChange,
}: {
  data: WizardData;
  onChange: (next: Certification) => void;
}) {
  const t = useWizardText();

  function set<K extends keyof Certification>(key: K, v: Certification[K]) {
    onChange({ ...data.certification, [key]: v });
  }

  const A = parseFloat(data.exposure.amountG) || 0;
  const RF = parseFloat(data.exposure.retentionFactor) || 0;
  const BW = parseFloat(data.exposure.bodyWeightKg) || 1;

  const worstMoS = data.ingredients.reduce<number | null>((worst, row) => {
    const C = parseFloat(row.percentInProduct) || 0;
    const DAp = parseFloat(row.dermalAbsorptionPercent) || 0;
    const NOAEL = row.noael ? parseFloat(row.noael) : undefined;
    const sed = calcSED({ amountG: A, retentionFactor: RF, bodyWeightKg: BW }, C, DAp);
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
    </div>
  );
}
