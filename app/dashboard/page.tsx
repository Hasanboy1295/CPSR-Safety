"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWizardText } from "@/lib/i18n";
import type { WizardData, IngredientRow } from "@/lib/wizard-types";
import { flattenIngredients } from "@/lib/wizard-types";
import { badge, btnPrimary, statCard } from "@/lib/wizard-ui";
import { RESTRICTED_SUBSTANCES } from "@/lib/restricted-list";

type ProjectListItem = {
  id: string;
  product_info: WizardData["productInfo"];
  ingredients: IngredientRow[] | null;
  status: string;
  updated_at: string;
};

function statusTone(status: string): "pass" | "review" | "insufficient" {
  if (status === "submission_ready") return "pass";
  if (status === "draft_generated") return "review";
  return "insufficient";
}

export default function DashboardPage() {
  const t = useWizardText();
  const router = useRouter();
  const [list, setList] = useState<ProjectListItem[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setList(d.projects ?? []))
      .catch(() => setList([]));
  }, []);

  async function createProject() {
    setCreating(true);
    try {
      const res = await fetch("/api/projects", { method: "POST" });
      const json = await res.json();
      if (json.id) router.push(`/dashboard/wizard?project=${json.id}`);
    } finally {
      setCreating(false);
    }
  }

  const total = list?.length ?? 0;
  const signed = list?.filter((p) => p.status === "submission_ready").length ?? 0;
  const inDraft = list?.filter((p) => p.status === "draft_generated").length ?? 0;

  return (
    <div style={{ maxWidth: 1080 }}>
      <h1 style={{ fontSize: 24, margin: "0 0 6px" }}>{t("dashboardOverview")}</h1>
      <p style={{ fontSize: 14, color: "var(--text-muted)", margin: "0 0 24px" }}>
        {total === 0
          ? t("noProjectsYet")
          : `${total} — jami loyiha, shundan ${inDraft} ko'rib chiqilmoqda, ${signed} imzolangan.`}
      </p>

      {/* Stat kartalar — real ma'lumot, fabrikatsiya emas */}
      <div style={{ display: "flex", gap: 16, marginBottom: 28 }}>
        <div style={statCard}>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>{t("totalAssessments")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-mono)" }}>{total}</div>
        </div>
        <div style={{ ...statCard, borderLeftColor: "var(--success)" }}>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>{t("statusSigned")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--success)" }}>
            {signed}
          </div>
        </div>
        <div style={{ ...statCard, borderLeftColor: "var(--gold)" }}>
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>{t("statusDraftGenerated")}</div>
          <div style={{ fontSize: 28, fontWeight: 800, fontFamily: "var(--font-mono)", color: "var(--gold)" }}>
            {inDraft}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "start" }}>
        {/* Loyihalar jadvali */}
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", fontWeight: 700, fontSize: 14.5 }}>
            {t("myProjects")}
          </div>
          {list?.length === 0 && (
            <p style={{ padding: 20, color: "var(--text-muted)", fontSize: 14 }}>{t("noProjectsYet")}</p>
          )}
          {list && list.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--text-muted)", fontSize: 11.5 }}>
                  <th style={{ padding: "10px 20px", fontWeight: 600 }}>{t("projectNameCol")}</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>{t("ingredientCountCol")}</th>
                  <th style={{ padding: "10px 12px", fontWeight: 600 }}>{t("statusCol")}</th>
                  <th style={{ padding: "10px 20px", fontWeight: 600, textAlign: "right" }}>{t("updatedCol")}</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const compCount = p.ingredients ? flattenIngredients(p.ingredients).length : 0;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => router.push(`/dashboard/wizard?project=${p.id}`)}
                      style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                    >
                      <td style={{ padding: "12px 20px", fontWeight: 600 }}>
                        {p.product_info?.productName || "(nomsiz)"}
                      </td>
                      <td style={{ padding: "12px", color: "var(--text-muted)" }}>{compCount}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={badge(statusTone(p.status))}>
                          {p.status === "submission_ready"
                            ? t("statusSigned")
                            : p.status === "draft_generated"
                            ? t("statusDraftGenerated")
                            : t("statusEmpty")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", textAlign: "right", color: "var(--text-muted)" }}>
                        {new Date(p.updated_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* O'ng ustun */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 12 }}>{t("quickActions")}</div>
            <button style={{ ...btnPrimary, width: "100%", marginBottom: 10 }} onClick={createProject} disabled={creating}>
              {t("startNewAssessment")}
            </button>
            <Link
              href="/dashboard/shelf-life"
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px 20px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-muted)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                textDecoration: "none",
              }}
            >
              {t("shelfLifeCalc")}
            </Link>
          </div>

          <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{t("knownRestrictedSubstances")}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)", marginBottom: 14 }}>{t("restrictedSubstancesNote")}</div>
            {RESTRICTED_SUBSTANCES.map((r) => (
              <div key={r.cas} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{r.cas}</div>
                </div>
                <span style={badge(r.severity === "high" ? "insufficient" : "review")}>{r.severity.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
