// Haqiqiy namuna: "AI 최적화 조건(실증).xlsx" (work papkasi) — BNcos'ning
// NMN-SILISOME jarayoni uchun real laboratoriya retsepti. Foizlar umumiy
// mahsulot og'irligiga nisbatan (qolgani — suv/bufer asosi).

import { newIngredientRow, newComponent, type IngredientRow } from "./wizard-types";

export function nmnSilisomeFormula(): IngredientRow[] {
  const lipidPhase: IngredientRow = {
    ...newIngredientRow(),
    tradeName: "SILISOME Lipid Phase (NMN encapsulation)",
    percentInProduct: "100",
    components: [
      { ...newComponent(), inciName: "Phosphatidylcholine", cas: "8002-43-5", percentActiveInRaw: "4", functionRole: "lipid carrier" },
      { ...newComponent(), inciName: "Ceramide NP", cas: "100403-19-8", percentActiveInRaw: "0.05", functionRole: "barrier lipid" },
      { ...newComponent(), inciName: "Cholesterol", cas: "57-88-5", percentActiveInRaw: "0.01", functionRole: "membrane stabilizer" },
      { ...newComponent(), inciName: "Nicotinamide Mononucleotide (NMN)", cas: "1094-61-7", percentActiveInRaw: "2", functionRole: "active (slow-aging)" },
    ],
  };

  const silicaShell: IngredientRow = {
    ...newIngredientRow(),
    tradeName: "Silica Shell System (TEOS)",
    percentInProduct: "100",
    components: [
      { ...newComponent(), inciName: "Silica (from TEOS)", cas: "78-10-4", percentActiveInRaw: "4", functionRole: "shell-forming" },
      {
        ...newComponent(),
        inciName: "Sodium Fluoride",
        cas: "7681-49-4",
        percentActiveInRaw: "0.16",
        functionRole: "catalyst (residual — tekshirilishi shart)",
      },
    ],
  };

  // percentActiveInRaw'lar to'g'ridan-to'g'ri xlsx'dagi umumiy % qiymatlari,
  // shuning uchun xomashyoning o'zi ham 100% deb belgilanadi (flatten to'g'ri
  // hisoblashi uchun) — bu yerda "xomashyo ichidagi ulush" emas, balki
  // "mahsulotdagi umumiy ulush" ma'nosida ishlatilmoqda.
  return [lipidPhase, silicaShell];
}
