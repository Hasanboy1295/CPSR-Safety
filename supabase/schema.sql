-- Supabase SQL Editor'da shu faylni to'liq ishga tushiring (bir marta).

create extension if not exists vector;

create table if not exists documents (
  id bigserial primary key,
  source_name text not null,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(1024),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists documents_embedding_idx
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- RAG qidiruv funksiyasi: eng yaqin N ta bo'lakni cosine similarity bo'yicha qaytaradi
create or replace function match_documents (
  query_embedding vector(1024),
  match_count int default 5
)
returns table (
  id bigint,
  source_name text,
  content text,
  metadata jsonb,
  similarity float
)
language sql stable
as $$
  select
    documents.id,
    documents.source_name,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
