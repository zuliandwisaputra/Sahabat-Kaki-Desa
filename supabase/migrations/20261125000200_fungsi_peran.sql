-- =============================================================================
-- Sahabat Kaki Desa — 2. Fungsi bantu peran (dipakai oleh aturan RLS)
-- Semua fungsi SECURITY DEFINER supaya bisa membaca tabel profiles tanpa
-- terjebak aturan RLS profiles sendiri. search_path dikosongkan demi keamanan.
-- =============================================================================

-- Apakah pengguna yang login punya salah satu peran ini DAN akunnya sudah disetujui?
create or replace function public.has_role(variadic p_roles text[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.approval_status = 'disetujui'
      and p.role = any (p_roles)
  );
$$;

-- Apakah akun yang login sudah disetujui (peran apa pun)?
create or replace function public.is_approved()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.approval_status = 'disetujui'
  );
$$;

-- Peran pengguna yang login (tanpa melihat status persetujuan).
create or replace function public.my_role()
returns text
language sql stable security definer
set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- ID pasien yang terhubung ke akun Pasien/Keluarga yang login (null jika bukan).
create or replace function public.my_patient_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select p.patient_id from public.profiles p
  where p.id = auth.uid() and p.role = 'pasien' and p.approval_status = 'disetujui';
$$;

-- Apakah kader yang login adalah pendamping aktif pasien ini (lewat baris companions)?
create or replace function public.is_my_companion(p_companion_id uuid, p_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.companions c
    where c.id = p_companion_id
      and c.patient_id = p_patient_id
      and c.profile_id = auth.uid()
      and c.active
  );
$$;
