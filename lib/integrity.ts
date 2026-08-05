// Data Integrity (ALCOA+) — CPSR_KR_dossier'dagi haqiqiy pipeline'ning
// o'zi ishlatadigan maydonlar: input_csv_sha, config_hash, run_id, created_at.
// Bu — "1 yil o'tib ham qanday xulosaga kelinganini" tekshirish uchun.

import { createHash, randomUUID } from "node:crypto";

export function sha256(data: string): string {
  return createHash("sha256").update(data, "utf-8").digest("hex");
}

export type IntegrityStamp = {
  runId: string;
  createdAt: string; // UTC ISO
  inputCsvSha: string;
  configHash: string;
};

/**
 * inputPayload — formula.csv o'rnini bosuvchi kirish ma'lumoti (JSON qilib
 * serialize qilinadi va xeshlanadi — CSV formatiga aylantirish shart emas,
 * muhimi: bir xil kirish har doim bir xil xesh berishi).
 */
export function stampIntegrity(inputPayload: unknown, configPayload: unknown): IntegrityStamp {
  return {
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    inputCsvSha: sha256(JSON.stringify(inputPayload)),
    configHash: sha256(JSON.stringify(configPayload)),
  };
}
