-- =============================================================================
-- Sahabat Kaki Desa — 5. Fungsi yang dipanggil aplikasi (RPC)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Masuk memakai username ATAU email (AUTH-01).
-- Supabase Auth hanya mengenal email, jadi username diubah ke email dulu.
-- ---------------------------------------------------------------------------
create or replace function public.get_login_email(p_identifier text)
returns text
language sql stable security definer set search_path = '' as $$
  select case
    when position('@' in coalesce(p_identifier, '')) > 0 then lower(btrim(p_identifier))
    else (
      select u.email::text
      from auth.users u
      join public.profiles p on p.id = u.id
      where lower(p.username) = lower(btrim(p_identifier))
      limit 1
    )
  end;
$$;

-- Cek username sebelum mendaftar (huruf kecil, angka, titik, garis bawah; 3–30 karakter)
create or replace function public.is_username_available(p_username text)
returns boolean
language sql stable security definer set search_path = '' as $$
  select lower(btrim(coalesce(p_username, ''))) ~ '^[a-z0-9._]{3,30}$'
     and not exists (
       select 1 from public.profiles p where lower(p.username) = lower(btrim(p_username))
     );
$$;

-- ---------------------------------------------------------------------------
-- Kelola Akun: daftar akun (Perawat: lihat, Admin: edit)
-- ---------------------------------------------------------------------------
create or replace function public.list_accounts()
returns table (
  id uuid, full_name text, username text, email text, phone text, role text,
  approval_status text, approved_at timestamptz, patient_id uuid, patient_name text,
  created_at timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public.has_role('perawat', 'admin') then
    raise exception 'Menu Kelola Akun hanya untuk Perawat dan Admin.' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.username, u.email::text, p.phone, p.role,
           p.approval_status, p.approved_at, p.patient_id, pt.full_name, p.created_at
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.patients pt on pt.id = p.patient_id
    order by (p.approval_status = 'menunggu') desc, p.created_at desc;
end;
$$;

-- Admin: setujui/tolak akun dan ubah peran
create or replace function public.admin_update_account(
  p_user uuid, p_role text default null, p_status text default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.profiles%rowtype;
  v_new_role text;
  v_new_status text;
begin
  if not public.has_role('admin') then
    raise exception 'Hanya Admin yang bisa mengubah peran atau persetujuan akun.' using errcode = '42501';
  end if;
  if p_role is not null and p_role not in ('perawat', 'kader', 'pasien', 'desa', 'admin') then
    raise exception 'Peran tidak dikenal: %', p_role using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('menunggu', 'disetujui', 'ditolak') then
    raise exception 'Status tidak dikenal: %', p_status using errcode = '22023';
  end if;

  select * into v_old from public.profiles where id = p_user;
  if not found then
    raise exception 'Akun tidak ditemukan.' using errcode = 'P0002';
  end if;

  v_new_role := coalesce(p_role, v_old.role);
  v_new_status := coalesce(p_status, v_old.approval_status);

  if p_user = auth.uid() and (v_new_role <> 'admin' or v_new_status <> 'disetujui') then
    raise exception 'Admin tidak bisa menurunkan peran atau menonaktifkan akunnya sendiri.' using errcode = '42501';
  end if;

  update public.profiles set
    role            = v_new_role,
    approval_status = v_new_status,
    approved_at     = case when v_new_status = 'disetujui' and v_old.approval_status <> 'disetujui'
                           then now() else approved_at end,
    approved_by     = case when v_new_status = 'disetujui' and v_old.approval_status <> 'disetujui'
                           then auth.uid() else approved_by end,
    patient_id      = case when v_new_role = 'pasien' then patient_id else null end
  where id = p_user;

  if v_new_status = 'disetujui' and v_old.approval_status <> 'disetujui' then
    perform public.notify_user(p_user, 'Akun Anda sudah disetujui',
      'Sekarang Anda bisa menambah dan mengubah data sesuai peran Anda.', '/');
  elsif v_new_role <> v_old.role then
    perform public.notify_user(p_user, 'Peran akun Anda diubah',
      'Admin mengubah peran akun Anda. Silakan muat ulang halaman.', '/');
  end if;
end;
$$;

-- Perawat/Kader/Admin: hubungkan akun Pasien/Keluarga ke data pasien (AUTH-04).
-- p_patient = null untuk memutus hubungan.
create or replace function public.link_patient_account(p_profile uuid, p_patient uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
begin
  if not public.has_role('perawat', 'kader', 'admin') then
    raise exception 'Hanya Perawat, Kader, atau Admin yang bisa menghubungkan akun pasien.' using errcode = '42501';
  end if;
  select p.role into v_role from public.profiles p where p.id = p_profile;
  if v_role is null then
    raise exception 'Akun tidak ditemukan.' using errcode = 'P0002';
  end if;
  if v_role <> 'pasien' then
    raise exception 'Hanya akun Pasien/Keluarga yang bisa dihubungkan ke data pasien.' using errcode = '22023';
  end if;
  if p_patient is not null and not exists (select 1 from public.patients where id = p_patient) then
    raise exception 'Data pasien tidak ditemukan.' using errcode = 'P0002';
  end if;

  update public.profiles set patient_id = p_patient where id = p_profile;

  if p_patient is not null then
    perform public.notify_user(p_profile, 'Akun terhubung ke data pasien',
      'Sekarang Anda bisa melihat riwayat perawatan dan mengisi identitas pasien.', '/pasien/' || p_patient);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ringkasan Beranda (HOME-02). Hanya angka, tanpa identitas, jadi aman untuk
-- semua peran (termasuk Pasien/Keluarga — PRD bagian 4, aturan privasi).
-- ---------------------------------------------------------------------------
create or replace function public.dashboard_stats()
returns jsonb
language sql stable security definer set search_path = '' as $$
  with minggu as (
    select date_trunc('week', now() at time zone 'Asia/Jakarta')::date as awal
  )
  select jsonb_build_object(
    'pasien_aktif',
      (select count(*) from public.patients where archived_at is null and status in ('aktif', 'rujukan')),
    'kunjungan_minggu_ini',
      (select count(*) from public.companion_visits cv, minggu
        where cv.visit_date >= minggu.awal and cv.visit_date < minggu.awal + 7),
    'kartu_minggu_ini',
      (select count(*) from public.foot_visits fv, minggu
        where fv.visit_date >= minggu.awal and fv.visit_date < minggu.awal + 7 and fv.status <> 'draft'),
    'kartu_menunggu_penilaian',
      (select count(*) from public.foot_visits where status = 'dikirim'),
    'tanda_bahaya_belum_ditindaklanjuti',
      (select count(*) from public.foot_visits fv join public.assessments a on a.foot_visit_id = fv.id
        where a.color_code in ('kuning', 'merah') and fv.status = 'dinilai'),
    'saldo_jimpitan',
      (select coalesce(sum(case when trx_type = 'masuk' then amount else -amount end), 0) from public.funds),
    'agenda_terdekat',
      (select to_jsonb(x) from (
         select a.id, a.title, a.agenda_type, a.event_date, a.start_time, a.location
         from public.agenda a
         where a.event_date >= (now() at time zone 'Asia/Jakarta')::date
         order by a.event_date, a.start_time nulls last
         limit 1) x)
  );
$$;

-- ---------------------------------------------------------------------------
-- Hak menjalankan fungsi: cabut semua, lalu beri yang perlu saja.
-- (Fungsi trigger & notify_* tidak bisa dipanggil langsung oleh pengguna.)
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

-- Kunci server (script lokal) boleh menjalankan semua fungsi
grant execute on all functions in schema public to service_role;

-- Dipakai aturan RLS & Storage (dijalankan sebagai pengguna yang login)
grant execute on function
  public.has_role(text[]), public.is_approved(), public.my_role(),
  public.my_patient_id(), public.is_my_companion(uuid, uuid)
to authenticated;

-- Halaman Masuk & Daftar (sebelum login)
grant execute on function public.get_login_email(text), public.is_username_available(text)
to anon, authenticated;

-- Fitur aplikasi
grant execute on function
  public.list_accounts(), public.admin_update_account(uuid, text, text),
  public.link_patient_account(uuid, uuid), public.dashboard_stats()
to authenticated;
