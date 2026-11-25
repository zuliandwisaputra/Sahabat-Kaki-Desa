-- =============================================================================
-- Sahabat Kaki Desa — 1. Tabel
-- 20 tabel dari PRD bagian 8 + 3 tabel pendukung (docs/KEPUTUSAN.md no. 11).
-- Semua tanggal "hari ini" memakai zona waktu WIB (Asia/Jakarta).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Akun & profil
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  full_name       text not null default '',
  username        text not null check (username ~ '^[a-z0-9._]{3,30}$'),
  phone           text,
  avatar_path     text,
  role            text not null default 'pasien'
                  check (role in ('perawat', 'kader', 'pasien', 'desa', 'admin')),
  dusun           text,
  rt              text,
  approval_status text not null default 'menunggu'
                  check (approval_status in ('menunggu', 'disetujui', 'ditolak')),
  approved_at     timestamptz,
  approved_by     uuid references public.profiles (id) on delete set null,
  patient_id      uuid, -- untuk akun Pasien/Keluarga; FK ditambahkan setelah tabel patients
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index profiles_username_unik on public.profiles (lower(username));
comment on table public.profiles is 'Satu akun = satu profil. Dibuat otomatis saat mendaftar.';

-- ---------------------------------------------------------------------------
-- Pasien
-- ---------------------------------------------------------------------------
create table public.patients (
  id                    uuid primary key default gen_random_uuid(),
  full_name             text not null check (length(btrim(full_name)) > 0),
  nik                   text check (nik is null or nik ~ '^[0-9]{16}$'),
  birth_date            date not null,
  gender                text not null check (gender in ('L', 'P')),
  dusun                 text not null,
  rt                    text not null,
  rw                    text,
  address_detail        text,
  phone                 text,
  family_name           text,  -- keluarga pendamping
  family_relation       text,
  family_phone          text,
  diabetes_since_year   int check (diabetes_since_year between 1900 and 2100),
  medical_history       text,
  barriers              text[] not null default '{}'
                        check (barriers <@ array['transportasi', 'ekonomi', 'dukungan_keluarga', 'lainnya']),
  barrier_notes         text,
  photo_path            text,
  consent_program       boolean not null default false,  -- PAS-06: setuju ikut program
  consent_program_date  date,
  consent_share         boolean not null default false,  -- PAS-06: setuju kondisi dibagikan ke pendamping & grup
  consent_share_date    date,
  status                text not null default 'aktif' check (status in ('aktif', 'rujukan', 'selesai')),
  archived_at           timestamptz,                     -- DATA-03: arsip, bukan hapus permanen
  created_by            uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
-- PAS-04: tolak pasien ganda (nama + tanggal lahir + alamat dusun/RT sama)
create unique index patients_tidak_ganda
  on public.patients (lower(btrim(full_name)), birth_date, lower(btrim(dusun)), btrim(rt));
create index patients_status_idx on public.patients (status) where archived_at is null;

alter table public.profiles
  add constraint profiles_patient_id_fkey
  foreign key (patient_id) references public.patients (id) on delete set null;
create index profiles_patient_id_idx on public.profiles (patient_id);

-- ---------------------------------------------------------------------------
-- Sahabat Kaki
-- ---------------------------------------------------------------------------
create table public.companions (
  id             uuid primary key default gen_random_uuid(),
  patient_id     uuid not null references public.patients (id) on delete cascade,
  profile_id     uuid references public.profiles (id) on delete set null, -- akun kader (jika punya akun)
  name           text not null,
  companion_type text not null default 'kader' check (companion_type in ('kader', 'pkk', 'lainnya')),
  relation       text,  -- hubungan dengan pasien, mis. "tetangga satu RT"
  phone          text,
  rt             text,
  paired_at      date not null default (now() at time zone 'Asia/Jakarta')::date,
  active         boolean not null default true,
  ended_at       date,
  paired_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
-- SK-01: satu pasien hanya punya satu pendamping aktif
create unique index companions_satu_aktif on public.companions (patient_id) where active;
create index companions_profile_idx on public.companions (profile_id);

create table public.companion_visits (
  id               uuid primary key default gen_random_uuid(),
  patient_id       uuid not null references public.patients (id) on delete cascade,
  companion_id     uuid references public.companions (id) on delete set null,
  visit_date       date not null default (now() at time zone 'Asia/Jakarta')::date,
  activity_type    text not null check (activity_type in ('kunjungan_rumah', 'menemani_kontrol', 'telepon')),
  complaints       text,
  support_given    text,
  follow_up_plan   text,
  report_to_nurse  boolean not null default false, -- SK-04: "Lapor ke perawat"
  report_note      text,
  recorded_by      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index companion_visits_patient_idx on public.companion_visits (patient_id, visit_date desc);
create index companion_visits_companion_idx on public.companion_visits (companion_id);

-- ---------------------------------------------------------------------------
-- Kartu Kaki Sehat (catatan kader) + penilaian perawat
-- ---------------------------------------------------------------------------
create table public.foot_visits (
  id                uuid primary key default gen_random_uuid(),
  patient_id        uuid not null references public.patients (id) on delete cascade,
  visit_date        date not null default (now() at time zone 'Asia/Jakarta')::date,
  recorded_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  recorder_name     text,
  reported_change   text check (reported_change in ('tidak_ada', 'membaik', 'memburuk')),
  signs             text[] not null default '{}'
                    check (signs <@ array['kemerahan', 'bengkak', 'demam', 'bau', 'nyeri']),
  foot_condition    text,  -- kategori kondisi kaki (master_options)
  observation_notes text,
  photo_path        text,  -- di bucket privat wound-photos
  status            text not null default 'draft'
                    check (status in ('draft', 'dikirim', 'dinilai', 'ditindaklanjuti')),
  submitted_at      timestamptz,
  followed_up_at    timestamptz,
  followed_up_by    uuid references public.profiles (id) on delete set null,
  follow_up_note    text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index foot_visits_patient_idx on public.foot_visits (patient_id, visit_date desc);
create index foot_visits_status_idx on public.foot_visits (status);

create table public.assessments (
  id                      uuid primary key default gen_random_uuid(),
  foot_visit_id           uuid not null unique references public.foot_visits (id) on delete cascade,
  patient_id              uuid not null references public.patients (id) on delete cascade,
  nurse_id                uuid default auth.uid() references public.profiles (id) on delete set null,
  color_code              text not null check (color_code in ('hijau', 'kuning', 'merah')),
  sbar_situation          text,
  sbar_background         text,
  sbar_assessment         text,
  sbar_recommendation     text,
  follow_up_instruction   text,
  referral                boolean not null default false,
  referral_to             text,
  activity_recommendation text,  -- PEM-03
  next_control_date       date,  -- jadwal kontrol (KKS-01)
  wound_care_schedule     text,  -- jadwal perawatan luka (KKS-01)
  assessed_at             timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index assessments_patient_idx on public.assessments (patient_id);

-- ---------------------------------------------------------------------------
-- Pos Kaki + Ojek Sehat
-- ---------------------------------------------------------------------------
create table public.agenda (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  agenda_type      text not null default 'pos_kaki'
                   check (agenda_type in ('pos_kaki', 'posbindu_ptm', 'posyandu_ilp', 'kunjungan_perawat', 'lainnya')),
  event_date       date not null,
  start_time       time,
  end_time         time,
  location         text not null,
  person_in_charge text,
  nurse_visit      boolean not null default false, -- ada kunjungan perawat
  quota            int check (quota is null or quota > 0),
  notes            text,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index agenda_date_idx on public.agenda (event_date);

create table public.attendance (
  id              uuid primary key default gen_random_uuid(),
  agenda_id       uuid not null references public.agenda (id) on delete cascade,
  patient_id      uuid not null references public.patients (id) on delete cascade,
  present         boolean,           -- null = belum dicatat
  on_time         boolean,           -- kontrol tepat waktu?
  foot_check_done boolean not null default false,
  education_given text,
  notes           text,
  recorded_by     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (agenda_id, patient_id)
);
create index attendance_patient_idx on public.attendance (patient_id);

create table public.drivers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text not null,
  vehicle_type text,
  service_area text,
  payment_type text not null default 'relawan' check (payment_type in ('relawan', 'berbayar')),
  active       boolean not null default true,
  notes        text,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.rides (
  id                 uuid primary key default gen_random_uuid(),
  patient_id         uuid not null references public.patients (id) on delete cascade,
  driver_id          uuid references public.drivers (id) on delete set null,
  agenda_id          uuid references public.agenda (id) on delete set null,
  pickup_from        text not null,
  destination        text not null check (destination in ('pos_kaki', 'puskesmas', 'rumah_sakit', 'lainnya')),
  destination_detail text,
  scheduled_at       timestamptz not null,
  estimated_cost     int check (estimated_cost is null or estimated_cost >= 0),
  status             text not null default 'dipesan' check (status in ('dipesan', 'dijemput', 'selesai', 'batal')),
  notes              text,
  created_by         uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index rides_patient_idx on public.rides (patient_id);
create index rides_driver_idx on public.rides (driver_id);

-- ---------------------------------------------------------------------------
-- Jimpitan Sehat (hanya pencatatan, tidak ada transfer uang — JIM-05)
-- ---------------------------------------------------------------------------
create table public.funds (
  id          uuid primary key default gen_random_uuid(),
  trx_type    text not null check (trx_type in ('masuk', 'keluar')),
  category    text not null,  -- master_options: kategori_pemasukan / kategori_pengeluaran
  amount      bigint not null check (amount > 0),
  trx_date    date not null default (now() at time zone 'Asia/Jakarta')::date,
  description text not null check (length(btrim(description)) > 0), -- tanpa data pribadi pasien
  proof_path  text,  -- di bucket privat fund-proofs
  ride_id     uuid unique references public.rides (id) on delete set null, -- JIM-03
  recorded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint funds_ride_hanya_pengeluaran check (ride_id is null or trx_type = 'keluar')
);
create index funds_date_idx on public.funds (trx_date);

-- ---------------------------------------------------------------------------
-- Pemberdayaan dan Sumber Daya Desa
-- ---------------------------------------------------------------------------
create table public.community_resources (
  id            uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in (
                  'posbindu_ptm', 'posyandu_ilp', 'kader', 'pkk', 'senam_lansia', 'puskesmas',
                  'ojek_sehat', 'sumber_dana', 'kelompok_dukungan', 'duta_kaki_sehat', 'kebijakan', 'lainnya')),
  name          text not null,
  description   text,
  schedule      text,
  location      text,
  contact       text,
  document_url  text,  -- PEM-07: dokumen kebijakan lokal
  created_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.activities (
  id               uuid primary key default gen_random_uuid(),
  resource_id      uuid references public.community_resources (id) on delete set null,
  title            text not null,
  activity_type    text not null check (activity_type in (
                     'senam_lansia', 'kunjungan_pkk', 'kelompok_dukungan', 'edukasi_anti_stigma', 'lainnya')),
  activity_date    date not null,
  start_time       time,
  location         text,
  person_in_charge text,
  description      text,
  created_by       uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index activities_date_idx on public.activities (activity_date);

create table public.activity_participants (
  id               uuid primary key default gen_random_uuid(),
  activity_id      uuid not null references public.activities (id) on delete cascade,
  patient_id       uuid references public.patients (id) on delete cascade,
  participant_name text,  -- untuk warga yang bukan pasien
  attended         boolean,  -- null = belum dicatat kader
  registered_by    uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint peserta_ada_nama check (patient_id is not null or participant_name is not null)
);
create unique index activity_participants_pasien_unik
  on public.activity_participants (activity_id, patient_id) where patient_id is not null;
create index activity_participants_patient_idx on public.activity_participants (patient_id);

create table public.kader_trainings (
  id                uuid primary key default gen_random_uuid(),
  training_date     date not null,
  title             text not null,
  topics            text[] not null default '{}', -- tanda bahaya luka, pengisian KKS, mekanisme pelaporan, ...
  trainer           text,
  location          text,
  participant_ids   uuid[] not null default '{}', -- akun kader yang ikut
  participant_names text[] not null default '{}', -- peserta tanpa akun (mis. anggota PKK)
  substitute_kaders text,                         -- daftar kader pengganti
  notes             text,
  created_by        uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.coordination_meetings (
  id           uuid primary key default gen_random_uuid(),
  meeting_date date not null,
  title        text not null default 'Rapat Siaga Kaki',
  location     text,
  attendees    text,
  minutes      text,  -- notulen
  decisions    text,
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Kuesioner (KUE)
-- ---------------------------------------------------------------------------
create table public.questionnaires (
  id              uuid primary key default gen_random_uuid(),
  patient_id      uuid not null references public.patients (id) on delete cascade,
  aspect          text not null check (aspect in ('kualitas_hidup', 'dukungan_sosial', 'kemandirian')),
  instrument      text not null,
  assessment_type text not null check (assessment_type in ('awal', 'ulang')),
  assessed_on     date not null default (now() at time zone 'Asia/Jakarta')::date,
  answers         jsonb not null default '{}'::jsonb,
  score           numeric(6, 2),
  nurse_id        uuid default auth.uid() references public.profiles (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index questionnaires_patient_idx on public.questionnaires (patient_id, aspect, assessed_on);

-- ---------------------------------------------------------------------------
-- Beranda: pengumuman & artikel
-- ---------------------------------------------------------------------------
create table public.articles (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  body       text not null,
  category   text not null check (category in ('pengumuman', 'edukasi', 'anti_stigma', 'duta_kaki_sehat')),
  image_path text,
  author_id  uuid default auth.uid() references public.profiles (id) on delete set null,
  published  boolean not null default true,
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifikasi & log aktivitas
-- ---------------------------------------------------------------------------
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  message      text,
  link         text,
  is_read      boolean not null default false,
  created_at   timestamptz not null default now()
);
create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);

create table public.activity_logs (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id  text,
  created_at timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);
create index activity_logs_actor_idx on public.activity_logs (actor_id);

-- ---------------------------------------------------------------------------
-- Tabel pendukung (tambahan)
-- ---------------------------------------------------------------------------
create table public.master_options (
  id         uuid primary key default gen_random_uuid(),
  category   text not null check (category in (
               'dusun', 'rt', 'pos_kaki', 'kondisi_kaki', 'kategori_pemasukan', 'kategori_pengeluaran')),
  value      text not null check (length(btrim(value)) > 0),
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, value)
);

create table public.app_settings (
  key        text primary key,
  label      text not null,
  value      text,
  updated_by uuid default auth.uid() references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.evaluation_notes (
  id             uuid primary key default gen_random_uuid(),
  period_month   date not null check (extract(day from period_month) = 1), -- tanggal 1 bulan tsb.
  dusun          text,  -- kosong = semua dusun
  notes          text not null,
  follow_up_plan text,
  author_id      uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Data awal yang bukan data pasien (pengaturan & kategori umum)
-- ---------------------------------------------------------------------------
insert into public.app_settings (key, label, value) values
  ('nama_desa',         'Nama desa',                    null),
  ('nama_puskesmas',    'Nama Puskesmas',               null),
  ('telepon_puskesmas', 'Nomor telepon/WA Puskesmas',   null),
  ('link_grup_wa',      'Link grup WhatsApp Sahabat Kaki', null);

insert into public.master_options (category, value, sort_order) values
  ('kategori_pemasukan',   'Iuran sukarela warga', 1),
  ('kategori_pemasukan',   'APBDes',               2),
  ('kategori_pemasukan',   'Donasi',               3),
  ('kategori_pemasukan',   'Sumber lain',          4),
  ('kategori_pengeluaran', 'Ojek Sehat',           1),
  ('kategori_pengeluaran', 'Operasional Pos Kaki', 2),
  ('kategori_pengeluaran', 'Pelatihan kader',      3),
  ('kategori_pengeluaran', 'Lainnya',              4),
  ('kondisi_kaki',         'Kaki sehat, tanpa luka', 1),
  ('kondisi_kaki',         'Kulit kering/pecah-pecah', 2),
  ('kondisi_kaki',         'Kapalan/mata ikan',    3),
  ('kondisi_kaki',         'Luka ringan',          4),
  ('kondisi_kaki',         'Luka dalam/bernanah',  5);
