-- auth_schema.sql'dan KEYIN, storage_schema.sql bilan istalgan tartibda
-- ishga tushiring. To'liq CPSR namunasi (fizik-kimyoviy/mikrobiologiya/
-- qadoqlash bo'limlari) uchun yangi ustun qo'shadi.

alter table cpsr_projects add column if not exists product_quality jsonb not null default '{}'::jsonb;
