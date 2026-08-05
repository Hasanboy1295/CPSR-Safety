"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLanguage, useWizardText } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AuthStatus } from "@/components/AuthStatus";
import type { WizardData } from "@/lib/wizard-types";
import { flattenIngredients } from "@/lib/wizard-types";
import { calcSED, calcMoS, judge } from "@/lib/calc";
import { card, badge, field, label, input, btnPrimary } from "@/lib/wizard-ui";

type ProjectListItem = {
  id: string;
  product_info: WizardData["productInfo"];
  status: string;
  updated_at: string;
};

type ProjectDetail = {
  id: string;
  product_info: WizardData["productInfo"];
  ingredients: WizardData["ingredients"];
  exposure: WizardData["exposure"];
  report_result?: { partA?: string; partBReasoning?: string } | null;
};

export default function ReviewPage() {
  const { t: tBrand } = useLanguage();
  const t = useWizardText();
  const [list, setList] = useState<ProjectListItem[] | null>(null);
  const [selected, setSelected] = useState<ProjectDetail | null>(null);
  const [conclusion, setConclusion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => setList(d.projects ?? []))
      .catch((e) => setError(String(e)));
  }, []);

  async function openProject(id: string) {
    setSelected(null);
    setConclusion("");
    const res = await fetch(`/api/projects/${id}`);
    const json = await res.json();
    if (json.project) {
      setSelected({
        id: json.project.id,
        product_info: json.project.product_info,
        ingredients: json.project.ingredients,
        exposure: json.project.exposure,
        report_result: json.project.report_result,
      });
    }
  }

  async function approve() {
    if (!selected || !conclusion.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/review/${selected.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalConclusion: conclusion }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setList((prev) => prev?.filter((p) => p.id !== selected.id) ?? null);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
        <div>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            ← {tBrand("brand")}
          </Link>
          <h1 style={{ fontSize: 24, margin: "10px 0 4px" }}>{t("reviewQueue")}</h1>
          <span style={badge("review")}>{t("assessorOnly")}</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <LanguageToggle />
          <AuthStatus />
        </div>
      </div>

      {error && <p style={{ color: "var(--danger)", fontSize: 13.5 }}>{error}</p>}

      {!selected && (
        <div style={{ display: "grid", gap: 12 }}>
          {list?.length === 0 && <p style={{ color: "var(--text-muted)" }}>{t("noProjectsYet")}</p>}
          {list?.map((p) => (
            <div key={p.id} style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.product_info?.productName || "—"}</div>
                <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                  {new Date(p.updated_at).toLocaleString()}
                </div>
              </div>
              <button style={btnPrimary} onClick={() => openProject(p.id)}>
                {t("openProject")}
              </button>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div style={card}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>{selected.product_info.productName}</h3>
          <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 18 }}>
            {flattenIngredients(selected.ingredients).length} ingredients
          </p>

          {flattenIngredients(selected.ingredients).map((c) => {
            const A = parseFloat(selected.exposure.amountG) || 0;
            const RF = parseFloat(selected.exposure.retentionFactor) || 0;
            const BW = parseFloat(selected.exposure.bodyWeightKg) || 1;
            const DAp = parseFloat(c.dermalAbsorptionPercent) || 0;
            const noael = c.noael ? parseFloat(c.noael) : undefined;
            const sed = calcSED({ amountG: A, retentionFactor: RF, bodyWeightKg: BW }, c.percentInProduct, DAp);
            const mos = calcMoS(noael, sed);
            const verdict = judge(mos);
            return (
              <div key={c.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px dashed var(--border)" }}>
                <span>{c.inciName}</span>
                <span style={badge(verdict === "pass" ? "pass" : verdict === "review" ? "review" : "insufficient")}>
                  MoS {mos === null ? "—" : mos.toFixed(1)}
                </span>
              </div>
            );
          })}

          {selected.report_result?.partA && (
            <div style={{ marginTop: 16, fontSize: 13, whiteSpace: "pre-wrap", color: "var(--text-muted)" }}>
              {selected.report_result.partA}
            </div>
          )}

          <div style={{ ...field, marginTop: 20 }}>
            <label style={label}>{t("finalConclusion")}</label>
            <textarea
              style={{ ...input, minHeight: 110, resize: "vertical" }}
              value={conclusion}
              onChange={(e) => setConclusion(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button style={btnPrimary} disabled={submitting || !conclusion.trim()} onClick={approve}>
              {t("approveAndSign")}
            </button>
            <button
              style={{ ...btnPrimary, background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)" }}
              onClick={() => setSelected(null)}
            >
              ← {t("reviewQueue")}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
