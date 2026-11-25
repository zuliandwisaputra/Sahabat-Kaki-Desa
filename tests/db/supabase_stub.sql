-- =============================================================================
-- Tiruan minimal Supabase untuk menguji migrasi + RLS di PostgreSQL lokal.
-- HANYA untuk pengujian di komputer pengembang; JANGAN dijalankan di Supabase.
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

-- Dua mode, sesuai opsi "Grant API access to new tables automatically" saat membuat
-- proyek Supabase (dipilih lewat: psql -v hak_otomatis=true|false):
--   true  : objek baru otomatis diberikan ke anon/authenticated/service_role
--           -> migrasi harus MENCABUT sendiri hak yang tidak perlu
--   false : tidak ada hak sama sekali (bahkan USAGE schema public)
--           -> migrasi harus MEMBERI sendiri hak yang perlu
\if :hak_otomatis
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
\else
revoke usage on schema public from public;
\endif

-- ---- auth -------------------------------------------------------------------
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              varchar(255) unique,
  encrypted_password varchar(255),
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at         timestamptz default now()
);

create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- ---- storage ----------------------------------------------------------------
create schema storage;
grant usage on schema storage to anon, authenticated, service_role;

create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text references storage.buckets (id),
  name       text,
  owner      uuid,
  created_at timestamptz default now()
);
alter table storage.objects enable row level security;
grant select, insert, update, delete on storage.objects to authenticated;

create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end
$$;
grant execute on function storage.foldername(text) to authenticated;

-- ---- realtime ---------------------------------------------------------------
create publication supabase_realtime;
