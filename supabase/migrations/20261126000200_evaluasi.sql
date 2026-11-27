-- =============================================================================
-- Sahabat Kaki Desa — 9. Evaluasi (9 indikator) + rekap kuesioner tanpa identitas
--
-- Semua fungsi hanya mengembalikan ANGKA (tanpa nama/identitas pasien), sehingga
-- boleh dibuka semua akun yang sudah disetujui (EVA, KUE-04).
-- Indikator 1–8 dihitung otomatis dari data (EVA-01); indikator 9 dari kuesioner (EVA-02).
-- =============================================================================

-- Pasien aktif dalam cakupan (opsional disaring per dusun)
create or replace function public.eval_pasien(p_dusun text)
returns table (id uuid, barriers text[])
language sql stable security definer set search_path = '' as $$
  select p.id, p.barriers
  from public.patients p
  where p.archived_at is null
    and p.status <> 'selesai'
    and (p_dusun is null or lower(btrim(p.dusun)) = lower(btrim(p_dusun)));
$$;

create or replace function public.evaluation_indicators(p_from date, p_to date, p_dusun text default null)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_hari_ini date := (now() at time zone 'Asia/Jakarta')::date;
  v_akhir    date := least(p_to, (now() at time zone 'Asia/Jakarta')::date);
  v_minggu   int  := greatest(1, ceil((least(p_to, (now() at time zone 'Asia/Jakarta')::date) - p_from + 1) / 7.0)::int);
  r jsonb;
begin
  if not public.is_approved() then
    raise exception 'Evaluasi tampil setelah akun disetujui.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from > p_to then
    raise exception 'Periode tidak valid.' using errcode = '22023';
  end if;

  with
  pas as (select * from public.eval_pasien(p_dusun)),
  pend as (
    select c.patient_id from public.companions c
    where c.active and c.patient_id in (select id from pas)
  ),
  latih as (
    select distinct x from (
      select unnest(t.participant_ids)::text as x from public.kader_trainings t where t.training_date <= p_to
      union all
      select lower(btrim(unnest(t.participant_names))) from public.kader_trainings t where t.training_date <= p_to
    ) s where x is not null and x <> ''
  ),
  agenda_lewat as (
    select a.id from public.agenda a where a.event_date between p_from and v_akhir
  ),
  hadir as (
    select at.* from public.attendance at
    where at.agenda_id in (select id from agenda_lewat) and at.patient_id in (select id from pas)
  ),
  kartu as (
    select fv.*, a.color_code, a.assessed_at, a.follow_up_instruction
    from public.foot_visits fv
    left join public.assessments a on a.foot_visit_id = fv.id
    where fv.visit_date between p_from and p_to and fv.status <> 'draft'
      and fv.patient_id in (select id from pas)
  ),
  kuesioner as (
    select distinct on (q.patient_id, q.aspect, q.assessment_type) q.patient_id, q.aspect, q.assessment_type, q.score
    from public.questionnaires q
    where q.patient_id in (select id from pas) and q.score is not null
    order by q.patient_id, q.aspect, q.assessment_type, q.assessed_on desc
  )
  select jsonb_build_object(
    'periode', jsonb_build_object('dari', p_from, 'sampai', p_to, 'jumlah_minggu', v_minggu),
    'pasien_aktif', (select count(*) from pas),
    -- 1. Kader & pendamping yang sudah dilatih
    'i1', jsonb_build_object(
      'terlatih', (select count(*) from latih),
      'pendamping_aktif', (select count(distinct coalesce(c.profile_id::text, lower(btrim(c.name)))) from public.companions c where c.active)
    ),
    -- 2. Pasien yang memperoleh pendamping
    'i2', jsonb_build_object('dengan_pendamping', (select count(distinct patient_id) from pend), 'total', (select count(*) from pas)),
    -- 3. Kunjungan mingguan & kegiatan Pos Kaki
    'i3', jsonb_build_object(
      'minggu_terkunjungi', (
        select count(distinct (cv.patient_id, date_trunc('week', cv.visit_date)))
        from public.companion_visits cv
        where cv.visit_date between p_from and v_akhir and cv.patient_id in (select patient_id from pend)
      ),
      'target_minggu', (select count(distinct patient_id) from pend) * v_minggu,
      'pos_terlaksana', (select count(distinct agenda_id) from hadir where present),
      'pos_terjadwal', (select count(*) from agenda_lewat),
      'hadir', (select count(*) from hadir where present),
      'terdaftar', (select count(*) from hadir),
      'tepat_waktu', (select count(*) from hadir where present and on_time)
    ),
    -- 4. Kelengkapan Kartu Kaki Sehat
    'i4', jsonb_build_object(
      'total', (select count(*) from kartu),
      'lengkap', (select count(*) from kartu where reported_change is not null and color_code is not null and coalesce(btrim(follow_up_instruction), '') <> ''),
      'ditinjau_48j', (select count(*) from kartu where assessed_at is not null and submitted_at is not null and assessed_at - submitted_at <= interval '48 hours')
    ),
    -- 5. Ketepatan pelaporan & tindak lanjut tanda bahaya (kuning/merah)
    'i5', jsonb_build_object(
      'tanda_bahaya', (select count(*) from kartu where color_code in ('kuning', 'merah')),
      'ditindaklanjuti', (select count(*) from kartu where color_code in ('kuning', 'merah') and followed_up_at is not null),
      'dalam_48j', (select count(*) from kartu where color_code in ('kuning', 'merah') and followed_up_at - assessed_at <= interval '48 hours'),
      'rata_jam', (select round(avg(extract(epoch from followed_up_at - assessed_at) / 3600)::numeric, 1) from kartu where color_code in ('kuning', 'merah') and followed_up_at is not null)
    ),
    -- 6. Pemanfaatan Ojek Sehat oleh pasien yang membutuhkan
    'i6', jsonb_build_object(
      'butuh', (select count(*) from pas where 'transportasi' = any (barriers)),
      'memakai', (
        select count(distinct r.patient_id) from public.rides r
        where r.status = 'selesai' and (r.scheduled_at at time zone 'Asia/Jakarta')::date between p_from and p_to
          and r.patient_id in (select id from pas where 'transportasi' = any (barriers))
      ),
      'perjalanan', (
        select count(*) from public.rides r
        where r.status = 'selesai' and (r.scheduled_at at time zone 'Asia/Jakarta')::date between p_from and p_to
          and r.patient_id in (select id from pas)
      )
    ),
    -- 7. Keterlibatan pasien dalam kegiatan masyarakat
    'i7', jsonb_build_object(
      'terlibat', (
        select count(distinct ap.patient_id) from public.activity_participants ap
        join public.activities ac on ac.id = ap.activity_id
        where ap.attended and ac.activity_date between p_from and p_to and ap.patient_id in (select id from pas)
      ),
      'total', (select count(*) from pas),
      'kegiatan', (select count(*) from public.activities ac where ac.activity_date between p_from and p_to)
    ),
    -- 8. Koordinasi rutin (rapat Siaga Kaki)
    'i8', jsonb_build_object(
      'rapat', (select count(*) from public.coordination_meetings m where m.meeting_date between p_from and p_to),
      'bulan', ((extract(year from p_to) - extract(year from p_from)) * 12 + extract(month from p_to) - extract(month from p_from) + 1)::int
    ),
    -- 9. Dukungan sosial, kemandirian, kualitas hidup (skor kuesioner awal vs ulang)
    'i9', coalesce((
      select jsonb_agg(jsonb_build_object(
        'aspek', a.aspect,
        'awal', (select round(avg(score), 2) from kuesioner k where k.aspect = a.aspect and k.assessment_type = 'awal'),
        'ulang', (select round(avg(score), 2) from kuesioner k where k.aspect = a.aspect and k.assessment_type = 'ulang'),
        'n_awal', (select count(*) from kuesioner k where k.aspect = a.aspect and k.assessment_type = 'awal'),
        'n_ulang', (select count(*) from kuesioner k where k.aspect = a.aspect and k.assessment_type = 'ulang')
      ) order by a.aspect)
      from (values ('dukungan_sosial'), ('kemandirian'), ('kualitas_hidup')) a(aspect)
    ), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;

-- EVA-03: grafik per bulan
create or replace function public.evaluation_monthly(p_months int default 6, p_dusun text default null)
returns table (bulan date, kunjungan bigint, kartu bigint, hadir_pos bigint, ojek bigint, kegiatan bigint, rapat bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_approved() then
    raise exception 'Evaluasi tampil setelah akun disetujui.' using errcode = '42501';
  end if;
  return query
  with pas as (select id from public.eval_pasien(p_dusun)),
  bln as (
    select generate_series(
      date_trunc('month', (now() at time zone 'Asia/Jakarta')::date - make_interval(months => greatest(1, least(p_months, 24)) - 1)),
      date_trunc('month', (now() at time zone 'Asia/Jakarta')::date),
      interval '1 month')::date as awal
  )
  select b.awal,
    (select count(*) from public.companion_visits cv where date_trunc('month', cv.visit_date) = b.awal and cv.patient_id in (select id from pas)),
    (select count(*) from public.foot_visits fv where date_trunc('month', fv.visit_date) = b.awal and fv.status <> 'draft' and fv.patient_id in (select id from pas)),
    (select count(*) from public.attendance at join public.agenda a on a.id = at.agenda_id where date_trunc('month', a.event_date) = b.awal and at.present and at.patient_id in (select id from pas)),
    (select count(*) from public.rides r where date_trunc('month', (r.scheduled_at at time zone 'Asia/Jakarta')::date) = b.awal and r.status = 'selesai' and r.patient_id in (select id from pas)),
    (select count(*) from public.activity_participants ap join public.activities ac on ac.id = ap.activity_id where date_trunc('month', ac.activity_date) = b.awal and ap.attended and ap.patient_id in (select id from pas)),
    (select count(*) from public.coordination_meetings m where date_trunc('month', m.meeting_date) = b.awal)
  from bln b
  order by b.awal;
end;
$$;

-- KUE-04: rekap kuesioner tanpa identitas (untuk Kader, Perangkat Desa, dll.)
create or replace function public.questionnaire_recap()
returns table (aspect text, instrument text, assessment_type text, jumlah bigint, rata_rata numeric, terendah numeric, tertinggi numeric)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_approved() then
    raise exception 'Rekap kuesioner tampil setelah akun disetujui.' using errcode = '42501';
  end if;
  return query
  select q.aspect, q.instrument, q.assessment_type, count(*), round(avg(q.score), 2), min(q.score), max(q.score)
  from public.questionnaires q
  join public.patients p on p.id = q.patient_id and p.archived_at is null
  where q.score is not null
  group by q.aspect, q.instrument, q.assessment_type
  order by q.aspect, q.assessment_type;
end;
$$;

revoke execute on function public.eval_pasien(text) from public, anon, authenticated;
revoke execute on function public.evaluation_indicators(date, date, text), public.evaluation_monthly(int, text), public.questionnaire_recap()
  from public, anon;
grant execute on function public.evaluation_indicators(date, date, text), public.evaluation_monthly(int, text), public.questionnaire_recap()
  to authenticated, service_role;
grant execute on function public.eval_pasien(text) to service_role;
