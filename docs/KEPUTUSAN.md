# Keputusan Tambahan (melengkapi PRD)

PRD (`docs/PRD.md`) tetap sumber kebenaran. Dokumen ini mencatat jawaban atas hal yang
ambigu di PRD, disetujui pemilik proyek pada 25 November 2026.

## Hak akses

1. **Akun Perawat/Kader/Perangkat Desa yang belum disetujui Admin** bisa membuka semua
   menu, tetapi hanya melihat info umum: artikel/pengumuman, agenda Pos Kaki, saldo dan
   transaksi Jimpitan, direktori sumber daya desa, dan kegiatan. Data pasien dan data
   klinis tidak tampil sampai akun disetujui. Hal yang sama berlaku untuk akun
   Pasien/Keluarga yang belum dihubungkan ke data pasien.
2. **Admin boleh melihat jawaban kuesioner lengkap** (mengikuti matriks bagian 4).
3. **Perangkat Desa**:
   - Pasien: hanya data ringkas (nama, dusun, RT/RW, status) dan status kehadiran.
   - Kartu Kaki Sehat: melihat tanggal, status kartu, dan kode warna; tidak melihat
     catatan pengamatan kader, foto luka, maupun SBAR.
   - Sahabat Kaki: melihat pasangan pendamping serta tanggal dan jenis kunjungan, tanpa
     teks keluhan/dukungan.
   - Kuesioner: hanya rekap tanpa identitas (sama dengan Kader).
4. **Kartu Kaki Sehat**: catatan kader bisa diubah selama status masih *Draft* atau
   *Dikirim kader*. Setelah perawat memberi penilaian, catatan kader terkunci. Status
   *Ditindaklanjuti* bisa diisi Perawat atau Kader beserta waktunya (dipakai indikator 5).
5. **Hapus pasien** berarti arsipkan (DATA-03), dilakukan Perawat atau Admin. Hapus
   permanen hanya Admin.
6. **Pasien/Keluarga** bisa mengubah identitas dan centang persetujuan untuk pasien yang
   terhubung ke akunnya, tetapi tidak bisa mengubah status pasien (aktif/rujukan/selesai)
   maupun arsip.
7. **Log aktivitas**: Perawat, Kader, Perangkat Desa, dan Admin melihat semua log (hanya
   siapa, aksi, tabel, waktu; tanpa isi data). Pasien/Keluarga hanya melihat aktivitasnya
   sendiri.

## Akun

8. Masuk bisa memakai **username atau email**.
9. Pilihan peran saat Daftar: Perawat Puskesmas, Kader, Pasien/Keluarga, Perangkat Desa.
   Admin tidak bisa dipilih saat daftar; Admin pertama dibuat lewat script akun demo,
   lalu Admin bisa mengubah peran akun lain di Kelola Akun.
10. Sesi berakhir otomatis setelah **7 hari tidak aktif** (diatur di aplikasi, karena
    fitur bawaan Supabase untuk ini hanya ada di paket berbayar).

## Data

11. Tiga tabel pendukung ditambahkan di luar 20 tabel bagian 8:
    - `master_options`: dusun, RT, daftar Pos Kaki, kategori kondisi kaki, kategori
      transaksi Jimpitan (DATA-01).
    - `app_settings`: nama dan kontak Puskesmas, link grup WhatsApp Sahabat Kaki
      (KKS-01, POS-05).
    - `evaluation_notes`: catatan evaluasi dan rencana tindak lanjut per periode (EVA-04).
12. Instrumen kuesioner (Fase 4) masih menunggu keputusan kelompok. Usulan: WHOQOL-BREF
    (kualitas hidup), MSPSS (dukungan sosial), SDSCA (kemandirian/manajemen diri).

## Desain

13. Dipilih **Opsi B · Rose Lembut**:
    - Warna: latar `#FFF4F7`, permukaan `#FFFFFF`, rose lembut `#FCE4EB`, utama (berry)
      `#9C2457` dengan teks putih (kontras 7,5:1), teks `#3B1E2A`, teks sekunder `#6B4857`,
      garis `#F2D2DD`.
    - Font Nunito (400/600/700/800), disimpan di dalam proyek (tidak memuat dari Google).
    - Sudut membulat: kolom isian & tombol 22 px, kartu 28 px.
    - Teks minimal 16 px, tombol minimal 52 px, cincin fokus terlihat jelas.
    - Kode warna Kartu Kaki Sehat SELALU memakai ikon + tulisan + bingkai (tidak hanya
      warna): hijau `#166534/#DCFCE7`, kuning `#854D0E/#FEF9C3`, merah `#991B1B/#FEE2E2`.
    - Navigasi: bawah (5 tombol) di HP, sidebar di layar ≥ 1024 px.
