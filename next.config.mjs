import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ~/package-lock.json (bu loyihaga aloqasi yo'q, uy papkasida qolib ketgan
  // eski fayl) tufayli Next.js workspace ildizini noto'g'ri taxmin qilmasligi uchun:
  outputFileTracingRoot: __dirname,
  // lib/pdf-report.ts readFileSync bilan shrift faylini o'qiydi — bu import
  // emas, shuning uchun Next.js'ning avtomatik file-tracing'i uni sezmasligi
  // mumkin. Vercel serverless funksiyaga aniq qo'shib qo'yamiz.
  outputFileTracingIncludes: {
    "/api/**/*": ["./assets/fonts/**"],
  },
};

export default nextConfig;
