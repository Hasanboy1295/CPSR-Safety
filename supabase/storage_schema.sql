-- Supabase SQL Editor'da schema.sql va auth_schema.sql'dan KEYIN ishga tushiring.
-- Bu — evidence pack (ZIP) va CPSR PDF'ni DOIMIY saqlash uchun (ALCOA+ "Enduring").
-- Muhim: bu fayllar bir marta yaratiladi va HECH QACHON qayta yozilmaydi —
-- shu sababli "bu xulosaga qanday kelindi" savoliga 1 yil o'tib ham bir xil
-- javob beriladi (hisob-kitob kodi keyinchalik o'zgarsa ham).

insert into storage.buckets (id, name, public)
values ('cpsr-artifacts', 'cpsr-artifacts', false)
on conflict (id) do nothing;

alter table cpsr_projects add column if not exists evidence_pack_path text;
alter table cpsr_projects add column if not exists pdf_path text;

-- Egasi: o'z loyihasining artifaktlarini yozadi/o'qiydi
create policy "cpsr_artifacts_owner_all"
  on storage.objects for all
  using (
    bucket_id = 'cpsr-artifacts'
    and (storage.foldername(name))[1]::uuid in (
      select id from cpsr_projects where user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'cpsr-artifacts'
    and (storage.foldername(name))[1]::uuid in (
      select id from cpsr_projects where user_id = auth.uid()
    )
  );

-- Assessor: faqat draft_generated loyihalarning artifaktlarini o'qiy oladi (yozolmaydi)
create policy "cpsr_artifacts_assessor_select"
  on storage.objects for select
  using (
    bucket_id = 'cpsr-artifacts'
    and exists (
      select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'assessor'
    )
    and (storage.foldername(name))[1]::uuid in (
      select id from cpsr_projects where status = 'draft_generated'
    )
  );
