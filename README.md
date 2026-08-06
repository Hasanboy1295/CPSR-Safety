# auto-cpsr — AI-drafted, evidence-grounded cosmetic safety reports (CPSR)

`work` papkasidagi haqiqiy hujjatlarga (GBCY2616 grant, ATOM brifing, CPSR_KR_dossier, MFDS reglament) asoslangan, real ishlaydigan loyiha: RAG+LLM, deterministik SED/MoS hisob-kitobi, login/rol tizimi, PDF/Evidence Pack generatsiyasi.

## Ishlatilgan texnologiyalar
- **Next.js (App Router, TypeScript)** — Client + Server/API
- **OpenAI API (GPT-4o)** — Part A/B matnini yozadigan LLM
- **Voyage AI** — embedding (matnni vektorga aylantirish)
- **Supabase** — Postgres + pgvector (RAG) + Auth (login/rol) + Storage (PDF/ZIP)
- **pdf-lib** — haqiqiy CPSR PDF (Noto Sans KR shrifti bilan, koreys+ingliz matn)

## O'rnatish (birinchi marta)

1. **Paketlarni o'rnatish**
   ```bash
   npm install
   ```

2. **Supabase loyihasi**
   - https://supabase.com/dashboard → "New project"
   - **SQL Editor**da 3 ta faylni **ketma-ket** ishga tushiring:
     1. `supabase/schema.sql` — RAG (`documents`, pgvector)
     2. `supabase/auth_schema.sql` — login/rol (`profiles`, `cpsr_projects`, RLS)
     3. `supabase/storage_schema.sql` — PDF/ZIP doimiy saqlash (`cpsr-artifacts` bucket)
   - **Project Settings → API** dan `Project URL`, `anon` va `service_role` kalitlarni oling

3. **API kalitlar**
   ```bash
   cp .env.example .env
   ```
   `.env` faylini to'ldiring:
   - `OPENAI_API_KEY` — https://platform.openai.com/api-keys
   - `VOYAGE_API_KEY` — https://dash.voyageai.com
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase'dan (2-qadam)

4. **Bilim bazasini yuklash**
   ```bash
   npm run ingest
   ```
   `data/*.txt` fayllarni (MFDS reglament, CPSR namuna) Supabase'ga yozadi.

5. **Ishga tushirish**
   ```bash
   npm run dev
   ```
   http://localhost:3000 — API kalitlarsiz ham **DEMO rejimda** ishlaydi (aniq belgilangan, hech qachon jim yolg'on javob bermaydi).

## Loyiha tuzilishi

```
app/
  page.tsx                          <- Bosh sahifa (EN/한국어), jonli RAG demo
  dashboard/
    page.tsx                        <- Foydalanuvchining loyihalari
    wizard/                         <- 4-bosqichli CPSR forma (Product Info→Certification)
    shelf-life/                     <- Arrhenius muddat kalkulyatori
  review/                           <- Baholovchi (assessor) ko'rib chiqish paneli
  login/ signup/                    <- Supabase Auth
  api/
    rag/                            <- Savol-javob (RAG+LLM)
    generate-report/                <- To'liq CPSR qoralamasi (hisob+RAG+LLM)
    projects/[id]/                  <- Loyiha CRUD, PDF, evidence-pack yuklab olish
    review/[id]/                    <- Baholovchi imzosi (server-side, taqlid qilib bo'lmaydi)
lib/
  llm.ts                            <- OpenAI chaqiruvi (grounded prompt, Part A/B faqat)
  embeddings.ts                     <- Voyage AI
  rag.ts                            <- qidiruv (real + demo fallback)
  calc.ts / ttc.ts                  <- SED/MoS/TTC — deterministik, LLM emas
  shelf-life.ts                     <- Arrhenius muddat formulasi
  restricted-list.ts                <- cheklangan moddalar tekshiruvi
  report.ts                         <- hammasini birlashtiruvchi orkestratsiya
  pdf-report.ts / evidence-pack.ts  <- yakuniy PDF va ZIP generatsiyasi
  auth-guard.ts / storage.ts        <- server-side himoya va doimiy saqlash
supabase/
  schema.sql / auth_schema.sql / storage_schema.sql  <- 3 ta SQL, shu tartibda
data/                                <- RAG bilim bazasi manbalari (matn)
assets/fonts/                        <- Noto Sans KR (PDF uchun)
```

## Xavfsizlik tamoyillari

- API kalitlar faqat serverda (Client hech qachon ko'rmaydi)
- Rol: `user` (o'z loyihasi) / `assessor` (faqat `draft_generated` loyihalarni ko'radi) — bazaning o'zida RLS orqali cheklangan
- LLM yakuniy xavfsizlik xulosasi va imzo yoza olmaydi — bu faqat inson vazifasi
- Evidence Pack/PDF **bir marta** yaratilib, o'zgarmas holda saqlanadi (ALCOA+)
