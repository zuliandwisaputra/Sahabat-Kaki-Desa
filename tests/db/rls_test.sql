-- =============================================================================
-- Uji hak akses per peran (Gerbang Fase 1: "uji akses 4 peran lulus").
-- Dijalankan oleh tests/db/run.sh di PostgreSQL lokal + tiruan Supabase.
-- Setiap baris uji.cek() = satu skenario; hasil akhir dicetak di bawah.
-- =============================================================================
\set ON_ERROR_STOP on
set client_min_messages = warning;

create schema uji;
create table uji.hasil (no serial primary key, nama text not null, lulus boolean not null, detail text);
create table uji.akun (nama text primary key, id uuid not null);
create table uji.data (nama text primary key, id uuid not null);

create function uji.id(p text) returns uuid language sql stable as $$
  select coalesce((select id from uji.akun where nama = p), (select id from uji.data where nama = p));
$$;

-- Jalankan SQL sebagai akun tertentu (null = pengunjung tanpa login).
-- Hasil: 'ok:<jumlah baris>' atau 'error:<pesan>'.
create function uji.sebagai(p_akun text, p_sql text) returns text language plpgsql as $$
declare n bigint; r text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uji.id(p_akun)::text, ''), true);
  if p_akun is null then execute 'set local role anon';
  elsif p_akun = 'server' then execute 'set local role service_role';
  else execute 'set local role authenticated'; end if;
  begin
    execute p_sql;
    get diagnostics n = row_count;
    r := 'ok:' || n;
  exception when others then
    r := 'error:' || sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return r;
end $$;

-- Ambil satu nilai (kolom pertama baris pertama) sebagai akun tertentu.
create function uji.nilai(p_akun text, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claim.sub', coalesce(uji.id(p_akun)::text, ''), true);
  if p_akun is null then execute 'set local role anon';
  elsif p_akun = 'server' then execute 'set local role service_role';
  else execute 'set local role authenticated'; end if;
  begin
    execute p_sql into r;
  exception when others then
    r := 'error:' || sqlerrm;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  return r;
end $$;

create function uji.cek(p_nama text, p_hasil text, p_harapan text) returns void language plpgsql as $$
begin
  insert into uji.hasil (nama, lulus, detail)
  values (p_nama, coalesce(p_hasil like p_harapan, false), p_hasil);
end $$;

-- =============================================================================
-- A. Pendaftaran & profil otomatis
-- =============================================================================
insert into uji.akun values
  ('admin',   '00000000-0000-0000-0000-0000000000a1'),
  ('perawat', '00000000-0000-0000-0000-0000000000a2'),
  ('kader',   '00000000-0000-0000-0000-0000000000a3'),
  ('kader2',  '00000000-0000-0000-0000-0000000000a4'),
  ('desa',    '00000000-0000-0000-0000-0000000000a5'),
  ('pasien',  '00000000-0000-0000-0000-0000000000a6'),
  ('pasien2', '00000000-0000-0000-0000-0000000000a7'),
  ('baru',    '00000000-0000-0000-0000-0000000000a8'),
  ('desa2',   '00000000-0000-0000-0000-0000000000a9');

insert into auth.users (id, email, raw_user_meta_data) values
  (uji.id('admin'),   'admin@uji.id',   '{"full_name":"Admin Uji","username":"admin","role":"admin"}'),
  (uji.id('perawat'), 'perawat@uji.id', '{"full_name":"Perawat Cindy","username":"perawat","role":"perawat","phone":"081200000001"}'),
  (uji.id('kader'),   'kader@uji.id',   '{"full_name":"Kader Ani","username":"Kader","role":"kader"}'),
  (uji.id('kader2'),  'kader2@uji.id',  '{"full_name":"Kader Budi","username":"kader2","role":"kader"}'),
  (uji.id('desa'),    'desa@uji.id',    '{"full_name":"Pak Kades","username":"desa","role":"desa"}'),
  (uji.id('pasien'),  'pasien@uji.id',  '{"full_name":"Tn. S","username":"keluarga.s","role":"pasien"}'),
  (uji.id('pasien2'), 'pasien2@uji.id', '{"full_name":"Warga Lain","username":"warga","role":"pasien"}'),
  (uji.id('baru'),    'baru@uji.id',    '{"full_name":"Perawat Baru","username":"perawat","role":"perawat"}');

select uji.cek('A1 profil otomatis dibuat untuk setiap akun',
  (select count(*)::text from public.profiles), '8');
select uji.cek('A2 peran "admin" tidak bisa dipilih saat daftar (jadi pasien)',
  (select role from public.profiles where id = uji.id('admin')), 'pasien');
select uji.cek('A3 perawat baru berstatus menunggu',
  (select approval_status from public.profiles where id = uji.id('perawat')), 'menunggu');
select uji.cek('A4 pasien/keluarga langsung aktif',
  (select approval_status from public.profiles where id = uji.id('pasien')), 'disetujui');
select uji.cek('A5 username dibuat huruf kecil',
  (select username from public.profiles where id = uji.id('kader')), 'kader');
select uji.cek('A6 username bentrok diberi akhiran angka',
  (select (username <> 'perawat' and username like 'perawat%')::text from public.profiles where id = uji.id('baru')), 'true');

-- Admin pertama dibuat dari SQL/script (bukan lewat form Daftar)
update public.profiles set role = 'admin', approval_status = 'disetujui' where id = uji.id('admin');

-- =============================================================================
-- B. Persetujuan akun & profil
-- =============================================================================
select uji.cek('B1 kader tidak bisa menyetujui akun',
  uji.sebagai('kader', format('select public.admin_update_account(%L, null, %L)', uji.id('kader'), 'disetujui')), 'error:%');
select uji.cek('B2 perawat (belum disetujui) tidak bisa menyetujui akun',
  uji.sebagai('perawat', format('select public.admin_update_account(%L, null, %L)', uji.id('perawat'), 'disetujui')), 'error:%');
select uji.cek('B3 admin menyetujui perawat',
  uji.sebagai('admin', format('select public.admin_update_account(%L, null, %L)', uji.id('perawat'), 'disetujui')), 'ok:%');
select uji.sebagai('admin', format('select public.admin_update_account(%L, null, %L)', uji.id('kader'), 'disetujui'));
select uji.sebagai('admin', format('select public.admin_update_account(%L, null, %L)', uji.id('kader2'), 'disetujui'));
select uji.sebagai('admin', format('select public.admin_update_account(%L, null, %L)', uji.id('desa'), 'disetujui'));
select uji.cek('B4 akun yang disetujui mendapat notifikasi',
  (select count(*)::text from public.notifications where recipient_id = uji.id('perawat') and title like 'Akun Anda sudah disetujui%'), '1');
select uji.cek('B5 admin tidak bisa menurunkan perannya sendiri',
  uji.sebagai('admin', format('select public.admin_update_account(%L, %L, null)', uji.id('admin'), 'kader')), 'error:%');
select uji.cek('B6 pengguna tidak bisa mengubah perannya sendiri',
  uji.sebagai('kader', format('update public.profiles set role = %L where id = %L', 'admin', uji.id('kader'))), 'error:%');
select uji.cek('B7 pengguna tidak bisa menyetujui dirinya sendiri',
  uji.sebagai('baru', format('update public.profiles set approval_status = %L where id = %L', 'disetujui', uji.id('baru'))), 'error:%');
select uji.cek('B8 pengguna bisa mengubah nama & HP sendiri',
  uji.sebagai('kader', format('update public.profiles set full_name = %L, phone = %L where id = %L', 'Kader Ani S.', '0813', uji.id('kader'))), 'ok:1');
select uji.cek('B9 pengguna tidak bisa mengubah profil orang lain',
  uji.sebagai('kader', format('update public.profiles set full_name = %L where id = %L', 'X', uji.id('kader2'))), 'ok:0');
insert into auth.users (id, email, raw_user_meta_data) values
  (uji.id('desa2'), 'desa2@uji.id', '{"full_name":"Bu Sekdes","username":"sekdes","role":"desa"}');
select uji.cek('B10 admin mendapat notifikasi saat ada akun baru menunggu',
  (select count(*)::text from public.notifications where recipient_id = uji.id('admin') and title = 'Akun baru menunggu persetujuan'), '1');
select uji.cek('B11 pasien tidak melihat akun pasien lain',
  uji.nilai('pasien', format('select count(*) from public.profiles where id = %L', uji.id('pasien2'))), '0');
select uji.cek('B12 pasien melihat akun petugas (kontak kader)',
  uji.nilai('pasien', format('select count(*) from public.profiles where id = %L', uji.id('kader'))), '1');
select uji.cek('B13 akun menunggu persetujuan hanya melihat profilnya sendiri',
  uji.nilai('baru', 'select count(*) from public.profiles'), '1');
select uji.cek('B14 kader tidak bisa membuka daftar akun (Kelola Akun)',
  uji.sebagai('kader', 'select * from public.list_accounts()'), 'error:%');
select uji.cek('B15 perawat bisa melihat daftar akun',
  uji.sebagai('perawat', 'select * from public.list_accounts()'), 'ok:9');

-- =============================================================================
-- C. Pasien
-- =============================================================================
insert into uji.data values
  ('P1', '10000000-0000-0000-0000-000000000001'),
  ('P2', '10000000-0000-0000-0000-000000000002');

select uji.cek('C1 kader mendaftarkan pasien',
  uji.sebagai('kader', format($q$insert into public.patients (id, full_name, birth_date, gender, dusun, rt)
    values (%L, 'Ny. S', '1967-03-10', 'P', 'Krajan', '02')$q$, uji.id('P1'))), 'ok:1');
select uji.cek('C2 perangkat desa tidak bisa menambah pasien',
  uji.sebagai('desa', $q$insert into public.patients (full_name, birth_date, gender, dusun, rt)
    values ('Tn. A', '1960-01-01', 'L', 'Krajan', '01')$q$), 'error:%');
select uji.cek('C3 pasien/keluarga tidak bisa menambah pasien',
  uji.sebagai('pasien', $q$insert into public.patients (full_name, birth_date, gender, dusun, rt)
    values ('Tn. A', '1960-01-01', 'L', 'Krajan', '01')$q$), 'error:%');
select uji.cek('C4 akun perawat yang belum disetujui tidak bisa menambah pasien',
  uji.sebagai('baru', $q$insert into public.patients (full_name, birth_date, gender, dusun, rt)
    values ('Tn. A', '1960-01-01', 'L', 'Krajan', '01')$q$), 'error:%');
select uji.cek('C5 pasien ganda ditolak (nama + tgl lahir + alamat sama)',
  uji.sebagai('perawat', $q$insert into public.patients (full_name, birth_date, gender, dusun, rt)
    values ('  ny. s ', '1967-03-10', 'P', 'KRAJAN', '02')$q$), 'error:%duplicate%');
select uji.cek('C6 perawat menambah pasien lain',
  uji.sebagai('perawat', format($q$insert into public.patients (id, full_name, birth_date, gender, dusun, rt, barriers)
    values (%L, 'Tn. B', '1958-07-01', 'L', 'Krajan', '03', '{transportasi}')$q$, uji.id('P2'))), 'ok:1');
select uji.cek('C7 kader menghubungkan akun keluarga ke Ny. S',
  uji.sebagai('kader', format('select public.link_patient_account(%L, %L)', uji.id('pasien'), uji.id('P1'))), 'ok:%');
select uji.cek('C8 akun petugas tidak bisa dihubungkan ke data pasien',
  uji.sebagai('kader', format('select public.link_patient_account(%L, %L)', uji.id('kader2'), uji.id('P1'))), 'error:%');
select uji.cek('C9 perangkat desa tidak bisa menghubungkan akun pasien',
  uji.sebagai('desa', format('select public.link_patient_account(%L, %L)', uji.id('pasien2'), uji.id('P2'))), 'error:%');
select uji.cek('C10 pasien hanya melihat 1 pasien (miliknya)',
  uji.nilai('pasien', 'select count(*) from public.patients'), '1');
select uji.cek('C11 akun pasien yang belum terhubung tidak melihat pasien',
  uji.nilai('pasien2', 'select count(*) from public.patients'), '0');
select uji.cek('C12 perangkat desa tidak membaca tabel pasien lengkap',
  uji.nilai('desa', 'select count(*) from public.patients'), '0');
select uji.cek('C13 perangkat desa melihat data ringkas semua pasien',
  uji.nilai('desa', 'select count(*) from public.patient_directory'), '2');
select uji.cek('C14 akun yang belum disetujui tidak melihat data pasien',
  uji.nilai('baru', 'select count(*) from public.patient_directory'), '0');
select uji.cek('C15 kader melihat semua pasien',
  uji.nilai('kader', 'select count(*) from public.patients'), '2');
select uji.cek('C16 pasien mengoreksi identitasnya sendiri',
  uji.sebagai('pasien', format('update public.patients set phone = %L, family_name = %L where id = %L', '0857', 'Tn. S', uji.id('P1'))), 'ok:1');
select uji.cek('C17 pasien tidak bisa mengubah status pasien',
  uji.sebagai('pasien', format('update public.patients set status = %L where id = %L', 'selesai', uji.id('P1'))), 'error:%');
select uji.cek('C18 pasien tidak bisa mengubah pasien lain',
  uji.sebagai('pasien', format('update public.patients set phone = %L where id = %L', '0', uji.id('P2'))), 'ok:0');
select uji.cek('C19 tanggal persetujuan terisi otomatis saat dicentang',
  uji.nilai('pasien', format('update public.patients set consent_program = true, consent_share = true where id = %L returning (consent_program_date is not null and consent_share_date is not null)::text', uji.id('P1'))), 'true');
select uji.cek('C20 kader tidak bisa mengarsipkan pasien',
  uji.sebagai('kader', format('update public.patients set archived_at = now() where id = %L', uji.id('P2'))), 'error:%');
select uji.cek('C21 perawat mengarsipkan pasien',
  uji.sebagai('perawat', format('update public.patients set archived_at = now() where id = %L', uji.id('P2'))), 'ok:1');
update public.patients set archived_at = null where id = uji.id('P2');
select uji.cek('C22 perawat tidak bisa menghapus permanen pasien',
  uji.sebagai('perawat', format('delete from public.patients where id = %L', uji.id('P2'))), 'ok:0');
select uji.cek('C23 view ringkas tidak bisa dipakai untuk mengubah data',
  uji.sebagai('desa', format('update public.patient_directory set full_name = %L where id = %L', 'X', uji.id('P1'))), 'error:%');
select uji.cek('C24 pengunjung tanpa login tidak bisa membaca pasien',
  uji.sebagai(null, 'select * from public.patients'), 'error:%');
select uji.cek('C25 pengunjung tanpa login tidak bisa membaca view ringkas',
  uji.sebagai(null, 'select * from public.patient_directory'), 'error:%');

-- =============================================================================
-- D. Sahabat Kaki
-- =============================================================================
insert into uji.data values ('C1', '20000000-0000-0000-0000-000000000001');
select uji.cek('D1 kader tidak bisa memasangkan pendamping',
  uji.sebagai('kader', format($q$insert into public.companions (patient_id, profile_id, name)
    values (%L, %L, 'Kader Ani')$q$, uji.id('P1'), uji.id('kader'))), 'error:%');
select uji.cek('D2 perawat memasangkan kader sebagai pendamping Ny. S',
  uji.sebagai('perawat', format($q$insert into public.companions (id, patient_id, profile_id, name, rt)
    values (%L, %L, %L, 'Kader Ani', '02')$q$, uji.id('C1'), uji.id('P1'), uji.id('kader'))), 'ok:1');
select uji.cek('D3 satu pasien hanya satu pendamping aktif',
  uji.sebagai('perawat', format($q$insert into public.companions (patient_id, profile_id, name)
    values (%L, %L, 'Kader Budi')$q$, uji.id('P1'), uji.id('kader2'))), 'error:%');
select uji.cek('D4 kader mencatat kunjungan pasien dampingannya',
  uji.sebagai('kader', format($q$insert into public.companion_visits (patient_id, companion_id, activity_type, complaints)
    values (%L, %L, 'kunjungan_rumah', 'Luka sedikit basah')$q$, uji.id('P1'), uji.id('C1'))), 'ok:1');
select uji.cek('D5 kader lain tidak bisa mencatat kunjungan pasien yang bukan dampingannya',
  uji.sebagai('kader2', format($q$insert into public.companion_visits (patient_id, companion_id, activity_type)
    values (%L, %L, 'telepon')$q$, uji.id('P1'), uji.id('C1'))), 'error:%');
select uji.cek('D6 kader tidak bisa memakai data pendamping untuk pasien lain',
  uji.sebagai('kader', format($q$insert into public.companion_visits (patient_id, companion_id, activity_type)
    values (%L, %L, 'telepon')$q$, uji.id('P2'), uji.id('C1'))), 'error:%');
select uji.cek('D7 "Lapor ke perawat" mengirim notifikasi ke perawat',
  uji.sebagai('kader', format($q$insert into public.companion_visits (patient_id, companion_id, activity_type, complaints, report_to_nurse, report_note)
    values (%L, %L, 'kunjungan_rumah', 'Kemerahan di sekitar luka', true, 'Kemerahan bertambah sejak 2 hari')$q$, uji.id('P1'), uji.id('C1'))), 'ok:1');
select uji.cek('D8 perawat menerima notifikasi laporan pendamping',
  (select count(*)::text from public.notifications where recipient_id = uji.id('perawat') and title = 'Laporan pendamping: Ny. S'), '1');
select uji.cek('D9 perangkat desa tidak membaca teks keluhan kunjungan',
  uji.nilai('desa', 'select count(*) from public.companion_visits'), '0');
select uji.cek('D10 perangkat desa melihat ringkasan kunjungan',
  uji.nilai('desa', 'select count(*) from public.companion_visit_summary'), '2');
select uji.cek('D11 pasien melihat kunjungan miliknya',
  uji.nilai('pasien', 'select count(*) from public.companion_visits'), '2');
select uji.cek('D12 akun pasien lain tidak melihat kunjungan Ny. S',
  uji.nilai('pasien2', 'select count(*) from public.companion_visits'), '0');

-- =============================================================================
-- E. Kartu Kaki Sehat + kode warna + SBAR
-- =============================================================================
insert into uji.data values
  ('K1', '30000000-0000-0000-0000-000000000001'),
  ('K2', '30000000-0000-0000-0000-000000000002');
delete from public.notifications;

select uji.cek('E1 kader mengirim Kartu Kaki Sehat',
  uji.sebagai('kader', format($q$insert into public.foot_visits (id, patient_id, reported_change, signs, observation_notes, status)
    values (%L, %L, 'memburuk', '{kemerahan,bengkak}', 'Luka di telapak kiri tampak merah', 'dikirim')$q$, uji.id('K1'), uji.id('P1'))), 'ok:1');
select uji.cek('E2 perawat menerima notifikasi Kartu Kaki Sehat baru',
  (select count(*)::text from public.notifications where recipient_id = uji.id('perawat') and title = 'Kartu Kaki Sehat baru: Ny. S'), '1');
select uji.cek('E3 nama pencatat terisi otomatis',
  (select recorder_name from public.foot_visits where id = uji.id('K1')), 'Kader Ani S.');
select uji.cek('E4 kader tidak bisa membuat kartu berstatus "Dinilai"',
  uji.sebagai('kader', format($q$insert into public.foot_visits (patient_id, status) values (%L, 'dinilai')$q$, uji.id('P1'))), 'error:%');
select uji.cek('E5 kader tidak bisa mengisi kode warna',
  uji.sebagai('kader', format($q$insert into public.assessments (foot_visit_id, patient_id, color_code)
    values (%L, %L, 'hijau')$q$, uji.id('K1'), uji.id('P1'))), 'error:%');
select uji.cek('E6 perangkat desa tidak bisa mengisi kode warna',
  uji.sebagai('desa', format($q$insert into public.assessments (foot_visit_id, patient_id, color_code)
    values (%L, %L, 'hijau')$q$, uji.id('K1'), uji.id('P1'))), 'error:%');
select uji.cek('E7 kader tidak bisa mengubah status kartu menjadi "Dinilai"',
  uji.sebagai('kader', format('update public.foot_visits set status = %L where id = %L', 'dinilai', uji.id('K1'))), 'error:%');
select uji.cek('E8 perawat memberi kode kuning + SBAR tanpa membuat pasien baru',
  uji.sebagai('perawat', format($q$insert into public.assessments (foot_visit_id, color_code, sbar_situation, sbar_background,
    sbar_assessment, sbar_recommendation, follow_up_instruction)
    values (%L, 'kuning', 'Luka kemerahan', 'DM tipe 2 12 th', 'Curiga infeksi ringan', 'Kontrol ke Pos Kaki',
    'Antar ke Pos Kaki Kamis ini, jaga luka tetap kering')$q$, uji.id('K1'))), 'ok:1');
select uji.cek('E9 jumlah pasien tetap 2 setelah penilaian',
  (select count(*)::text from public.patients), '2');
select uji.cek('E10 status kartu otomatis menjadi "Dinilai"',
  (select status from public.foot_visits where id = uji.id('K1')), 'dinilai');
select uji.cek('E11 kader menerima notifikasi kode warna + arahan',
  (select count(*)::text from public.notifications where recipient_id = uji.id('kader') and title = 'Kode Kuning untuk Ny. S'), '1');
select uji.cek('E12 catatan kader terkunci setelah dinilai',
  uji.sebagai('kader', format('update public.foot_visits set observation_notes = %L where id = %L', 'diubah', uji.id('K1'))), 'error:%');
select uji.cek('E13 penilaian perawat tidak menimpa catatan kader',
  (select observation_notes from public.foot_visits where id = uji.id('K1')), 'Luka di telapak kiri tampak merah');
select uji.cek('E14 kader menandai kartu "Ditindaklanjuti"',
  uji.sebagai('kader', format('update public.foot_visits set status = %L, follow_up_note = %L where id = %L',
    'ditindaklanjuti', 'Sudah diantar ke Pos Kaki', uji.id('K1'))), 'ok:1');
select uji.cek('E15 waktu tindak lanjut tercatat',
  (select (followed_up_at is not null and followed_up_by = uji.id('kader'))::text from public.foot_visits where id = uji.id('K1')), 'true');
select uji.cek('E16 perangkat desa tidak membaca catatan kartu',
  uji.nilai('desa', 'select count(*) from public.foot_visits'), '0');
select uji.cek('E17 perangkat desa tidak membaca SBAR',
  uji.nilai('desa', 'select count(*) from public.assessments'), '0');
select uji.cek('E18 perangkat desa melihat kode warna di ringkasan kartu',
  uji.nilai('desa', 'select color_code from public.foot_card_summary limit 1'), 'kuning');
select uji.cek('E19 pasien melihat penilaian miliknya',
  uji.nilai('pasien', 'select count(*) from public.assessments'), '1');
select uji.cek('E20 akun pasien lain tidak melihat penilaian Ny. S',
  uji.nilai('pasien2', 'select count(*) from public.assessments'), '0');
select uji.cek('E21 kader tidak bisa menghapus kartu yang sudah dinilai',
  uji.sebagai('kader', format('delete from public.foot_visits where id = %L', uji.id('K1'))), 'ok:0');
select uji.sebagai('kader', format($q$insert into public.foot_visits (id, patient_id, status) values (%L, %L, 'dikirim')$q$, uji.id('K2'), uji.id('P1')));
select uji.cek('E22 kode merah + rujukan mengubah status pasien menjadi "rujukan"',
  uji.sebagai('perawat', format($q$insert into public.assessments (foot_visit_id, color_code, referral, referral_to)
    values (%L, 'merah', true, 'RSUD')$q$, uji.id('K2'))), 'ok:1');
select uji.cek('E23 status pasien Ny. S = rujukan',
  (select status from public.patients where id = uji.id('P1')), 'rujukan');

-- =============================================================================
-- F. Pos Kaki, Ojek Sehat, Jimpitan, Pemberdayaan, Kuesioner, lain-lain
-- =============================================================================
insert into uji.data values
  ('AG1', '40000000-0000-0000-0000-000000000001'),
  ('DR1', '40000000-0000-0000-0000-000000000002'),
  ('RD1', '40000000-0000-0000-0000-000000000003'),
  ('AC1', '40000000-0000-0000-0000-000000000004');

select uji.cek('F1 kader membuat agenda Pos Kaki',
  uji.sebagai('kader', format($q$insert into public.agenda (id, title, event_date, location)
    values (%L, 'Pos Kaki Desember', '2026-12-03', 'Balai Desa')$q$, uji.id('AG1'))), 'ok:1');
select uji.cek('F2 perangkat desa tidak bisa membuat agenda Pos Kaki',
  uji.sebagai('desa', $q$insert into public.agenda (title, event_date, location) values ('X', '2026-12-03', 'X')$q$), 'error:%');
select uji.cek('F3 akun yang belum disetujui tetap melihat agenda (info umum)',
  uji.nilai('baru', 'select count(*) from public.agenda'), '1');
select uji.cek('F4 kader menambah driver Ojek Sehat',
  uji.sebagai('kader', format($q$insert into public.drivers (id, name, phone, vehicle_type)
    values (%L, 'Pak Joko', '081299', 'Motor')$q$, uji.id('DR1'))), 'ok:1');
select uji.cek('F5 akun yang belum disetujui tidak melihat data driver',
  uji.nilai('baru', 'select count(*) from public.drivers'), '0');
select uji.cek('F6 kader memesan Ojek Sehat',
  uji.sebagai('kader', format($q$insert into public.rides (id, patient_id, driver_id, agenda_id, pickup_from, destination, scheduled_at, estimated_cost)
    values (%L, %L, %L, %L, 'Rumah RT 02', 'pos_kaki', '2026-12-03 07:30+07', 15000)$q$,
    uji.id('RD1'), uji.id('P1'), uji.id('DR1'), uji.id('AG1'))), 'ok:1');
select uji.cek('F7 pasien tidak bisa memesan Ojek Sehat',
  uji.sebagai('pasien', format($q$insert into public.rides (patient_id, pickup_from, destination, scheduled_at)
    values (%L, 'Rumah', 'pos_kaki', now())$q$, uji.id('P1'))), 'error:%');
select uji.cek('F8 perangkat desa mencatat pengeluaran Jimpitan yang terkait ojek',
  uji.sebagai('desa', format($q$insert into public.funds (trx_type, category, amount, description, ride_id)
    values ('keluar', 'Ojek Sehat', 15000, 'Ojek Sehat ke Pos Kaki', %L)$q$, uji.id('RD1'))), 'ok:1');
select uji.cek('F9 satu pemesanan hanya bisa punya satu transaksi',
  uji.sebagai('kader', format($q$insert into public.funds (trx_type, category, amount, description, ride_id)
    values ('keluar', 'Ojek Sehat', 15000, 'dobel', %L)$q$, uji.id('RD1'))), 'error:%');
select uji.cek('F10 pemasukan tidak boleh dikaitkan ke ojek',
  uji.sebagai('kader', format($q$insert into public.funds (trx_type, category, amount, description, ride_id)
    values ('masuk', 'Donasi', 15000, 'salah', %L)$q$, uji.id('RD1'))), 'error:%');
select uji.sebagai('kader', $q$insert into public.funds (trx_type, category, amount, description)
  values ('masuk', 'Iuran sukarela warga', 100000, 'Iuran RT 02 November')$q$);
select uji.cek('F11 pasien tidak bisa mencatat Jimpitan',
  uji.sebagai('pasien', $q$insert into public.funds (trx_type, category, amount, description) values ('masuk', 'Donasi', 1, 'x')$q$), 'error:%');
select uji.cek('F12 pasien melihat transaksi Jimpitan (transparan)',
  uji.nilai('pasien', 'select count(*) from public.funds'), '2');
select uji.cek('F13 saldo Jimpitan terhitung benar di ringkasan',
  uji.nilai('pasien', $q$select public.dashboard_stats() ->> 'saldo_jimpitan'$q$), '85000');
select uji.cek('F14 ringkasan beranda menghitung pasien aktif (tanpa identitas)',
  uji.nilai('pasien2', $q$select public.dashboard_stats() ->> 'pasien_aktif'$q$), '2');
select uji.cek('F15 perangkat desa melihat kehadiran & pemesanan',
  uji.nilai('desa', 'select count(*) from public.rides'), '1');
select uji.cek('F16 perangkat desa membuat kegiatan pemberdayaan',
  uji.sebagai('desa', format($q$insert into public.activities (id, title, activity_type, activity_date)
    values (%L, 'Senam lansia ringan', 'senam_lansia', '2026-12-05')$q$, uji.id('AC1'))), 'ok:1');
select uji.cek('F17 pasien mendaftar ikut kegiatan',
  uji.sebagai('pasien', format($q$insert into public.activity_participants (activity_id, patient_id)
    values (%L, %L)$q$, uji.id('AC1'), uji.id('P1'))), 'ok:1');
select uji.cek('F18 pasien tidak bisa menandai dirinya hadir',
  uji.sebagai('pasien', format('update public.activity_participants set attended = true where activity_id = %L', uji.id('AC1'))), 'ok:0');
select uji.cek('F19 pasien tidak bisa mendaftarkan pasien lain',
  uji.sebagai('pasien', format($q$insert into public.activity_participants (activity_id, patient_id)
    values (%L, %L)$q$, uji.id('AC1'), uji.id('P2'))), 'error:%');
select uji.cek('F20 kader mencatat kehadiran kegiatan',
  uji.sebagai('kader', format('update public.activity_participants set attended = true where activity_id = %L', uji.id('AC1'))), 'ok:1');
select uji.cek('F21 perawat mengisi kuesioner',
  uji.sebagai('perawat', format($q$insert into public.questionnaires (patient_id, aspect, instrument, assessment_type, score)
    values (%L, 'dukungan_sosial', 'MSPSS', 'awal', 4.5)$q$, uji.id('P1'))), 'ok:1');
select uji.cek('F22 kader tidak bisa mengisi kuesioner',
  uji.sebagai('kader', format($q$insert into public.questionnaires (patient_id, aspect, instrument, assessment_type)
    values (%L, 'dukungan_sosial', 'MSPSS', 'awal')$q$, uji.id('P1'))), 'error:%');
select uji.cek('F23 kader tidak melihat jawaban kuesioner lengkap',
  uji.nilai('kader', 'select count(*) from public.questionnaires'), '0');
select uji.cek('F24 perangkat desa tidak melihat jawaban kuesioner lengkap',
  uji.nilai('desa', 'select count(*) from public.questionnaires'), '0');
select uji.cek('F25 pasien melihat skor kuesionernya sendiri',
  uji.nilai('pasien', 'select count(*) from public.questionnaires'), '1');
select uji.cek('F26 admin melihat kuesioner lengkap',
  uji.nilai('admin', 'select count(*) from public.questionnaires'), '1');
select uji.cek('F27 kader menulis pengumuman di Beranda',
  uji.sebagai('kader', $q$insert into public.articles (title, body, category) values ('Pos Kaki Kamis', 'Datang jam 8', 'pengumuman')$q$), 'ok:1');
select uji.cek('F28 pasien tidak bisa menulis pengumuman',
  uji.sebagai('pasien', $q$insert into public.articles (title, body, category) values ('x', 'x', 'pengumuman')$q$), 'error:%');
select uji.cek('F29 kader tidak bisa mengubah master data',
  uji.sebagai('kader', $q$insert into public.master_options (category, value) values ('dusun', 'Krajan')$q$), 'error:%');
select uji.cek('F30 perawat mengubah master data',
  uji.sebagai('perawat', $q$insert into public.master_options (category, value) values ('dusun', 'Krajan')$q$), 'ok:1');
select uji.cek('F31 pengguna tidak bisa membuat notifikasi sendiri',
  uji.sebagai('kader', format($q$insert into public.notifications (recipient_id, title) values (%L, 'palsu')$q$, uji.id('perawat'))), 'error:%');
select uji.cek('F32 pengguna tidak membaca notifikasi orang lain',
  uji.nilai('kader', format('select count(*) from public.notifications where recipient_id = %L', uji.id('perawat'))), '0');
select uji.cek('F33 pengguna menandai notifikasinya sudah dibaca',
  uji.sebagai('kader', 'update public.notifications set is_read = true where not is_read'), 'ok:2'); -- kode kuning (K1) + kode merah (K2)
select uji.cek('F34 pengguna tidak bisa memanggil fungsi pengirim notifikasi',
  uji.sebagai('kader', format($q$select public.notify_user(%L, 'x', 'x', '/')$q$, uji.id('perawat'))), 'error:%');
select uji.cek('F35 log aktivitas terisi otomatis dengan pelaku',
  (select count(*)::text from public.activity_logs where table_name = 'assessments' and actor_id = uji.id('perawat')), '2');
select uji.cek('F36 pasien hanya melihat log aktivitasnya sendiri',
  uji.nilai('pasien', format('select (count(*) = count(*) filter (where actor_id = %L))::text from public.activity_logs', uji.id('pasien'))), 'true');
select uji.cek('F37 pengguna tidak bisa menghapus log aktivitas',
  uji.sebagai('admin', 'delete from public.activity_logs'), 'error:%');
select uji.cek('F38 masuk dengan username: username diubah ke email',
  uji.nilai(null, $q$select public.get_login_email('KADER')$q$), 'kader@uji.id');
select uji.cek('F39 cek username saat daftar',
  uji.nilai(null, $q$select public.is_username_available('kader')::text$q$), 'false');
select uji.cek('F40 pengunjung tanpa login tidak bisa memanggil ringkasan',
  uji.sebagai(null, 'select public.dashboard_stats()'), 'error:%');

-- =============================================================================
-- G. Storage (bucket privat)
-- =============================================================================
insert into storage.objects (bucket_id, name) values
  ('wound-photos', '10000000-0000-0000-0000-000000000001/kunjungan/luka-1.jpg'),
  ('fund-proofs',  '2026-11/bukti-1.jpg');
select uji.cek('G1 kader membuka foto luka',
  uji.nilai('kader', $q$select count(*) from storage.objects where bucket_id = 'wound-photos'$q$), '1');
select uji.cek('G2 perangkat desa TIDAK bisa membuka foto luka',
  uji.nilai('desa', $q$select count(*) from storage.objects where bucket_id = 'wound-photos'$q$), '0');
select uji.cek('G3 pasien membuka foto luka miliknya',
  uji.nilai('pasien', $q$select count(*) from storage.objects where bucket_id = 'wound-photos'$q$), '1');
select uji.cek('G4 akun pasien lain tidak bisa membuka foto luka Ny. S',
  uji.nilai('pasien2', $q$select count(*) from storage.objects where bucket_id = 'wound-photos'$q$), '0');
select uji.cek('G5 pasien bisa mengunggah foto profil pasiennya',
  uji.sebagai('pasien', $q$insert into storage.objects (bucket_id, name)
    values ('wound-photos', '10000000-0000-0000-0000-000000000001/profil/foto.jpg')$q$), 'ok:1');
select uji.cek('G6 pasien tidak bisa mengunggah ke folder foto luka',
  uji.sebagai('pasien', $q$insert into storage.objects (bucket_id, name)
    values ('wound-photos', '10000000-0000-0000-0000-000000000001/kunjungan/x.jpg')$q$), 'error:%');
select uji.cek('G7 semua peran melihat bukti Jimpitan',
  uji.nilai('pasien2', $q$select count(*) from storage.objects where bucket_id = 'fund-proofs'$q$), '1');
select uji.cek('G8 pasien tidak bisa mengunggah bukti Jimpitan',
  uji.sebagai('pasien', $q$insert into storage.objects (bucket_id, name) values ('fund-proofs', '2026-11/x.jpg')$q$), 'error:%');
select uji.cek('G9 pengguna mengunggah foto profil ke foldernya sendiri',
  uji.sebagai('kader', format($q$insert into storage.objects (bucket_id, name) values ('avatars', '%s/foto.jpg')$q$, uji.id('kader'))), 'ok:1');
select uji.cek('G10 pengguna tidak bisa mengunggah ke folder foto profil orang lain',
  uji.sebagai('kader', format($q$insert into storage.objects (bucket_id, name) values ('avatars', '%s/foto.jpg')$q$, uji.id('perawat'))), 'error:%');

-- =============================================================================
-- H. Pemeriksaan menyeluruh
-- =============================================================================
select uji.cek('H1 RLS aktif di SEMUA tabel public',
  (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), '0');
select uji.cek('H2 jumlah tabel = 23',
  (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'), '23');
select uji.cek('H3 pengunjung tanpa login tidak punya hak di tabel mana pun',
  (select count(*)::text from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'), '0');
select uji.cek('H4 notifikasi masuk publikasi Realtime',
  (select count(*)::text from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications'), '1');
select uji.cek('H5 kunci server (service_role) bisa membaca tabel',
  uji.nilai('server', 'select count(*) from public.profiles'), '9');
select uji.cek('H6 kunci server bisa menulis tabel (untuk script akun demo)',
  uji.sebagai('server', $q$insert into public.patients (full_name, birth_date, gender, dusun, rt)
    values ('Tn. Server', '1950-01-01', 'L', 'Krajan', '09')$q$), 'ok:1');
select uji.cek('H7 kunci server bisa menjalankan fungsi',
  uji.sebagai('server', 'select public.dashboard_stats()'), 'ok:%');
select uji.cek('H8 pengguna login tetap bisa membaca view ringkas',
  uji.sebagai('desa', 'select * from public.patient_directory'), 'ok:%');

-- =============================================================================
-- I. Alur Fase 2 (Pasien, Sahabat Kaki, Kartu Kaki Sehat)
-- =============================================================================
insert into uji.data values ('K3', '30000000-0000-0000-0000-000000000003');
delete from public.notifications;
select uji.cek('I1 kader menyimpan kartu sebagai draft (belum ada notifikasi)',
  uji.sebagai('kader', format($q$insert into public.foot_visits (id, patient_id, reported_change, status)
    values (%L, %L, 'membaik', 'draft')$q$, uji.id('K3'), uji.id('P1'))), 'ok:1');
select uji.cek('I2 draft tidak mengirim notifikasi ke perawat',
  (select count(*)::text from public.notifications where recipient_id = uji.id('perawat')), '0');
select uji.cek('I3 kader mengubah catatan draft',
  uji.sebagai('kader', format('update public.foot_visits set observation_notes = %L where id = %L', 'luka mengering', uji.id('K3'))), 'ok:1');
select uji.cek('I4 kader mengirim draft ke perawat',
  uji.sebagai('kader', format('update public.foot_visits set status = %L where id = %L', 'dikirim', uji.id('K3'))), 'ok:1');
select uji.cek('I5 perawat menerima notifikasi saat draft dikirim',
  (select count(*)::text from public.notifications where recipient_id = uji.id('perawat') and link = '/kartu-kaki/' || uji.id('K3')), '1');
select uji.cek('I6 waktu kirim tercatat',
  (select (submitted_at is not null)::text from public.foot_visits where id = uji.id('K3')), 'true');
select uji.sebagai('perawat', format($q$insert into public.assessments (foot_visit_id, color_code, follow_up_instruction)
  values (%L, 'kuning', 'Kontrol Kamis')$q$, uji.id('K3')));
select uji.cek('I7 perawat mengubah kode warna -> kader diberi tahu lagi',
  uji.sebagai('perawat', format('update public.assessments set color_code = %L, follow_up_instruction = %L where foot_visit_id = %L',
    'hijau', 'Lanjut perawatan', uji.id('K3'))), 'ok:1');
select uji.cek('I8 kader menerima 2 notifikasi untuk kartu ini (kuning lalu hijau)',
  (select count(*)::text from public.notifications where recipient_id = uji.id('kader') and link = '/kartu-kaki/' || uji.id('K3')), '2');
select uji.cek('I9 perawat menonaktifkan pendamping lama',
  uji.sebagai('perawat', format('update public.companions set active = false, ended_at = current_date where id = %L', uji.id('C1'))), 'ok:1');
select uji.cek('I10 perawat memasangkan pendamping baru',
  uji.sebagai('perawat', format($q$insert into public.companions (patient_id, profile_id, name) values (%L, %L, 'Kader Budi')$q$,
    uji.id('P1'), uji.id('kader2'))), 'ok:1');
select uji.cek('I11 pendamping lama tidak bisa lagi mencatat kunjungan',
  uji.sebagai('kader', format($q$insert into public.companion_visits (patient_id, companion_id, activity_type)
    values (%L, %L, 'telepon')$q$, uji.id('P1'), uji.id('C1'))), 'error:%');
select uji.cek('I12 riwayat kunjungan pendamping lama tetap ada',
  (select (count(*) >= 2)::text from public.companion_visits where companion_id = uji.id('C1')), 'true');
select uji.cek('I13 kader memutus akun keluarga dari data pasien',
  uji.sebagai('kader', format('select public.link_patient_account(%L, null)', uji.id('pasien'))), 'ok:%');
select uji.cek('I14 setelah diputus, akun keluarga tidak melihat data pasien',
  uji.nilai('pasien', 'select count(*) from public.patients'), '0');
select uji.cek('I15 kader mengubah identitas pasien (Edit di matriks)',
  uji.sebagai('kader', format('update public.patients set phone = %L where id = %L', '0811', uji.id('P2'))), 'ok:1');
select uji.cek('I16 perangkat desa tidak bisa mengubah identitas pasien',
  uji.sebagai('desa', format('update public.patients set phone = %L where id = %L', '0', uji.id('P2'))), 'ok:0');

-- =============================================================================
-- J. Alur Fase 3 (Pos Kaki, Ojek Sehat, Jimpitan, Pemberdayaan)
-- =============================================================================
insert into uji.data values
  ('RD2', '50000000-0000-0000-0000-000000000002'),
  ('AT1', '50000000-0000-0000-0000-000000000003');
select uji.cek('J1 kader mencatat Ny. S di daftar hadir Pos Kaki',
  uji.sebagai('kader', format($q$insert into public.attendance (id, agenda_id, patient_id) values (%L, %L, %L)$q$, uji.id('AT1'), uji.id('AG1'), uji.id('P1'))), 'ok:1');
select uji.cek('J2 kader menandai hadir + tepat waktu + kaki diperiksa',
  uji.sebagai('kader', format('update public.attendance set present = true, on_time = true, foot_check_done = true where id = %L', uji.id('AT1'))), 'ok:1');
select uji.cek('J3 perangkat desa tidak bisa mengubah daftar hadir',
  uji.sebagai('desa', format('update public.attendance set present = false where id = %L', uji.id('AT1'))), 'ok:0');
select uji.cek('J4 perangkat desa melihat status kehadiran',
  uji.nilai('desa', format('select present::text from public.attendance where id = %L', uji.id('AT1'))), 'true');
select uji.cek('J5 kader memesan Ojek Sehat kedua',
  uji.sebagai('kader', format($q$insert into public.rides (id, patient_id, driver_id, pickup_from, destination, scheduled_at, estimated_cost)
    values (%L, %L, %L, 'Rumah', 'puskesmas', now(), 20000)$q$, uji.id('RD2'), uji.id('P2'), uji.id('DR1'))), 'ok:1');
select uji.cek('J6 kader menandai pemesanan selesai',
  uji.sebagai('kader', format('update public.rides set status = %L where id = %L', 'selesai', uji.id('RD2'))), 'ok:1');
select uji.cek('J7 perangkat desa tidak bisa mengubah status pemesanan',
  uji.sebagai('desa', format('update public.rides set status = %L where id = %L', 'batal', uji.id('RD2'))), 'ok:0');
select uji.cek('J8 GERBANG: biaya ride dicatat ke Jimpitan oleh kader',
  uji.sebagai('kader', format($q$insert into public.funds (trx_type, category, amount, description, ride_id)
    values ('keluar', 'Ojek Sehat', 20000, 'Ojek Sehat ke Puskesmas', %L)$q$, uji.id('RD2'))), 'ok:1');
select uji.cek('J9 GERBANG: saldo = 100.000 - 15.000 - 20.000 = 65.000',
  uji.nilai('desa', $q$select public.dashboard_stats() ->> 'saldo_jimpitan'$q$), '65000');
select uji.cek('J10 pasien hanya melihat pemesanan miliknya',
  uji.nilai('pasien', 'select count(*) from public.rides'), '0');
select uji.cek('J11 kader mencatat pelatihan kader',
  uji.sebagai('kader', format($q$insert into public.kader_trainings (training_date, title, topics, participant_ids, participant_names)
    values (current_date, 'Pelatihan KKS', '{pengisian_kks}', array[%L]::uuid[], '{"Bu Sri (PKK)"}')$q$, uji.id('kader'))), 'ok:1');
select uji.cek('J12 akun yang belum disetujui tidak melihat pelatihan',
  uji.nilai('baru', 'select count(*) from public.kader_trainings'), '0');
select uji.cek('J13 perangkat desa mencatat rapat Siaga Kaki',
  uji.sebagai('desa', $q$insert into public.coordination_meetings (meeting_date, minutes) values (current_date, 'Bahas Ojek Sehat')$q$), 'ok:1');
select uji.cek('J14 pasien tidak bisa mencatat rapat',
  uji.sebagai('pasien2', $q$insert into public.coordination_meetings (meeting_date) values (current_date)$q$), 'error:%');
select uji.cek('J15 perangkat desa menambah sumber daya desa (kebijakan)',
  uji.sebagai('desa', $q$insert into public.community_resources (resource_type, name, document_url) values ('kebijakan', 'SK Kepala Desa Siaga Kaki', 'https://contoh.id/sk.pdf')$q$), 'ok:1');
select uji.cek('J16 kader bisa menghapus agenda (Edit di matriks)',
  uji.sebagai('kader', format('delete from public.agenda where id = %L', uji.id('AG1'))), 'ok:1');

-- =============================================================================
-- Hasil
-- =============================================================================
\echo
\echo '================ HASIL UJI HAK AKSES ================'
select no, case when lulus then 'LULUS' else 'GAGAL' end as hasil, nama,
       case when lulus then '' else detail end as detail
from uji.hasil order by no;
select count(*) filter (where lulus) as lulus, count(*) filter (where not lulus) as gagal, count(*) as total
from uji.hasil;
do $$ begin
  if exists (select 1 from uji.hasil where not lulus) then
    raise exception 'Ada skenario uji yang GAGAL';
  end if;
end $$;
