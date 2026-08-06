// Cheklangan/e'tiborga muhtoj moddalar — kichik, qo'lda tasdiqlangan ro'yxat.
// MUHIM: aniq Annex/modda raqamlarini TO'QIMAYMIZ (loyihaning boshidan beri
// tutgan qoidasi) — faqat umumiy, ishonchli ma'lumot beramiz va "tekshiring"
// deb ogohlantiramiz. Bu real MFDS/EU ro'yxatining o'rnini bosmaydi.

export type RestrictedEntry = {
  cas: string;
  name: string;
  reason: string;
  severity: "high" | "medium";
};

export const RESTRICTED_SUBSTANCES: RestrictedEntry[] = [
  {
    cas: "7681-49-4",
    name: "Sodium Fluoride",
    reason:
      "Ftor birikmalari EU/KR reglamentida odatda faqat og'iz gigiyenasi mahsulotlarida ruxsat etiladi — teriga surtiladigan (leave-on) mahsulotda odatda ruxsat etilmaydi. Agar jarayon katalizatori sifatida ishlatilgan bo'lsa, yakuniy mahsulotda QOLDIQ sifatida topilmasligi tasdiqlanishi shart (residual analysis).",
    severity: "high",
  },
  {
    cas: "7681-38-1",
    name: "Sodium Bisulfite",
    reason: "Konsentratsiyaga qarab cheklangan — miqdorni tekshiring.",
    severity: "medium",
  },
  {
    cas: "123-31-9",
    name: "Hydroquinone",
    reason: "Ko'p yurisdiktsiyalarda kosmetikada taqiqlangan/qattiq cheklangan.",
    severity: "high",
  },
  {
    cas: "104-40-5",
    name: "4-tert-Octylphenol",
    reason: "Endokrin buzuvchi sifatida cheklangan (EU).",
    severity: "high",
  },
];

export function checkRestricted(cas: string): RestrictedEntry | null {
  const normalized = cas.trim();
  if (!normalized) return null;
  return RESTRICTED_SUBSTANCES.find((r) => r.cas === normalized) ?? null;
}
