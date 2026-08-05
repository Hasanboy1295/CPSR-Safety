# auto-cpsr — RAG + LLM (real ishlaydigan versiya)

Bu — Claude bilan suhbatimizda chizilgan arxitekturaning (User → Client → Server → Database / AI Model) haqiqiy kod ko'rinishi. Hozircha faqat **RAG+LLM yadrosi** qurilgan (CPSR wizard'ning to'liq UI'si emas) — savol berasiz, tizim `work` papkangizdagi hujjatlardan (MFDS reglament, CPSR namuna) tegishli qismni topib, faqat o'sha manbaga asoslanib javob beradi va manbani ko'rsatadi (XAI/citation).

## Ishlatilgan texnologiyalar
- **Next.js (App Router, TypeScript)** — Client + Server/API
- **Claude (Anthropic API)** — javob yozadigan LLM
- **Voyage AI** — embedding (matnni vektorga aylantirish; Anthropic tavsiya qiladi, Claude'ning o'zida embedding yo'q)
- **Supabase + pgvector** — vector baza (RAG'ning qidiruv qismi)

## O'rnatish (birinchi marta)

1. **Paketlarni o'rnatish**
   ```bash
   npm install
   ```

2. **Supabase loyihasi**
   - https://supabase.com/dashboard → "New project" (bepul reja yetarli)
   - Project tayyor bo'lgach: **SQL Editor** → `supabase/schema.sql` faylining
     to'liq matnini joylashtirib, **Run** bosing (bu `documents` jadvali va
     RAG qidiruv funksiyasini yaratadi)
   - **Project Settings → API** dan `Project URL` va `service_role` kalitni oling

3. **API kalitlar**
   ```bash
   cp .env.example .env
   ```
   `.env` faylini oching va to'ldiring:
   - `ANTHROPIC_API_KEY` — https://console.anthropic.com/settings/keys
   - `VOYAGE_API_KEY` — https://dash.voyageai.com (bepul reja bor)
   - `NEXT_PUBLIC_SUPABASE_URL` va `SUPABASE_SERVICE_ROLE_KEY` — Supabase'dan (2-qadam)

4. **Bilim bazasini yuklash (ingest)**
   ```bash
   npm run ingest
   ```
   Bu `data/` papkasidagi matnlarni (hozircha MFDS reglament va CPSR namunasi,
   `work` papkangizdan chiqarilgan) bo'laklab, Supabase'ga yozadi.
   Yangi hujjat qo'shmoqchi bo'lsangiz — `data/` papkasiga `.txt` fayl sifatida
   qo'ying va `npm run ingest`ni qayta ishga tushiring.

5. **Ishga tushirish**
   ```bash
   npm run dev
   ```
   http://localhost:3000 ni oching, savol yozing, "So'rash" bosing.
   Javob ostida qaysi hujjatdan olinganini ("manbalar") ham ko'rasiz.

## Loyiha tuzilishi

```
app/
  page.tsx           <- Client: sinov sahifasi (User shu yerda so'raydi)
  api/rag/route.ts   <- Server/API: kalitlar shu yerda, Client ularni ko'rmaydi
lib/
  embeddings.ts       <- Voyage AI chaqiruvi
  claude.ts           <- Claude chaqiruvi (grounded prompt, XAI/citation qoidasi)
  rag.ts              <- hammasini birlashtiradi: savol -> qidiruv -> javob
  supabase.ts          <- Supabase server-side klient
scripts/ingest.ts      <- data/*.txt fayllarni bilim bazasiga yozadi
supabase/schema.sql     <- Supabase'da bir marta ishga tushiriladigan SQL
data/                   <- bilim bazasi manbalari (matn)
```

## Keyingi qadamlar (hali qilinmagan)

- CPSR wizard'ning 4 bosqichini (Product Info/Ingredients/Toxicology/
  Certification) shu backend'ga ulash
- MoS = NOAEL/SED hisob-kitobini alohida deterministik funksiya sifatida qo'shish
  (bu LLM'ga ishonib topshirilmaydi — arxitektura hujjatidagi eslatmaga qarang)
- Xavfsizlik baholovchisi (inson) uchun ko'rib chiqish/imzolash oqimi
- `work` papkangizdagi qolgan PDF'larni (taqiqlangan ro'yxat, EWG va h.k.)
  `data/`ga qo'shish
