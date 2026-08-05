import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ~/package-lock.json (bu loyihaga aloqasi yo'q, uy papkasida qolib ketgan
  // eski fayl) tufayli Next.js workspace ildizini noto'g'ri taxmin qilmasligi uchun:
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
