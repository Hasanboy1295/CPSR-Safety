"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useLanguage, useWizardText } from "@/lib/i18n";
import { LanguageToggle } from "@/components/LanguageToggle";
import { AuthStatus } from "@/components/AuthStatus";

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "10px 14px",
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        textDecoration: "none",
        color: active ? "var(--accent-2)" : "var(--text-muted)",
        background: active ? "var(--accent-soft)" : "transparent",
        marginBottom: 4,
      }}
    >
      {label}
    </Link>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { t: tBrand } = useLanguage();
  const t = useWizardText();
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 240,
          flexShrink: 0,
          background: "var(--sidebar-bg)",
          borderRight: "1px solid var(--border)",
          padding: "20px 14px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px 22px" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 800,
              fontSize: 15,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {tBrand("brand").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.2 }}>{t("sidebarSafetyTools")}</div>
            <div style={{ fontSize: 11.5, color: "var(--text-muted)" }}>{t("sidebarSafetyToolsSub")}</div>
          </div>
        </div>

        <nav style={{ flex: 1 }}>
          <NavLink href="/dashboard" label={t("myProjects")} active={pathname === "/dashboard"} />
          <NavLink
            href="/dashboard/shelf-life"
            label={t("shelfLifeCalc")}
            active={pathname === "/dashboard/shelf-life"}
          />
        </nav>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <LanguageToggle />
          <AuthStatus />
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: "36px 40px 80px" }}>{children}</main>
    </div>
  );
}
