-- =============================================================================
-- Sahabat Kaki Desa — DATA CONTOH (fiktif) untuk roleplay & presentasi
--
-- Cara pakai: jalankan SETELAH migrasi 1–9, di Supabase SQL Editor (tempel semua, Run).
-- Lalu jalankan `npm run akun-demo` untuk membuat 5 akun & menghubungkannya ke data ini.
-- Aman dijalankan ulang: data dengan id yang sama dilewati.
-- Semua tanggal dihitung dari HARI INI supaya grafik Evaluasi selalu terisi.
-- SEMUA NAMA DAN DATA DI BAWAH INI FIKTIF.
-- =============================================================================

-- Pembantu: jawaban BWAT dengan total tertentu (13–65), dibagi rata ke 13 butir
create or replace function pg_temp.skd_bwat(t int) returns jsonb language sql as $$
  select jsonb_object_agg(k, (t / 13) + case when i <= t % 13 then 1 else 0 end)
  from unnest(array['ukuran', 'kedalaman', 'tepi', 'goa', 'jenis_nekrotik', 'jumlah_nekrotik', 'jenis_eksudat',
                    'jumlah_eksudat', 'warna_kulit', 'edema', 'indurasi', 'granulasi', 'epitelisasi']) with ordinality as u(k, i);
$$;
-- Pembantu: jawaban kuesioner seragam (n butir bernilai v)
create or replace function pg_temp.skd_jawab(n int, v int) returns jsonb language sql as $$
  select jsonb_object_agg('q' || g, v) from generate_series(1, n) g;
$$;

do $$
declare
  h  date := (now() at time zone 'Asia/Jakarta')::date;  -- hari ini (WIB)
  ns uuid := 'a1000000-0000-4000-8000-000000000001';     -- Ny. S
  tb uuid := 'a1000000-0000-4000-8000-000000000002';     -- Tn. B
  nr uuid := 'a1000000-0000-4000-8000-000000000003';     -- Ny. R
  tm uuid := 'a1000000-0000-4000-8000-000000000004';     -- Tn. M
begin
  -- ---------------------------------------------------------------- master & pengaturan
  insert into public.master_options (category, value, sort_order) values
    ('dusun', 'Krajan', 1), ('dusun', 'Sumbersari', 2),
    ('rt', '01', 1), ('rt', '02', 2), ('rt', '03', 3), ('rt', '04', 4),
    ('pos_kaki', 'Balai Desa', 1), ('pos_kaki', 'Posyandu Melati', 2)
  on conflict (category, value) do nothing;

  update public.app_settings set value = 'Desa Sukamaju' where key = 'nama_desa' and value is null;
  update public.app_settings set value = 'Puskesmas Sukamaju' where key = 'nama_puskesmas' and value is null;
  update public.app_settings set value = '081300000000' where key = 'telepon_puskesmas' and value is null;

  -- ---------------------------------------------------------------- pasien (fiktif)
  insert into public.patients (id, full_name, birth_date, gender, dusun, rt, rw, address_detail, phone,
    family_name, family_relation, family_phone, diabetes_since_year, medical_history, barriers, barrier_notes,
    consent_program, consent_program_date, consent_share, consent_share_date, status)
  values
    (ns, 'Ny. S', make_date(extract(year from h)::int - 59, 3, 10), 'P', 'Krajan', '02', '01', 'Gang Melati, rumah cat hijau',
     '081300000101', 'Tn. Slamet', 'Suami', '081300000102', extract(year from h)::int - 12,
     'Diabetes melitus tipe 2 selama 12 tahun. Luka di telapak kaki kiri sejak 3 bulan.',
     '{transportasi,ekonomi,dukungan_keluarga}',
     'Suami buruh harian; sulit ke Puskesmas; pasien merasa menjadi beban keluarga.',
     true, h - 92, true, h - 92, 'aktif'),
    (tb, 'Tn. B', make_date(extract(year from h)::int - 66, 7, 1), 'L', 'Krajan', '03', '01', 'Dekat musala Al-Ikhlas',
     '081300000201', 'Ny. W', 'Istri', '081300000202', extract(year from h)::int - 16,
     'Diabetes melitus tipe 2. Luka di jari kaki kanan.', '{transportasi}', 'Tinggal jauh dari jalan utama.',
     true, h - 90, true, h - 90, 'rujukan'),
    (nr, 'Ny. R', make_date(extract(year from h)::int - 61, 1, 20), 'P', 'Sumbersari', '01', '02', null,
     '081300000301', 'Sdr. A', 'Anak', '081300000302', extract(year from h)::int - 8,
     'Diabetes melitus tipe 2. Kulit kaki kering dan pecah-pecah, belum ada luka.', '{ekonomi}', null,
     true, h - 88, true, h - 88, 'aktif'),
    (tm, 'Tn. M', make_date(extract(year from h)::int - 63, 9, 5), 'L', 'Sumbersari', '04', '02', null,
     '081300000401', null, null, null, extract(year from h)::int - 10,
     'Diabetes melitus tipe 2. Kapalan di telapak kaki.', '{dukungan_keluarga}', 'Tinggal sendiri.',
     true, h - 85, true, h - 85, 'aktif')
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------- pendamping Sahabat Kaki
  -- profile_id diisi oleh script akun demo (mencocokkan nama kader "Ani Rahmawati")
  insert into public.companions (id, patient_id, name, companion_type, relation, phone, rt, paired_at) values
    ('a2000000-0000-4000-8000-000000000001', ns, 'Ani Rahmawati', 'kader', 'Tetangga satu RT', '081300000901', '02', h - 88),
    ('a2000000-0000-4000-8000-000000000002', tb, 'Ani Rahmawati', 'kader', 'Kader RT sebelah', '081300000901', '02', h - 86),
    ('a2000000-0000-4000-8000-000000000003', nr, 'Bu Sri Wahyuni', 'pkk', 'Anggota PKK satu RT', '081300000902', '01', h - 84),
    ('a2000000-0000-4000-8000-000000000004', tm, 'Bu Wati', 'pkk', 'Anggota PKK', '081300000903', '04', h - 80)
  on conflict (id) do nothing;

  -- Kunjungan mingguan (12 minggu Ny. S; Tn. B terlambat > 7 hari; Ny. R & Tn. M sebagian)
  insert into public.companion_visits (id, patient_id, companion_id, visit_date, activity_type, complaints, support_given, follow_up_plan, report_to_nurse, report_note)
  select ('a3000000-0000-4000-8000-' || lpad(g::text, 12, '0'))::uuid, ns, 'a2000000-0000-4000-8000-000000000001',
         h - (g * 7 - 2),
         case when g % 4 = 0 then 'telepon' when g % 5 = 0 then 'menemani_kontrol' else 'kunjungan_rumah' end,
         case when g = 1 then 'Luka tampak sedikit merah, nyeri saat berjalan' when g in (5, 9) then 'Kaki terasa kesemutan' end,
         'Mengingatkan minum obat, membantu memeriksa kaki, menyemangati pasien',
         'Kunjungan minggu depan',
         g = 1, case when g = 1 then 'Mohon dinilai, kemerahan bertambah sejak 2 hari.' end
  from generate_series(1, 12) g
  on conflict (id) do nothing;

  insert into public.companion_visits (id, patient_id, companion_id, visit_date, activity_type, complaints, support_given)
  select ('a3000000-0000-4000-8000-' || lpad((100 + g)::text, 12, '0'))::uuid, tb, 'a2000000-0000-4000-8000-000000000002',
         h - (g * 7 + 5), 'kunjungan_rumah', case when g = 2 then 'Jari kaki kanan bengkak dan berbau' end, 'Edukasi perawatan luka'
  from generate_series(1, 6) g
  on conflict (id) do nothing;

  insert into public.companion_visits (id, patient_id, companion_id, visit_date, activity_type, support_given)
  select ('a3000000-0000-4000-8000-' || lpad((200 + g)::text, 12, '0'))::uuid,
         case when g % 2 = 0 then nr else tm end,
         case when g % 2 = 0 then 'a2000000-0000-4000-8000-000000000003'::uuid else 'a2000000-0000-4000-8000-000000000004'::uuid end,
         h - (g * 9), 'kunjungan_rumah', 'Edukasi cuci kaki dan memilih alas kaki'
  from generate_series(1, 8) g
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------- Kartu Kaki Sehat + penilaian (BWAT)
  if not exists (select 1 from public.foot_visits where id = 'a4000000-0000-4000-8000-000000000001') then
    insert into public.foot_visits (id, patient_id, visit_date, recorder_name, reported_change, signs, foot_condition, observation_notes, status, submitted_at) values
      ('a4000000-0000-4000-8000-000000000001', ns, h - 60, 'Ani Rahmawati', 'memburuk', '{kemerahan,bengkak}', 'Luka ringan', 'Luka di telapak kiri kemerahan, keluar sedikit cairan.', 'dikirim', (h - 60) + time '09:00'),
      ('a4000000-0000-4000-8000-000000000002', ns, h - 30, 'Ani Rahmawati', 'membaik', '{kemerahan}', 'Luka ringan', 'Kemerahan berkurang, luka lebih kering.', 'dikirim', (h - 30) + time '09:00'),
      ('a4000000-0000-4000-8000-000000000003', ns, h - 2, 'Ani Rahmawati', 'memburuk', '{kemerahan,nyeri}', 'Luka ringan', 'Luka tampak lebih merah, pasien nyeri saat berjalan.', 'dikirim', (h - 2) + time '10:00'),
      ('a4000000-0000-4000-8000-000000000004', tb, h - 20, 'Ani Rahmawati', 'memburuk', '{bengkak,demam,bau}', 'Luka dalam/bernanah', 'Jari kaki kanan bengkak, bernanah, berbau; pasien demam.', 'dikirim', (h - 20) + time '08:00'),
      ('a4000000-0000-4000-8000-000000000005', tb, h - 1, 'Ani Rahmawati', 'membaik', '{bengkak}', 'Luka ringan', 'Setelah dirujuk, bengkak berkurang.', 'dikirim', (h - 1) + time '15:00'),
      ('a4000000-0000-4000-8000-000000000006', nr, h - 10, 'Bu Sri Wahyuni', 'tidak_ada', '{}', 'Kulit kering/pecah-pecah', 'Tumit pecah-pecah, tidak ada luka.', 'dikirim', (h - 10) + time '09:00'),
      ('a4000000-0000-4000-8000-000000000007', tm, h - 15, 'Bu Wati', 'tidak_ada', '{}', 'Kapalan/mata ikan', 'Kapalan di telapak kanan, tidak ada luka.', 'dikirim', (h - 15) + time '09:00');

    insert into public.assessments (foot_visit_id, color_code, has_wound, bwat_answers, sbar_situation, sbar_background, sbar_assessment, sbar_recommendation,
      follow_up_instruction, referral, referral_to, activity_recommendation, next_control_date, wound_care_schedule, assessed_at) values
      ('a4000000-0000-4000-8000-000000000001', 'kuning', true, pg_temp.skd_bwat(32), 'Luka telapak kiri kemerahan, eksudat sedikit',
       'DM tipe 2 selama 12 tahun, luka 2 bulan', 'Skor BWAT 32, luka sedang', 'Kontrol di Pos Kaki', 'Antar ke Pos Kaki bulan ini, jaga luka tetap kering.',
       false, null, 'Boleh senam lansia sambil duduk, hindari beban pada kaki kiri.', h - 45, 'Ganti balutan tiap 2 hari', (h - 59) + time '10:00'),
      ('a4000000-0000-4000-8000-000000000002', 'kuning', true, pg_temp.skd_bwat(27), 'Kemerahan berkurang', 'DM tipe 2, luka membaik',
       'Skor BWAT 27, membaik', 'Lanjut perawatan luka', 'Lanjutkan perawatan, kontrol di Pos Kaki berikutnya.',
       false, null, 'Boleh senam lansia sambil duduk, hindari beban pada kaki kiri.', h - 12, 'Ganti balutan tiap 2 hari', (h - 29) + time '11:00'),
      ('a4000000-0000-4000-8000-000000000003', 'kuning', true, pg_temp.skd_bwat(30), 'Luka kembali kemerahan dan nyeri', 'DM tipe 2 selama 12 tahun, luka 3 bulan',
       'Skor BWAT 30, curiga infeksi ringan', 'Periksa di Pos Kaki minggu ini', 'Antar ke Pos Kaki dengan Ojek Sehat. Jaga luka tetap kering dan bersih.',
       false, null, 'Boleh senam lansia sambil duduk, hindari beban pada kaki kiri.', h + 7, 'Ganti balutan tiap 2 hari', (h - 1) + time '09:00'),
      ('a4000000-0000-4000-8000-000000000004', 'merah', true, pg_temp.skd_bwat(46), 'Jari kaki kanan bernanah, berbau, demam', 'DM tipe 2 sejak 16 tahun',
       'Skor BWAT 46, infeksi berat', 'Rujuk segera', 'Segera ke Puskesmas hari ini dengan Ojek Sehat.',
       true, 'Puskesmas induk', 'Istirahatkan kaki kanan sampai dinilai dokter.', h - 13, 'Perawatan luka di Puskesmas', (h - 20) + time '10:00'),
      ('a4000000-0000-4000-8000-000000000006', 'hijau', false, null, 'Kulit tumit kering, tidak ada luka', 'DM tipe 2 sejak 8 tahun',
       'Tidak ada luka terbuka', 'Edukasi pelembap', 'Oleskan pelembap di telapak (tidak di sela jari) setiap hari.',
       false, null, 'Boleh ikut senam lansia.', h + 20, null, (h - 9) + time '09:00'),
      ('a4000000-0000-4000-8000-000000000007', 'hijau', false, null, 'Kapalan di telapak kanan', 'DM tipe 2 sejak 10 tahun',
       'Tidak ada luka terbuka', 'Jangan potong kapalan sendiri', 'Pakai alas kaki empuk; kapalan diperiksa perawat saat Pos Kaki.',
       false, null, 'Boleh ikut senam lansia dan jalan pagi.', h + 15, null, (h - 14) + time '09:00');

    -- Tindak lanjut (indikator 5)
    update public.foot_visits set status = 'ditindaklanjuti', followed_up_at = (h - 58) + time '08:00', follow_up_note = 'Diantar ke Pos Kaki, luka dibersihkan perawat.' where id = 'a4000000-0000-4000-8000-000000000001';
    update public.foot_visits set status = 'ditindaklanjuti', followed_up_at = (h - 28) + time '09:00', follow_up_note = 'Perawatan luka dilanjutkan keluarga.' where id = 'a4000000-0000-4000-8000-000000000002';
    update public.foot_visits set status = 'ditindaklanjuti', followed_up_at = (h - 20) + time '13:00', follow_up_note = 'Diantar Ojek Sehat ke Puskesmas induk hari itu juga.' where id = 'a4000000-0000-4000-8000-000000000004';
    update public.foot_visits set status = 'ditindaklanjuti', followed_up_at = (h - 8) + time '09:00', follow_up_note = 'Sudah diberi contoh memakai pelembap.' where id = 'a4000000-0000-4000-8000-000000000006';
  end if;

  -- ---------------------------------------------------------------- Pos Kaki, Ojek Sehat
  insert into public.agenda (id, title, agenda_type, event_date, start_time, end_time, location, person_in_charge, nurse_visit, quota, notes) values
    ('a6000000-0000-4000-8000-000000000001', 'Pos Kaki bersama Posbindu PTM', 'pos_kaki', h - 56, '08:00', '11:00', 'Balai Desa', 'Ani Rahmawati', true, 30, 'Pemeriksaan kaki, gula darah, edukasi'),
    ('a6000000-0000-4000-8000-000000000002', 'Pos Kaki bersama Posbindu PTM', 'pos_kaki', h - 26, '08:00', '11:00', 'Balai Desa', 'Ani Rahmawati', true, 30, 'Pemeriksaan kaki, gula darah, edukasi'),
    ('a6000000-0000-4000-8000-000000000003', 'Pos Kaki bersama Posbindu PTM', 'pos_kaki', h + 5, '08:00', '11:00', 'Balai Desa', 'Ani Rahmawati', true, 30, 'Bawa Kartu Kaki Sehat')
  on conflict (id) do nothing;

  insert into public.attendance (id, agenda_id, patient_id, present, on_time, foot_check_done, education_given) values
    ('a7000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', ns, true, true, true, 'Cara mencuci dan merawat kaki'),
    ('a7000000-0000-4000-8000-000000000002', 'a6000000-0000-4000-8000-000000000001', tb, true, false, true, 'Tanda bahaya luka'),
    ('a7000000-0000-4000-8000-000000000003', 'a6000000-0000-4000-8000-000000000001', nr, false, null, false, null),
    ('a7000000-0000-4000-8000-000000000004', 'a6000000-0000-4000-8000-000000000001', tm, true, true, true, 'Memilih alas kaki'),
    ('a7000000-0000-4000-8000-000000000005', 'a6000000-0000-4000-8000-000000000002', ns, true, true, true, 'Memilih alas kaki'),
    ('a7000000-0000-4000-8000-000000000006', 'a6000000-0000-4000-8000-000000000002', nr, true, true, true, 'Pelembap kaki'),
    ('a7000000-0000-4000-8000-000000000007', 'a6000000-0000-4000-8000-000000000002', tm, true, true, true, 'Kapalan jangan dipotong sendiri'),
    ('a7000000-0000-4000-8000-000000000008', 'a6000000-0000-4000-8000-000000000003', ns, null, null, false, null),
    ('a7000000-0000-4000-8000-000000000009', 'a6000000-0000-4000-8000-000000000003', tb, null, null, false, null)
  on conflict (id) do nothing;

  insert into public.drivers (id, name, phone, vehicle_type, service_area, payment_type, active) values
    ('a8000000-0000-4000-8000-000000000001', 'Pak Joko', '081300000801', 'Motor', 'Dusun Krajan', 'relawan', true),
    ('a8000000-0000-4000-8000-000000000002', 'Mas Andi', '081300000802', 'Mobil bak', 'Semua dusun', 'berbayar', true)
  on conflict (id) do nothing;

  insert into public.rides (id, patient_id, driver_id, agenda_id, pickup_from, destination, destination_detail, scheduled_at, estimated_cost, status) values
    ('a9000000-0000-4000-8000-000000000001', ns, 'a8000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000001', 'Rumah, Gang Melati RT 02', 'pos_kaki', 'Balai Desa', ((h - 56) + time '07:30') at time zone 'Asia/Jakarta', 15000, 'selesai'),
    ('a9000000-0000-4000-8000-000000000002', tb, 'a8000000-0000-4000-8000-000000000002', null, 'Rumah RT 03', 'puskesmas', 'Puskesmas induk (rujukan)', ((h - 20) + time '11:00') at time zone 'Asia/Jakarta', 25000, 'selesai'),
    ('a9000000-0000-4000-8000-000000000003', ns, 'a8000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000002', 'Rumah, Gang Melati RT 02', 'pos_kaki', 'Balai Desa', ((h - 26) + time '07:30') at time zone 'Asia/Jakarta', 15000, 'selesai'),
    ('a9000000-0000-4000-8000-000000000004', ns, 'a8000000-0000-4000-8000-000000000001', 'a6000000-0000-4000-8000-000000000003', 'Rumah, Gang Melati RT 02', 'pos_kaki', 'Balai Desa', ((h + 5) + time '07:30') at time zone 'Asia/Jakarta', 15000, 'dipesan')
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------- Jimpitan Sehat
  insert into public.funds (id, trx_type, category, amount, trx_date, description, ride_id) values
    ('aa000000-0000-4000-8000-000000000001', 'masuk', 'Iuran sukarela warga', 250000, h - 80, 'Iuran jimpitan warga RT 01–04', null),
    ('aa000000-0000-4000-8000-000000000002', 'masuk', 'APBDes', 500000, h - 75, 'Dukungan APBDes untuk Pos Kaki & Ojek Sehat', null),
    ('aa000000-0000-4000-8000-000000000003', 'keluar', 'Pelatihan kader', 150000, h - 70, 'Konsumsi & fotokopi pelatihan kader', null),
    ('aa000000-0000-4000-8000-000000000004', 'keluar', 'Ojek Sehat', 15000, h - 56, 'Ojek Sehat ke Pos Kaki', 'a9000000-0000-4000-8000-000000000001'),
    ('aa000000-0000-4000-8000-000000000005', 'keluar', 'Operasional Pos Kaki', 40000, h - 56, 'Kapas, alkohol, air minum Pos Kaki', null),
    ('aa000000-0000-4000-8000-000000000006', 'masuk', 'Iuran sukarela warga', 230000, h - 50, 'Iuran jimpitan warga RT 01–04', null),
    ('aa000000-0000-4000-8000-000000000007', 'masuk', 'Donasi', 100000, h - 35, 'Donasi warga untuk Ojek Sehat', null),
    ('aa000000-0000-4000-8000-000000000008', 'keluar', 'Ojek Sehat', 15000, h - 26, 'Ojek Sehat ke Pos Kaki', 'a9000000-0000-4000-8000-000000000003'),
    ('aa000000-0000-4000-8000-000000000009', 'keluar', 'Operasional Pos Kaki', 35000, h - 26, 'Kapas dan air minum Pos Kaki', null),
    ('aa000000-0000-4000-8000-000000000010', 'keluar', 'Ojek Sehat', 25000, h - 20, 'Ojek Sehat rujukan ke Puskesmas', 'a9000000-0000-4000-8000-000000000002'),
    ('aa000000-0000-4000-8000-000000000011', 'masuk', 'Iuran sukarela warga', 240000, h - 20, 'Iuran jimpitan warga RT 01–04', null)
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------- Pemberdayaan
  insert into public.community_resources (id, resource_type, name, description, schedule, location, contact) values
    ('ab000000-0000-4000-8000-000000000001', 'posbindu_ptm', 'Posbindu PTM Desa Sukamaju', 'Cek gula darah, tekanan darah, berat badan', 'Bulanan, bersama Pos Kaki', 'Balai Desa', '081300000501'),
    ('ab000000-0000-4000-8000-000000000002', 'pkk', 'PKK Dusun Krajan', 'Kunjungan rumah: dukungan emosional & edukasi makanan', 'Setiap minggu', 'Dusun Krajan', '081300000902'),
    ('ab000000-0000-4000-8000-000000000003', 'senam_lansia', 'Komunitas Senam Lansia "Sehat Bahagia"', 'Senam lansia; tersedia gerakan duduk untuk pasien luka kaki', 'Sabtu 06.30', 'Lapangan desa', '081300000503'),
    ('ab000000-0000-4000-8000-000000000004', 'puskesmas', 'Puskesmas Sukamaju', 'Perawatan luka, rujukan, obat diabetes', 'Senin–Sabtu 07.30–14.00', 'Jl. Raya Sukamaju', '081300000000'),
    ('ab000000-0000-4000-8000-000000000005', 'sumber_dana', 'JKN & APBDes', 'JKN untuk pengobatan; APBDes untuk Jimpitan Sehat', null, 'Kantor Desa', null),
    ('ab000000-0000-4000-8000-000000000006', 'duta_kaki_sehat', 'Duta Kaki Sehat: Ibu Darmi', 'Penyintas luka kaki diabetes yang kini aktif senam dan berbagi pengalaman', null, 'Dusun Sumbersari', null),
    ('ab000000-0000-4000-8000-000000000007', 'kebijakan', 'SK Kepala Desa tentang Tim Siaga Kaki', 'Pembagian tugas perawat, kader, PKK, perangkat desa; pengelolaan dana; kerahasiaan data pasien', null, 'Kantor Desa', null)
  on conflict (id) do nothing;

  insert into public.activities (id, resource_id, title, activity_type, activity_date, start_time, location, person_in_charge, description) values
    ('ac000000-0000-4000-8000-000000000001', 'ab000000-0000-4000-8000-000000000003', 'Senam lansia duduk', 'senam_lansia', h - 49, '06:30', 'Lapangan desa', 'Bu Sri Wahyuni', 'Gerakan duduk, aman untuk pasien luka kaki.'),
    ('ac000000-0000-4000-8000-000000000002', 'ab000000-0000-4000-8000-000000000002', 'Kelompok dukungan keluarga', 'kelompok_dukungan', h - 33, '15:00', 'Rumah Bu RT 02', 'PKK Dusun Krajan', 'Berbagi pengalaman merawat anggota keluarga dengan diabetes.'),
    ('ac000000-0000-4000-8000-000000000003', 'ab000000-0000-4000-8000-000000000003', 'Senam lansia duduk', 'senam_lansia', h - 7, '06:30', 'Lapangan desa', 'Bu Sri Wahyuni', 'Gerakan duduk, aman untuk pasien luka kaki.'),
    ('ac000000-0000-4000-8000-000000000004', null, 'Edukasi anti-stigma: luka kaki bukan aib', 'edukasi_anti_stigma', h - 15, '19:30', 'Musala Al-Ikhlas', 'Kader & tokoh masyarakat', 'Bersama Duta Kaki Sehat Ibu Darmi.'),
    ('ac000000-0000-4000-8000-000000000005', 'ab000000-0000-4000-8000-000000000003', 'Senam lansia duduk', 'senam_lansia', h + 4, '06:30', 'Lapangan desa', 'Bu Sri Wahyuni', 'Gerakan duduk, aman untuk pasien luka kaki.')
  on conflict (id) do nothing;

  insert into public.activity_participants (id, activity_id, patient_id, participant_name, attended) values
    ('ad000000-0000-4000-8000-000000000001', 'ac000000-0000-4000-8000-000000000001', ns, null, true),
    ('ad000000-0000-4000-8000-000000000002', 'ac000000-0000-4000-8000-000000000001', tm, null, true),
    ('ad000000-0000-4000-8000-000000000003', 'ac000000-0000-4000-8000-000000000002', ns, null, true),
    ('ad000000-0000-4000-8000-000000000004', 'ac000000-0000-4000-8000-000000000002', null, 'Tn. Slamet (keluarga)', true),
    ('ad000000-0000-4000-8000-000000000005', 'ac000000-0000-4000-8000-000000000003', ns, null, true),
    ('ad000000-0000-4000-8000-000000000006', 'ac000000-0000-4000-8000-000000000003', nr, null, true),
    ('ad000000-0000-4000-8000-000000000007', 'ac000000-0000-4000-8000-000000000004', null, 'Warga RT 02 (12 orang)', true),
    ('ad000000-0000-4000-8000-000000000008', 'ac000000-0000-4000-8000-000000000005', ns, null, null)
  on conflict (id) do nothing;

  insert into public.kader_trainings (id, training_date, title, topics, trainer, location, participant_names, substitute_kaders) values
    ('ae000000-0000-4000-8000-000000000001', h - 70, 'Pelatihan Kartu Kaki Sehat & tanda bahaya luka', '{tanda_bahaya_luka,pengisian_kks,mekanisme_pelaporan}',
     'Perawat Puskesmas', 'Puskesmas Sukamaju', '{"Ani Rahmawati","Bu Sri Wahyuni","Bu Wati"}', 'Bu Yanti (RT 03)')
  on conflict (id) do nothing;

  insert into public.coordination_meetings (id, meeting_date, title, location, attendees, minutes, decisions) values
    ('af000000-0000-4000-8000-000000000001', h - 62, 'Rapat Siaga Kaki', 'Kantor Desa', 'Perawat Puskesmas, 3 kader/PKK, Sekretaris Desa',
     'Pembentukan Tim Siaga Kaki, pembagian pendamping per RT, rencana Jimpitan Sehat.', 'Jimpitan dimulai bulan ini; APBDes mendukung Ojek Sehat.'),
    ('af000000-0000-4000-8000-000000000002', h - 30, 'Rapat Siaga Kaki', 'Kantor Desa', 'Perawat Puskesmas, 3 kader/PKK, Kepala Desa',
     'Evaluasi kunjungan mingguan; satu pasien dirujuk dengan kode merah.', 'Tambah satu driver Ojek Sehat; jadwal senam lansia duduk tiap Sabtu.')
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------- Kuesioner awal & ulang (indikator 9)
  -- Skor sesuai rumus aplikasi: WHOQOL-BREF (semua 3 = 50,0; semua 4 = 69,4),
  -- MSPSS (rata-rata), SDSCA (semua 3 = 3,09; semua 4 = 3,91; semua 5 = 4,73)
  insert into public.questionnaires (id, patient_id, aspect, instrument, assessment_type, assessed_on, answers, score) values
    ('b0000000-0000-4000-8000-000000000001', ns, 'kualitas_hidup', 'WHOQOL-BREF', 'awal', h - 90, pg_temp.skd_jawab(26, 3), 50.0),
    ('b0000000-0000-4000-8000-000000000002', ns, 'dukungan_sosial', 'MSPSS', 'awal', h - 90, pg_temp.skd_jawab(12, 3), 3.00),
    ('b0000000-0000-4000-8000-000000000003', ns, 'kemandirian', 'SDSCA', 'awal', h - 90, pg_temp.skd_jawab(11, 3), 3.09),
    ('b0000000-0000-4000-8000-000000000004', ns, 'kualitas_hidup', 'WHOQOL-BREF', 'ulang', h - 3, pg_temp.skd_jawab(26, 4), 69.4),
    ('b0000000-0000-4000-8000-000000000005', ns, 'dukungan_sosial', 'MSPSS', 'ulang', h - 3, pg_temp.skd_jawab(12, 5), 5.00),
    ('b0000000-0000-4000-8000-000000000006', ns, 'kemandirian', 'SDSCA', 'ulang', h - 3, pg_temp.skd_jawab(11, 5), 4.73),
    ('b0000000-0000-4000-8000-000000000007', tb, 'kualitas_hidup', 'WHOQOL-BREF', 'awal', h - 88, pg_temp.skd_jawab(26, 3), 50.0),
    ('b0000000-0000-4000-8000-000000000008', tb, 'dukungan_sosial', 'MSPSS', 'awal', h - 88, pg_temp.skd_jawab(12, 4), 4.00),
    ('b0000000-0000-4000-8000-000000000009', tb, 'kemandirian', 'SDSCA', 'awal', h - 88, pg_temp.skd_jawab(11, 3), 3.09),
    ('b0000000-0000-4000-8000-000000000010', tb, 'kualitas_hidup', 'WHOQOL-BREF', 'ulang', h - 4, pg_temp.skd_jawab(26, 3), 50.0),
    ('b0000000-0000-4000-8000-000000000011', tb, 'dukungan_sosial', 'MSPSS', 'ulang', h - 4, pg_temp.skd_jawab(12, 5), 5.00),
    ('b0000000-0000-4000-8000-000000000012', tb, 'kemandirian', 'SDSCA', 'ulang', h - 4, pg_temp.skd_jawab(11, 4), 3.91),
    ('b0000000-0000-4000-8000-000000000013', nr, 'kualitas_hidup', 'WHOQOL-BREF', 'awal', h - 86, pg_temp.skd_jawab(26, 4), 69.4),
    ('b0000000-0000-4000-8000-000000000014', nr, 'dukungan_sosial', 'MSPSS', 'awal', h - 86, pg_temp.skd_jawab(12, 5), 5.00),
    ('b0000000-0000-4000-8000-000000000015', nr, 'kemandirian', 'SDSCA', 'awal', h - 86, pg_temp.skd_jawab(11, 4), 3.91),
    ('b0000000-0000-4000-8000-000000000016', nr, 'kualitas_hidup', 'WHOQOL-BREF', 'ulang', h - 5, pg_temp.skd_jawab(26, 4), 69.4),
    ('b0000000-0000-4000-8000-000000000017', nr, 'dukungan_sosial', 'MSPSS', 'ulang', h - 5, pg_temp.skd_jawab(12, 6), 6.00),
    ('b0000000-0000-4000-8000-000000000018', nr, 'kemandirian', 'SDSCA', 'ulang', h - 5, pg_temp.skd_jawab(11, 5), 4.73)
  on conflict (id) do nothing;

  -- ---------------------------------------------------------------- Beranda & evaluasi
  insert into public.articles (id, title, category, body, pinned) values
    ('b1000000-0000-4000-8000-000000000001', 'Pos Kaki bulan ini di Balai Desa', 'pengumuman',
     'Pos Kaki bersama Posbindu PTM dibuka pukul 08.00–11.00 di Balai Desa. Bawa Kartu Kaki Sehat. Pasien yang kesulitan transportasi bisa memesan Ojek Sehat lewat kader RT.', true),
    ('b1000000-0000-4000-8000-000000000002', 'Kenalan dengan Duta Kaki Sehat: Ibu Darmi', 'duta_kaki_sehat',
     'Ibu Darmi pernah mengalami luka kaki diabetes. Dengan perawatan rutin dan dukungan keluarga, lukanya sembuh. Kini beliau aktif senam lansia dan mengajak warga untuk tidak menjauhi pasien luka kaki.', false)
  on conflict (id) do nothing;

  insert into public.evaluation_notes (id, period_month, notes, follow_up_plan) values
    ('b2000000-0000-4000-8000-000000000001', date_trunc('month', h - 30)::date,
     'Kunjungan mingguan pendamping berjalan baik untuk Ny. S. Kunjungan ke Tn. B sering terlambat karena jarak rumah.',
     'Tambah pendamping cadangan untuk RT 03; jadwalkan Ojek Sehat rutin untuk Tn. B.')
  on conflict (id) do nothing;
end;
$$;
