-- =============================================================================
-- Sahabat Kaki Desa — 3. Hak akses (GRANT) + Row Level Security
--
-- Sumber aturan: PRD bagian 4 (matriks hak akses) + docs/KEPUTUSAN.md.
-- Kelompok peran yang sering dipakai di bawah:
--   KLINIS = perawat, kader, admin          (boleh membaca data klinis semua pasien)
--   STAF   = perawat, kader, desa, admin
-- Pasien/Keluarga hanya melihat data pasien yang terhubung ke akunnya
-- (public.my_patient_id()). Semua fungsi has_role() mensyaratkan akun sudah
-- DISETUJUI, jadi akun yang menunggu persetujuan tidak bisa mengubah apa pun
-- dan hanya melihat info umum.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Lapis 1: hak dasar tabel. Mulai dari nol, lalu beri yang diperlukan saja.
-- (Pengunjung tanpa login / "anon" tidak diberi akses ke tabel mana pun.)
-- ---------------------------------------------------------------------------
-- Ditulis eksplisit supaya tetap benar walaupun opsi "Grant API access to new tables
-- automatically" di Supabase tidak dicentang saat membuat proyek.
grant usage on schema public to anon, authenticated, service_role;

-- service_role = kunci server (hanya untuk script lokal seperti create-demo-users.js,
-- TIDAK PERNAH di frontend). Ia melewati RLS, tetapi tetap butuh hak tabel.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on
  public.patients, public.companions, public.companion_visits, public.foot_visits,
  public.assessments, public.agenda, public.attendance, public.drivers, public.rides,
  public.funds, public.community_resources, public.activities, public.activity_participants,
  public.kader_trainings, public.coordination_meetings, public.questionnaires, public.articles,
  public.master_options, public.app_settings, public.evaluation_notes
to authenticated;

-- Profil: hanya boleh mengubah kolom ini. Peran, status persetujuan, dan tautan
-- pasien diubah lewat fungsi khusus (lihat file rpc).
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_path, dusun, rt) on public.profiles to authenticated;

-- Notifikasi: dibuat oleh sistem; pengguna hanya membaca, menandai dibaca, menghapus.
grant select, delete on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

-- Log aktivitas: hanya dibaca. Diisi otomatis oleh trigger.
grant select on public.activity_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Lapis 2: Row Level Security di SEMUA tabel
-- ---------------------------------------------------------------------------
alter table public.profiles              enable row level security;
alter table public.patients              enable row level security;
alter table public.companions            enable row level security;
alter table public.companion_visits      enable row level security;
alter table public.foot_visits           enable row level security;
alter table public.assessments           enable row level security;
alter table public.agenda                enable row level security;
alter table public.attendance            enable row level security;
alter table public.drivers               enable row level security;
alter table public.rides                 enable row level security;
alter table public.funds                 enable row level security;
alter table public.community_resources   enable row level security;
alter table public.activities            enable row level security;
alter table public.activity_participants enable row level security;
alter table public.kader_trainings       enable row level security;
alter table public.coordination_meetings enable row level security;
alter table public.questionnaires        enable row level security;
alter table public.articles              enable row level security;
alter table public.notifications         enable row level security;
alter table public.activity_logs         enable row level security;
alter table public.master_options        enable row level security;
alter table public.app_settings          enable row level security;
alter table public.evaluation_notes      enable row level security;

-- ===== profiles ==============================================================
-- Diri sendiri selalu; STAF yang disetujui melihat semua akun; Pasien/Keluarga
-- melihat akun petugas (misalnya kontak kader), bukan akun pasien lain.
create policy "profil: baca" on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or (select public.has_role('perawat', 'kader', 'desa', 'admin'))
    or (role <> 'pasien' and (select public.has_role('pasien')))
  );
create policy "profil: ubah milik sendiri" on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ===== patients ==============================================================
-- Perangkat Desa TIDAK membaca tabel ini langsung; mereka memakai view
-- patient_directory (data ringkas tanpa catatan klinis).
create policy "pasien: baca" on public.patients for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')) or id = (select public.my_patient_id()));
create policy "pasien: tambah" on public.patients for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'admin')));
-- Pasien/Keluarga boleh mengubah identitas pasiennya sendiri; kolom status &
-- arsip dijaga oleh trigger guard_patient.
create policy "pasien: ubah" on public.patients for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')) or id = (select public.my_patient_id()))
  with check ((select public.has_role('perawat', 'kader', 'admin')) or id = (select public.my_patient_id()));
create policy "pasien: hapus permanen hanya admin" on public.patients for delete to authenticated
  using ((select public.has_role('admin')));

-- ===== companions (pasangan pendamping) ======================================
create policy "pendamping: baca" on public.companions for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "pendamping: tambah (perawat)" on public.companions for insert to authenticated
  with check ((select public.has_role('perawat', 'admin')));
create policy "pendamping: ubah (perawat)" on public.companions for update to authenticated
  using ((select public.has_role('perawat', 'admin')))
  with check ((select public.has_role('perawat', 'admin')));
create policy "pendamping: hapus (perawat)" on public.companions for delete to authenticated
  using ((select public.has_role('perawat', 'admin')));

-- ===== companion_visits (kunjungan Sahabat Kaki) =============================
-- Kader hanya mencatat kunjungan pasien dampingannya sendiri.
create policy "kunjungan pendamping: baca" on public.companion_visits for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "kunjungan pendamping: tambah" on public.companion_visits for insert to authenticated
  with check (
    (select public.has_role('perawat', 'admin'))
    or ((select public.has_role('kader')) and public.is_my_companion(companion_id, patient_id))
  );
create policy "kunjungan pendamping: ubah" on public.companion_visits for update to authenticated
  using (
    (select public.has_role('perawat', 'admin'))
    or ((select public.has_role('kader')) and public.is_my_companion(companion_id, patient_id))
  )
  with check (
    (select public.has_role('perawat', 'admin'))
    or ((select public.has_role('kader')) and public.is_my_companion(companion_id, patient_id))
  );
create policy "kunjungan pendamping: hapus" on public.companion_visits for delete to authenticated
  using (
    (select public.has_role('perawat', 'admin'))
    or ((select public.has_role('kader')) and public.is_my_companion(companion_id, patient_id))
  );

-- ===== foot_visits (Kartu Kaki Sehat — catatan kader) ========================
-- Aturan status (kader tidak bisa memberi status "Dinilai", catatan terkunci
-- setelah dinilai) dijaga oleh trigger guard_foot_visit.
create policy "kartu kaki: baca" on public.foot_visits for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "kartu kaki: tambah" on public.foot_visits for insert to authenticated
  with check (
    (select public.has_role('perawat', 'admin'))
    or ((select public.has_role('kader')) and status in ('draft', 'dikirim'))
  );
create policy "kartu kaki: ubah" on public.foot_visits for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "kartu kaki: hapus" on public.foot_visits for delete to authenticated
  using (
    (select public.has_role('perawat', 'admin'))
    or ((select public.has_role('kader')) and status = 'draft')
  );

-- ===== assessments (kode warna + SBAR) — HANYA perawat/admin yang mengisi =====
create policy "penilaian: baca" on public.assessments for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "penilaian: tambah (perawat)" on public.assessments for insert to authenticated
  with check ((select public.has_role('perawat', 'admin')));
create policy "penilaian: ubah (perawat)" on public.assessments for update to authenticated
  using ((select public.has_role('perawat', 'admin')))
  with check ((select public.has_role('perawat', 'admin')));
create policy "penilaian: hapus (perawat)" on public.assessments for delete to authenticated
  using ((select public.has_role('perawat', 'admin')));

-- ===== agenda (Pos Kaki) =====================================================
create policy "agenda: baca semua" on public.agenda for select to authenticated using (true);
create policy "agenda: tambah" on public.agenda for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "agenda: ubah" on public.agenda for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "agenda: hapus" on public.agenda for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')));

-- ===== attendance (kehadiran Pos Kaki) =======================================
create policy "kehadiran: baca" on public.attendance for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "kehadiran: tambah" on public.attendance for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "kehadiran: ubah" on public.attendance for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "kehadiran: hapus" on public.attendance for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')));

-- ===== drivers (Ojek Sehat) ==================================================
create policy "driver: baca (akun disetujui)" on public.drivers for select to authenticated
  using ((select public.is_approved()));
create policy "driver: tambah" on public.drivers for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "driver: ubah" on public.drivers for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "driver: hapus" on public.drivers for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')));

-- ===== rides (pemesanan Ojek Sehat) ==========================================
create policy "ojek: baca" on public.rides for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "ojek: tambah" on public.rides for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "ojek: ubah" on public.rides for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'admin')));
create policy "ojek: hapus" on public.rides for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'admin')));

-- ===== funds (Jimpitan Sehat) — semua peran bisa melihat (transparan) =========
create policy "jimpitan: baca semua" on public.funds for select to authenticated using (true);
create policy "jimpitan: tambah" on public.funds for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "jimpitan: ubah" on public.funds for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "jimpitan: hapus" on public.funds for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')));

-- ===== community_resources & activities (Pemberdayaan) =======================
create policy "sumber daya: baca semua" on public.community_resources for select to authenticated using (true);
create policy "sumber daya: tambah" on public.community_resources for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "sumber daya: ubah" on public.community_resources for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "sumber daya: hapus" on public.community_resources for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')));

create policy "kegiatan: baca semua" on public.activities for select to authenticated using (true);
create policy "kegiatan: tambah" on public.activities for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "kegiatan: ubah" on public.activities for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "kegiatan: hapus" on public.activities for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')));

-- ===== activity_participants — Pasien/Keluarga boleh mendaftarkan dirinya =====
create policy "peserta kegiatan: baca" on public.activity_participants for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "peserta kegiatan: tambah" on public.activity_participants for insert to authenticated
  with check (
    (select public.has_role('perawat', 'kader', 'desa', 'admin'))
    or (patient_id = (select public.my_patient_id()) and attended is null)
  );
create policy "peserta kegiatan: ubah (catat hadir)" on public.activity_participants for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "peserta kegiatan: hapus/batal daftar" on public.activity_participants for delete to authenticated
  using (
    (select public.has_role('perawat', 'kader', 'desa', 'admin'))
    or (patient_id = (select public.my_patient_id()) and attended is null)
  );

-- ===== kader_trainings & coordination_meetings (Pemberdayaan) ================
create policy "pelatihan: baca (akun disetujui)" on public.kader_trainings for select to authenticated
  using ((select public.is_approved()));
create policy "pelatihan: tambah" on public.kader_trainings for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "pelatihan: ubah" on public.kader_trainings for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "pelatihan: hapus" on public.kader_trainings for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')));

create policy "rapat: baca (akun disetujui)" on public.coordination_meetings for select to authenticated
  using ((select public.is_approved()));
create policy "rapat: tambah" on public.coordination_meetings for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "rapat: ubah" on public.coordination_meetings for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "rapat: hapus" on public.coordination_meetings for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')));

-- ===== questionnaires — jawaban lengkap: perawat, admin, pasien ybs ===========
-- Kader & Perangkat Desa melihat rekap tanpa identitas lewat fungsi (Fase 4).
create policy "kuesioner: baca" on public.questionnaires for select to authenticated
  using ((select public.has_role('perawat', 'admin')) or patient_id = (select public.my_patient_id()));
create policy "kuesioner: tambah (perawat)" on public.questionnaires for insert to authenticated
  with check ((select public.has_role('perawat', 'admin')));
create policy "kuesioner: ubah (perawat)" on public.questionnaires for update to authenticated
  using ((select public.has_role('perawat', 'admin')))
  with check ((select public.has_role('perawat', 'admin')));
create policy "kuesioner: hapus (perawat)" on public.questionnaires for delete to authenticated
  using ((select public.has_role('perawat', 'admin')));

-- ===== articles (pengumuman & edukasi di Beranda) ============================
create policy "artikel: baca" on public.articles for select to authenticated
  using (published or (select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "artikel: tambah" on public.articles for insert to authenticated
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "artikel: ubah" on public.articles for update to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check ((select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "artikel: hapus" on public.articles for delete to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')));

-- ===== notifications — hanya penerimanya =====================================
create policy "notifikasi: baca milik sendiri" on public.notifications for select to authenticated
  using (recipient_id = (select auth.uid()));
create policy "notifikasi: tandai dibaca" on public.notifications for update to authenticated
  using (recipient_id = (select auth.uid()))
  with check (recipient_id = (select auth.uid()));
create policy "notifikasi: hapus milik sendiri" on public.notifications for delete to authenticated
  using (recipient_id = (select auth.uid()));

-- ===== activity_logs =========================================================
create policy "log: baca" on public.activity_logs for select to authenticated
  using ((select public.has_role('perawat', 'kader', 'desa', 'admin')) or actor_id = (select auth.uid()));

-- ===== master_options, app_settings, evaluation_notes ========================
create policy "master data: baca semua" on public.master_options for select to authenticated using (true);
create policy "master data: tambah" on public.master_options for insert to authenticated
  with check ((select public.has_role('perawat', 'admin')));
create policy "master data: ubah" on public.master_options for update to authenticated
  using ((select public.has_role('perawat', 'admin')))
  with check ((select public.has_role('perawat', 'admin')));
create policy "master data: hapus" on public.master_options for delete to authenticated
  using ((select public.has_role('perawat', 'admin')));

create policy "pengaturan: baca semua" on public.app_settings for select to authenticated using (true);
create policy "pengaturan: tambah" on public.app_settings for insert to authenticated
  with check ((select public.has_role('perawat', 'admin')));
create policy "pengaturan: ubah" on public.app_settings for update to authenticated
  using ((select public.has_role('perawat', 'admin')))
  with check ((select public.has_role('perawat', 'admin')));
create policy "pengaturan: hapus" on public.app_settings for delete to authenticated
  using ((select public.has_role('perawat', 'admin')));

create policy "catatan evaluasi: baca (akun disetujui)" on public.evaluation_notes for select to authenticated
  using ((select public.is_approved()));
create policy "catatan evaluasi: tambah" on public.evaluation_notes for insert to authenticated
  with check ((select public.has_role('perawat', 'admin')));
create policy "catatan evaluasi: ubah" on public.evaluation_notes for update to authenticated
  using ((select public.has_role('perawat', 'admin')))
  with check ((select public.has_role('perawat', 'admin')));
create policy "catatan evaluasi: hapus" on public.evaluation_notes for delete to authenticated
  using ((select public.has_role('perawat', 'admin')));

-- ---------------------------------------------------------------------------
-- View ringkas (tanpa catatan klinis) untuk Perangkat Desa dan ringkasan umum.
-- View ini berjalan dengan hak pemilik (security_invoker = false), tetapi
-- barisnya DISARING sendiri di klausa WHERE, dan hanya diberi hak SELECT.
-- ---------------------------------------------------------------------------
create view public.patient_directory
  with (security_invoker = false, security_barrier = true) as
  select p.id, p.full_name, p.dusun, p.rt, p.rw, p.gender, p.status, p.archived_at
  from public.patients p
  where (select public.has_role('perawat', 'kader', 'desa', 'admin'))
     or p.id = (select public.my_patient_id());
comment on view public.patient_directory is
  'Data pasien ringkas (nama, dusun, RT/RW, status) — dipakai Perangkat Desa. Tanpa catatan klinis.';

create view public.foot_card_summary
  with (security_invoker = false, security_barrier = true) as
  select fv.id, fv.patient_id, fv.visit_date, fv.status, fv.submitted_at, fv.followed_up_at,
         a.color_code, a.assessed_at
  from public.foot_visits fv
  left join public.assessments a on a.foot_visit_id = fv.id
  where (select public.has_role('perawat', 'kader', 'desa', 'admin'))
     or fv.patient_id = (select public.my_patient_id());
comment on view public.foot_card_summary is
  'Ringkasan Kartu Kaki Sehat (tanggal, status, kode warna) — tanpa pengamatan, foto, dan SBAR.';

create view public.companion_visit_summary
  with (security_invoker = false, security_barrier = true) as
  select cv.id, cv.patient_id, cv.companion_id, cv.visit_date, cv.activity_type, cv.report_to_nurse
  from public.companion_visits cv
  where (select public.has_role('perawat', 'kader', 'desa', 'admin'))
     or cv.patient_id = (select public.my_patient_id());
comment on view public.companion_visit_summary is
  'Ringkasan kunjungan Sahabat Kaki (tanggal & jenis) — tanpa teks keluhan/dukungan.';

revoke all on public.patient_directory, public.foot_card_summary, public.companion_visit_summary
  from anon, authenticated;
grant select on public.patient_directory, public.foot_card_summary, public.companion_visit_summary
  to authenticated, service_role;
