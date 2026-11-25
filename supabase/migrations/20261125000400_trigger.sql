-- =============================================================================
-- Sahabat Kaki Desa — 4. Trigger
--   a. updated_at otomatis
--   b. profil otomatis saat mendaftar (+ notifikasi ke Admin)
--   c. activity_logs otomatis untuk setiap tambah/ubah/hapus
--   d. penjaga aturan: identitas pasien & alur status Kartu Kaki Sehat
--   e. notifikasi lonceng (perawat: kartu dikirim / lapor pendamping;
--      kader: kode warna + arahan dari perawat)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- a. updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'patients', 'companions', 'companion_visits', 'foot_visits', 'assessments',
    'agenda', 'attendance', 'drivers', 'rides', 'funds', 'community_resources', 'activities',
    'activity_participants', 'kader_trainings', 'coordination_meetings', 'questionnaires',
    'articles', 'master_options', 'app_settings', 'evaluation_notes'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fungsi bantu notifikasi (hanya dipanggil dari trigger, tidak bisa dipanggil
-- langsung oleh pengguna — hak EXECUTE dicabut di file rpc).
-- ---------------------------------------------------------------------------
create or replace function public.notify_user(p_recipient uuid, p_title text, p_message text, p_link text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (recipient_id, title, message, link)
  select p_recipient, p_title, p_message, p_link
  where p_recipient is not null;
$$;

create or replace function public.notify_role(
  p_role text, p_title text, p_message text, p_link text, p_except uuid default null)
returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (recipient_id, title, message, link)
  select p.id, p_title, p_message, p_link
  from public.profiles p
  where p.role = p_role
    and p.approval_status = 'disetujui'
    and p.id is distinct from p_except;
$$;

-- ---------------------------------------------------------------------------
-- b. Profil otomatis saat mendaftar
--    Data dari form Daftar dikirim sebagai metadata: full_name, username,
--    phone, role. Admin tidak bisa dipilih saat daftar (dipaksa jadi pasien).
--    Perawat/Kader/Perangkat Desa berstatus "menunggu" sampai disetujui Admin.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  meta       jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role     text  := lower(coalesce(meta ->> 'role', 'pasien'));
  v_username text;
  v_name     text;
begin
  if v_role not in ('perawat', 'kader', 'pasien', 'desa') then
    v_role := 'pasien';
  end if;

  v_username := lower(regexp_replace(
    coalesce(nullif(btrim(meta ->> 'username'), ''), split_part(new.email, '@', 1), 'pengguna'),
    '[^a-zA-Z0-9._]', '', 'g'));
  if length(v_username) < 3 then
    v_username := v_username || substr(md5(random()::text), 1, 4);
  end if;
  v_username := left(v_username, 30);
  -- Jika username sudah dipakai, tambahkan angka acak
  while exists (select 1 from public.profiles where lower(username) = v_username) loop
    v_username := left(v_username, 25) || floor(random() * 100000)::int;
  end loop;

  v_name := coalesce(nullif(btrim(meta ->> 'full_name'), ''), split_part(new.email, '@', 1));

  insert into public.profiles (id, full_name, username, phone, role, dusun, rt, approval_status, approved_at)
  values (
    new.id, v_name, v_username,
    nullif(btrim(meta ->> 'phone'), ''),
    v_role,
    nullif(btrim(meta ->> 'dusun'), ''),
    nullif(btrim(meta ->> 'rt'), ''),
    case when v_role = 'pasien' then 'disetujui' else 'menunggu' end,
    case when v_role = 'pasien' then now() end
  );

  if v_role <> 'pasien' then
    perform public.notify_role(
      'admin',
      'Akun baru menunggu persetujuan',
      v_name || ' mendaftar sebagai ' ||
        case v_role when 'perawat' then 'Perawat Puskesmas' when 'kader' then 'Kader' else 'Perangkat Desa' end || '.',
      '/kelola-akun');
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- c. Log aktivitas otomatis: siapa, aksi, tabel, id data, waktu (DATA-04)
-- ---------------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.activity_logs (actor_id, action, table_name, record_id)
  values (
    (select p.id from public.profiles p where p.id = auth.uid()),
    tg_op,
    tg_table_name,
    coalesce(v_row ->> 'id', v_row ->> 'key')
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles', 'patients', 'companions', 'companion_visits', 'foot_visits', 'assessments',
    'agenda', 'attendance', 'drivers', 'rides', 'funds', 'community_resources', 'activities',
    'activity_participants', 'kader_trainings', 'coordination_meetings', 'questionnaires',
    'articles', 'master_options', 'app_settings', 'evaluation_notes'
  ] loop
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
         for each row execute function public.log_activity()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- d1. Penjaga data pasien
--   - Tanggal persetujuan terisi otomatis saat dicentang (PAS-06).
--   - Kader tidak bisa mengarsipkan (DATA-03 = Perawat/Admin).
--   - Pasien/Keluarga hanya mengubah identitas, bukan status/arsip.
-- ---------------------------------------------------------------------------
create or replace function public.guard_patient()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if new.consent_program and new.consent_program_date is null then new.consent_program_date := v_today; end if;
  if not new.consent_program then new.consent_program_date := null; end if;
  if new.consent_share and new.consent_share_date is null then new.consent_share_date := v_today; end if;
  if not new.consent_share then new.consent_share_date := null; end if;

  -- auth.uid() kosong = dijalankan dari SQL Editor / script server
  if auth.uid() is null or public.has_role('perawat', 'admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.archived_at is not null then
      raise exception 'Hanya perawat atau admin yang bisa mengarsipkan pasien.' using errcode = '42501';
    end if;
    return new;
  end if;

  if public.has_role('kader') then
    if new.archived_at is distinct from old.archived_at then
      raise exception 'Hanya perawat atau admin yang bisa mengarsipkan pasien.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- Pasien/Keluarga (RLS sudah memastikan hanya pasien miliknya)
  if new.status is distinct from old.status
     or new.archived_at is distinct from old.archived_at
     or new.created_by is distinct from old.created_by then
    raise exception 'Akun Pasien/Keluarga hanya bisa mengubah identitas, bukan status atau arsip pasien.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_patient
  before insert or update on public.patients
  for each row execute function public.guard_patient();

-- ---------------------------------------------------------------------------
-- d2. Penjaga Kartu Kaki Sehat (KKS-03, KKS-05, KKS-06)
--   Alur: draft -> dikirim (kader) -> dinilai (otomatis saat perawat menilai)
--         -> ditindaklanjuti (perawat/kader).
--   Kader: hanya draft/dikirim; setelah dinilai, catatan kader terkunci dan
--   kader hanya boleh menandai "ditindaklanjuti" + catatan tindak lanjut.
-- ---------------------------------------------------------------------------
create or replace function public.guard_foot_visit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_is_kader boolean := public.has_role('kader');
  v_followup_cols text[] := array['status', 'followed_up_at', 'followed_up_by', 'follow_up_note', 'updated_at'];
begin
  if tg_op = 'INSERT' then
    new.recorded_by := coalesce(new.recorded_by, auth.uid());
    if new.recorder_name is null then
      select p.full_name into new.recorder_name from public.profiles p where p.id = new.recorded_by;
    end if;
    if v_is_kader and new.status not in ('draft', 'dikirim') then
      raise exception 'Kader hanya bisa menyimpan kartu sebagai Draft atau Dikirim.' using errcode = '42501';
    end if;
    if new.status in ('dinilai', 'ditindaklanjuti') then
      raise exception 'Kartu baru belum punya penilaian perawat.' using errcode = '23514';
    end if;
    if new.status = 'dikirim' then
      new.submitted_at := coalesce(new.submitted_at, now());
    end if;
    return new;
  end if;

  -- UPDATE
  if v_is_kader then
    if old.status in ('draft', 'dikirim') then
      if new.status not in ('draft', 'dikirim') then
        raise exception 'Status "Dinilai perawat" hanya muncul setelah perawat memberi penilaian.'
          using errcode = '42501';
      end if;
    else
      if (to_jsonb(new) - v_followup_cols) <> (to_jsonb(old) - v_followup_cols) then
        raise exception 'Kartu sudah dinilai perawat, catatan kader tidak bisa diubah lagi.'
          using errcode = '42501';
      end if;
      if new.status <> 'ditindaklanjuti' then
        raise exception 'Kartu yang sudah dinilai hanya bisa ditandai "Ditindaklanjuti".'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if new.status in ('dinilai', 'ditindaklanjuti')
     and not exists (select 1 from public.assessments a where a.foot_visit_id = new.id) then
    raise exception 'Kartu belum dinilai perawat.' using errcode = '23514';
  end if;

  if new.status = 'dikirim' and old.status is distinct from 'dikirim' then
    new.submitted_at := now();
  end if;
  if new.status = 'ditindaklanjuti' and old.status is distinct from 'ditindaklanjuti' then
    new.followed_up_at := coalesce(new.followed_up_at, now());
    new.followed_up_by := coalesce(new.followed_up_by, auth.uid());
  end if;
  return new;
end;
$$;

create trigger guard_foot_visit
  before insert or update on public.foot_visits
  for each row execute function public.guard_foot_visit();

-- Notifikasi ke perawat saat kartu dikirim kader
create or replace function public.notify_foot_visit_submitted()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_patient text;
begin
  if new.status = 'dikirim' and (tg_op = 'INSERT' or old.status is distinct from 'dikirim') then
    select p.full_name into v_patient from public.patients p where p.id = new.patient_id;
    perform public.notify_role(
      'perawat',
      'Kartu Kaki Sehat baru: ' || coalesce(v_patient, 'pasien'),
      'Dicatat oleh ' || coalesce(new.recorder_name, 'kader') || '. Mohon dinilai.',
      '/kartu-kaki/' || new.id,
      auth.uid());
  end if;
  return null;
end;
$$;

create trigger notify_foot_visit_submitted
  after insert or update of status on public.foot_visits
  for each row execute function public.notify_foot_visit_submitted();

-- ---------------------------------------------------------------------------
-- d3. Penilaian perawat (assessments)
--   - patient_id diambil dari kartu (tidak bisa dipalsukan).
--   - Kartu otomatis berstatus "dinilai".
--   - Rujukan -> status pasien "rujukan" (alur bagian 7: kode merah -> rujuk).
--   - Notifikasi ke kader pencatat & kader pendamping (kode warna + arahan).
-- ---------------------------------------------------------------------------
create or replace function public.before_assessment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select fv.patient_id into new.patient_id from public.foot_visits fv where fv.id = new.foot_visit_id;
  if new.patient_id is null then
    raise exception 'Kartu kunjungan tidak ditemukan.' using errcode = '23503';
  end if;
  new.nurse_id := coalesce(new.nurse_id, auth.uid());
  return new;
end;
$$;

create trigger before_assessment
  before insert or update on public.assessments
  for each row execute function public.before_assessment();

create or replace function public.after_assessment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_patient  text;
  v_recorder uuid;
  v_warna    text := case new.color_code when 'hijau' then 'Hijau' when 'kuning' then 'Kuning' else 'Merah' end;
begin
  update public.foot_visits
     set status = 'dinilai'
   where id = new.foot_visit_id and status in ('draft', 'dikirim');

  if new.referral and (tg_op = 'INSERT' or not old.referral) then
    update public.patients set status = 'rujukan' where id = new.patient_id and status = 'aktif';
  end if;

  if tg_op = 'INSERT'
     or new.color_code is distinct from old.color_code
     or new.follow_up_instruction is distinct from old.follow_up_instruction
     or new.sbar_recommendation is distinct from old.sbar_recommendation then
    select p.full_name into v_patient from public.patients p where p.id = new.patient_id;
    select fv.recorded_by into v_recorder from public.foot_visits fv where fv.id = new.foot_visit_id;

    insert into public.notifications (recipient_id, title, message, link)
    select distinct pr.id,
           'Kode ' || v_warna || ' untuk ' || coalesce(v_patient, 'pasien'),
           coalesce(nullif(btrim(new.follow_up_instruction), ''), 'Perawat sudah memberi penilaian dan arahan.'),
           '/kartu-kaki/' || new.foot_visit_id
    from public.profiles pr
    where pr.role = 'kader'
      and pr.approval_status = 'disetujui'
      and (pr.id = v_recorder
           or pr.id in (select c.profile_id from public.companions c
                        where c.patient_id = new.patient_id and c.active));
  end if;
  return null;
end;
$$;

create trigger after_assessment
  after insert or update on public.assessments
  for each row execute function public.after_assessment();

-- ---------------------------------------------------------------------------
-- e. "Lapor ke perawat" dari kunjungan pendamping (SK-04)
-- ---------------------------------------------------------------------------
create or replace function public.notify_companion_report()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_patient text;
begin
  if new.report_to_nurse and (tg_op = 'INSERT' or not old.report_to_nurse) then
    select p.full_name into v_patient from public.patients p where p.id = new.patient_id;
    perform public.notify_role(
      'perawat',
      'Laporan pendamping: ' || coalesce(v_patient, 'pasien'),
      coalesce(nullif(btrim(new.report_note), ''), nullif(btrim(new.complaints), ''),
               'Ada keluhan atau perubahan kondisi kaki.'),
      '/pasien/' || new.patient_id,
      auth.uid());
  end if;
  return null;
end;
$$;

create trigger notify_companion_report
  after insert or update of report_to_nurse on public.companion_visits
  for each row execute function public.notify_companion_report();
