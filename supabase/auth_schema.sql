-- Supabase SQL Editor'da schema.sql'dan KEYIN shu faylni ishga tushiring.
-- Bu — login/logout + rol-asosli himoya (user / assessor) uchun asos.
--
-- MUHIM: auth.users jadvali Supabase Auth tomonidan avtomatik boshqariladi
-- (parolni hech qachon o'zimiz saqlamaymiz/hashlemaymiz — buni Supabase
-- allaqachon xavfsiz qiladi). Biz faqat unga bog'langan profil va loyiha
-- jadvallarini yozamiz.

-- ============================================================
-- 1) PROFILES — har foydalanuvchining roli va profil ma'lumoti
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  company text, -- "user login qilsa auto to'ldirilishi" uchun (제조업자/책임판매업자)
  role text not null default 'user' check (role in ('user', 'assessor')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Har kim faqat O'ZINI profilini ko'ra/yangilay oladi
create policy "profiles_select_own"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on profiles for update
  using (auth.uid() = id);

-- Ro'yxatdan o'tganda avtomatik profil yaratish (rol har doim 'user' —
-- 'assessor' bo'lish uchun ADMIN qo'lda SQL orqali o'zgartiradi, hech qachon
-- foydalanuvchining o'zi tanlamaydi — bu muhim xavfsizlik qoidasi!)
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, company)
  values (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'company');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- 2) CPSR_PROJECTS — wizard ma'lumoti (localStorage o'rniga)
-- ============================================================
create table if not exists cpsr_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_info jsonb not null default '{}'::jsonb,
  ingredients jsonb not null default '[]'::jsonb,
  exposure jsonb not null default '{}'::jsonb,
  certification jsonb not null default '{}'::jsonb,
  report_result jsonb, -- oxirgi AI generatsiyasi (Part A/B + integrity)
  status text not null default 'draft' check (
    status in ('draft', 'draft_generated', 'submission_ready')
  ),
  reviewed_by uuid references auth.users(id), -- assessor kim ekani
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table cpsr_projects enable row level security;

-- Egasi: o'z loyihasini to'liq boshqaradi
create policy "projects_owner_select"
  on cpsr_projects for select
  using (auth.uid() = user_id);

create policy "projects_owner_insert"
  on cpsr_projects for insert
  with check (auth.uid() = user_id);

create policy "projects_owner_update"
  on cpsr_projects for update
  using (auth.uid() = user_id);

-- Assessor: FAQAT "draft_generated" (ko'rib chiqishga tayyor) loyihalarni
-- ko'radi va yangilay oladi — boshqa foydalanuvchining hali tugallanmagan
-- (status='draft') loyihasini KO'RA OLMAYDI. Bu — "juda mahkam security".
create policy "projects_assessor_select"
  on cpsr_projects for select
  using (
    status = 'draft_generated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'assessor'
    )
  );

create policy "projects_assessor_update"
  on cpsr_projects for update
  using (
    status = 'draft_generated'
    and exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'assessor'
    )
  );

-- Yangilanish vaqtini avtomatik yangilash
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on cpsr_projects;
create trigger projects_set_updated_at
  before update on cpsr_projects
  for each row execute function set_updated_at();

-- ============================================================
-- Birinchi assessor'ni qo'lda tayinlash (signup'dan keyin, bir marta):
--
--   update profiles set role = 'assessor' where id = '<user-uuid>';
--
-- <user-uuid>'ni Supabase Dashboard -> Authentication -> Users'dan olasiz.
-- ============================================================
