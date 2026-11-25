-- =============================================================================
-- Sahabat Kaki Desa — 6. Storage (bucket PRIVAT) + Realtime
-- Semua bucket privat: file dibuka lewat signed URL (link sementara).
-- Ukuran maksimal 2 MB per file (foto dikompres dulu di aplikasi, ±500 KB).
--
-- Aturan nama file (folder pertama menentukan pemilik):
--   wound-photos   : {patient_id}/kunjungan/{nama-file}   foto luka
--                    {patient_id}/profil/{nama-file}      foto pasien (PAS-02)
--   fund-proofs    : {tahun-bulan}/{nama-file}            bukti transaksi Jimpitan
--   avatars        : {user_id}/{nama-file}                foto profil akun
--   article-images : {nama-file}                          gambar artikel/pengumuman
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('wound-photos',   'wound-photos',   false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('fund-proofs',    'fund-proofs',    false, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('avatars',        'avatars',        false, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('article-images', 'article-images', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- ---- wound-photos: Perawat, Kader, Admin; Pasien/Keluarga hanya miliknya.
--      Perangkat Desa TIDAK bisa membuka foto luka.
create policy "foto luka: lihat" on storage.objects for select to authenticated
  using (
    bucket_id = 'wound-photos'
    and (
      (select public.has_role('perawat', 'kader', 'admin'))
      or (storage.foldername(name))[1] = (select public.my_patient_id())::text
    )
  );
create policy "foto luka: unggah" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'wound-photos'
    and (
      (select public.has_role('perawat', 'kader', 'admin'))
      or ((storage.foldername(name))[1] = (select public.my_patient_id())::text
          and (storage.foldername(name))[2] = 'profil')
    )
  );
create policy "foto luka: ubah" on storage.objects for update to authenticated
  using (bucket_id = 'wound-photos' and (select public.has_role('perawat', 'kader', 'admin')))
  with check (bucket_id = 'wound-photos' and (select public.has_role('perawat', 'kader', 'admin')));
create policy "foto luka: hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'wound-photos' and (select public.has_role('perawat', 'kader', 'admin')));

-- ---- fund-proofs: semua yang login bisa melihat (transparansi Jimpitan, JIM-04)
create policy "bukti jimpitan: lihat" on storage.objects for select to authenticated
  using (bucket_id = 'fund-proofs');
create policy "bukti jimpitan: unggah" on storage.objects for insert to authenticated
  with check (bucket_id = 'fund-proofs' and (select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "bukti jimpitan: ubah" on storage.objects for update to authenticated
  using (bucket_id = 'fund-proofs' and (select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check (bucket_id = 'fund-proofs' and (select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "bukti jimpitan: hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'fund-proofs' and (select public.has_role('perawat', 'kader', 'desa', 'admin')));

-- ---- avatars: semua yang login bisa melihat; hanya pemilik yang mengunggah
create policy "foto profil: lihat" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "foto profil: unggah milik sendiri" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto profil: ubah milik sendiri" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "foto profil: hapus milik sendiri" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---- article-images: semua yang login bisa melihat; STAF yang mengunggah
create policy "gambar artikel: lihat" on storage.objects for select to authenticated
  using (bucket_id = 'article-images');
create policy "gambar artikel: unggah" on storage.objects for insert to authenticated
  with check (bucket_id = 'article-images' and (select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "gambar artikel: ubah" on storage.objects for update to authenticated
  using (bucket_id = 'article-images' and (select public.has_role('perawat', 'kader', 'desa', 'admin')))
  with check (bucket_id = 'article-images' and (select public.has_role('perawat', 'kader', 'desa', 'admin')));
create policy "gambar artikel: hapus" on storage.objects for delete to authenticated
  using (bucket_id = 'article-images' and (select public.has_role('perawat', 'kader', 'desa', 'admin')));

-- ---------------------------------------------------------------------------
-- Realtime: notifikasi lonceng langsung muncul tanpa muat ulang halaman.
-- Realtime tetap mematuhi RLS, jadi setiap orang hanya menerima notifikasinya.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;
