"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage, useWizardText } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AuthStatus } from "@/components/AuthStatus";
import type { WizardData } from "@/lib/wizard-types";
import { card, badge, btnPrimary } from "@/lib/wizard-ui";

type ProjectListItem = {
  id: string;
  product_info: WizardData["productInfo"];
  status: string;
  updated_at: string;
};

export default function DashboardPage() {
  const { t: tBrand } = useLanguage();
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

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: "40px 24px 80px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 24 }}>
        <div>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }}>
            ← {tBrand("brand")}
          </Link>
          <h1 style={{ fontSize: 24, margin: "10px 0" }}>{t("myProjects")}</h1>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <LanguageToggle />
          <AuthStatus />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button style={btnPrimary} onClick={createProject} disabled={creating}>
          {t("newProject")}
        </button>
        <Link
          href="/dashboard/shelf-life"
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-muted)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            textDecoration: "none",
          }}
        >
          {t("shelfLifeTitle")}
        </Link>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {list?.length === 0 && <p style={{ color: "var(--text-muted)" }}>{t("noProjectsYet")}</p>}
        {list?.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/wizard?project=${p.id}`}
            style={{ ...card, display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{p.product_info?.productName || "(untitled)"}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {new Date(p.updated_at).toLocaleString()}
              </div>
            </div>
            <span
              style={badge(
                p.status === "submission_ready" ? "pass" : p.status === "draft_generated" ? "review" : "insufficient"
              )}
            >
              {p.status}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
