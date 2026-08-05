import type { CSSProperties } from "react";

export const field: CSSProperties = { marginBottom: 18 };

export const label: CSSProperties = {
  display: "block",
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 6,
};

export const input: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  background: "var(--bg)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontFamily: "inherit",
};

export const select: CSSProperties = { ...input };

export const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: 24,
};

export const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: "0 20px",
};

export const badge = (tone: "pass" | "review" | "insufficient"): CSSProperties => {
  const colors = {
    pass: { bg: "var(--accent-soft)", fg: "var(--accent)", border: "var(--accent)" },
    review: { bg: "var(--gold-soft)", fg: "var(--gold)", border: "var(--gold)" },
    insufficient: { bg: "var(--danger-soft)", fg: "var(--danger)", border: "var(--danger)" },
  }[tone];
  return {
    display: "inline-block",
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 999,
    background: colors.bg,
    color: colors.fg,
    border: `1px solid ${colors.border}`,
    whiteSpace: "nowrap",
  };
};

export const btnPrimary: CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  background: "var(--accent)",
  color: "#06120d",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

export const btnGhost: CSSProperties = {
  padding: "10px 20px",
  fontSize: 14,
  fontWeight: 600,
  background: "transparent",
  color: "var(--text-muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  cursor: "pointer",
};

export const btnDanger: CSSProperties = {
  padding: "6px 12px",
  fontSize: 12.5,
  fontWeight: 600,
  background: "transparent",
  color: "var(--danger)",
  border: "1px solid var(--danger)",
  borderRadius: 6,
  cursor: "pointer",
};
