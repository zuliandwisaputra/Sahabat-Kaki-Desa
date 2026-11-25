# Sahabat Kaki Desa

Website kolaborasi perawatan kaki pasien di tingkat desa untuk Perawat Puskesmas, Kader,
Pasien/Keluarga, Perangkat Desa, dan Admin. Website ini dibuka lewat browser (Chrome) di
HP maupun laptop, jadi tidak perlu dipasang dari Play Store. Tampilannya dirancang
mobile-first, sehingga terasa seperti aplikasi saat dibuka di HP.

- Kebutuhan produk: [`docs/PRD.md`](docs/PRD.md)
- Keputusan tambahan (hal yang ambigu di PRD, pilihan desain): [`docs/KEPUTUSAN.md`](docs/KEPUTUSAN.md)

**Teknologi:** React + Vite + Tailwind CSS + React Router, Supabase (Auth, PostgreSQL +
Row Level Security, Storage privat, Realtime), dan Netlify untuk hosting.

---

## A. Persiapan di laptop Windows (sekali saja)

Semua perintah diketik di **PowerShell**. Cara membukanya: tekan tombol Windows, ketik
`PowerShell`, lalu tekan Enter. Ketik satu perintah, tekan Enter, dan tunggu sampai
selesai sebelum mengetik perintah berikutnya.

1. **Pasang Node.js** (menjalankan website di laptop). Unduh versi **LTS** dari
   <https://nodejs.org>, lalu pasang dengan tombol Next sampai selesai. Tutup PowerShell,
   buka lagi, lalu cek versinya. Hasilnya harus `v22.22` atau lebih baru (misalnya `v24.x`).
   ```powershell
   node -v
   ```
2. **Pasang Git** (mengambil kode dari GitHub) dari <https://git-scm.com/download/win>
   (cukup tekan Next terus). Cek:
   ```powershell
   git --version
   ```
3. **Ambil kode proyek.** Perintah pertama mengunduh kode, perintah kedua masuk ke
   foldernya, dan perintah ketiga pindah ke versi terbaru yang sedang dikerjakan.
   ```powershell
   git clone https://github.com/zuliandwisaputra/Sahabat-Kaki-Desa.git
   ```
   ```powershell
   cd Sahabat-Kaki-Desa
   ```
   ```powershell
   git checkout claude/dazzling-wright-11fnuf
   ```

## B. Menyiapkan Supabase (database + login)

1. Buka <https://supabase.com>, daftar atau masuk, lalu klik **New project**.
   - Name: `sahabat-kaki-desa`
   - Database Password: buat password lalu **simpan baik-baik**
   - Region: **Southeast Asia (Singapore)**, supaya lebih cepat dari Indonesia

   Tunggu sekitar 2 menit sampai proyek siap.
2. **Jalankan migrasi database.** Semua file ada di folder `supabase/migrations/`.
   Jalankan **berurutan dari 1 sampai 7**:
   1. Di Supabase, buka menu **SQL Editor**, lalu klik **New query**.
   2. Buka file migrasi dengan Notepad atau VS Code, tekan Ctrl+A lalu Ctrl+C, dan tempel
      (Ctrl+V) di SQL Editor.
   3. Klik **Run**. Hasilnya harus *Success*. Jika muncul peringatan, pilih **Run this query**.

   | Urutan | File | Isi |
   |---|---|---|
   | 1 | `20261125000100_tabel.sql` | 23 tabel |
   | 2 | `20261125000200_fungsi_peran.sql` | fungsi pengecek peran |
   | 3 | `20261125000300_rls.sql` | aturan hak akses (RLS) |
   | 4 | `20261125000400_trigger.sql` | profil otomatis, log aktivitas, notifikasi |
   | 5 | `20261125000500_rpc.sql` | fungsi untuk aplikasi |
   | 6 | `20261125000600_storage_realtime.sql` | penyimpanan foto privat + Realtime |
   | 7 | `20261125000700_artikel_edukasi.sql` | 4 artikel edukasi bawaan |

   > Kalau satu file gagal, **jangan lanjut ke file berikutnya**. Salin pesan error-nya dan
   > tanyakan dulu.
3. **Matikan konfirmasi email.** Buka **Authentication → Sign In / Providers → Email**,
   matikan **Confirm email**, lalu klik Save.

   Ini perlu karena layanan email gratis Supabase hanya bisa mengirim ke email anggota tim
   proyek Supabase, dan hanya beberapa email per jam. Kalau konfirmasi tidak dimatikan,
   pendaftaran memakai email lain akan gagal.
4. **Alamat website.** Buka **Authentication → URL Configuration**:
   - Site URL: `http://localhost:5173`
   - Redirect URLs: tambahkan `http://localhost:5173/**`
5. **Salin kunci.** Buka **Project Settings → API Keys** (atau tombol **Connect**), lalu salin:
   - **Project URL**, contohnya `https://abcdxyz.supabase.co`
   - **Publishable key** (atau **anon public key**)

   ⚠️ **Jangan** salin *service_role* / *secret key* ke file `.env`.

## C. Menjalankan website di laptop

1. Buat file `.env` dari contohnya, lalu buka dengan Notepad. Perintah pertama menyalin
   file, perintah kedua membukanya.
   ```powershell
   Copy-Item .env.example .env
   ```
   ```powershell
   notepad .env
   ```
   Isi dua baris ini dengan nilai dari langkah B.5, lalu simpan (Ctrl+S) dan tutup Notepad:
   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
   ```
2. Pasang paket-paket website. Cukup sekali, dan butuh 1–2 menit.
   ```powershell
   npm install
   ```
3. Jalankan website:
   ```powershell
   npm run dev
   ```
   Buka <http://localhost:5173> di Chrome. Biarkan jendela PowerShell tetap terbuka selama
   mencoba. Untuk menghentikan, tekan **Ctrl+C** di PowerShell.

### Membuat akun Admin pertama

Admin tidak bisa dipilih di halaman Daftar.

1. Daftar akun biasa di website, misalnya dengan username `admin` dan peran apa saja.
2. Di Supabase **SQL Editor**, jalankan:
   ```sql
   update public.profiles set role = 'admin', approval_status = 'disetujui' where username = 'admin';
   ```
3. Muat ulang website (F5). Menu **Kelola Akun** akan muncul.

---

## D. Struktur folder

```
docs/                 PRD, keputusan tambahan, gambar diagram
supabase/migrations/  file SQL database (tabel, RLS, trigger, fungsi, storage)
tests/db/             uji hak akses per peran (untuk pengembang, PostgreSQL lokal)
src/
  lib/                klien Supabase, matriks hak akses, format tanggal/rupiah
  context/            status login (AuthContext), pesan singkat (Toast)
  components/         tata letak (sidebar, navigasi bawah, lonceng) + komponen tampilan
  pages/              halaman: auth, beranda, profil, kelola-akun, dll.
netlify.toml          pengaturan deploy Netlify (redirect SPA)
```

## E. Keamanan

- Di frontend hanya ada **URL + anon/publishable key**. Keduanya memang dirancang untuk
  publik, karena data dilindungi **Row Level Security** di database.
- **Service role key tidak boleh** ada di frontend maupun di GitHub. Kunci ini nanti
  dipakai script akun demo, dan disimpan hanya di `.env.local` di laptop. File itu sudah
  masuk `.gitignore`, jadi tidak ikut diunggah.
- Hak akses diterapkan di dua lapis: tombol disembunyikan di tampilan, **dan** database
  menolak perubahan dari peran yang tidak berwenang.
- Foto luka dan bukti transaksi disimpan di bucket **privat** dan dibuka lewat link
  sementara (signed URL).

## F. Untuk pengembang: uji hak akses database

`tests/db/run.sh` menjalankan semua migrasi di PostgreSQL lokal (15+) dengan tiruan
Supabase, lalu menguji 135 skenario hak akses per peran:

```bash
bash tests/db/run.sh
```

## G. Catatan Supabase paket Free

Proyek gratis otomatis di-*pause* jika sekitar seminggu tidak dipakai. Buka website atau
dashboard Supabase sehari sebelum presentasi.
