import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

export const metadata = {
  title: "auto-cpsr — AI Cosmetic Safety Reports",
  description: "AI-drafted, evidence-grounded CPSR reports (MFDS / SCCS / MoCRA / NMPA)",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  );
}
