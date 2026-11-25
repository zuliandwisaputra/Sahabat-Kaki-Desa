-- =============================================================================
-- Sahabat Kaki Desa — 7. Artikel edukasi bawaan (HOME-03)
-- Isi edukasi umum perawatan kaki diabetes, bukan data pasien. Bisa diubah atau
-- dihapus oleh Perawat/Kader/Perangkat Desa/Admin lewat Beranda.
-- =============================================================================

insert into public.articles (title, category, body) values
(
  'Cara mencuci dan merawat kaki setiap hari',
  'edukasi',
  $$1. Cuci kaki setiap hari dengan air hangat suam-kuku dan sabun yang lembut. Cek panas air dengan siku atau punggung tangan dulu, jangan dengan kaki, karena kaki penderita diabetes sering kurang terasa panas.
2. Jangan merendam kaki terlalu lama, cukup beberapa menit.
3. Keringkan dengan handuk lembut, terutama di sela-sela jari kaki.
4. Oleskan pelembap di telapak dan punggung kaki, tetapi jangan di sela jari.
5. Periksa kaki setiap hari: telapak, tumit, dan sela jari. Pakai cermin atau minta bantuan keluarga.
6. Potong kuku lurus mengikuti bentuk jari, jangan terlalu pendek. Haluskan ujung yang tajam dengan kikir.
7. Jangan memotong sendiri kapalan atau mata ikan. Tunjukkan kepada perawat saat Pos Kaki.$$
),
(
  'Memilih alas kaki yang aman',
  'edukasi',
  $$1. Selalu pakai alas kaki, juga di dalam rumah dan di halaman. Jangan berjalan tanpa alas kaki.
2. Pilih sepatu atau sandal yang tertutup, empuk, dan ukurannya pas: tidak sempit, tidak terlalu longgar.
3. Coba dan beli sepatu pada sore hari, saat ukuran kaki sedikit lebih besar.
4. Sebelum dipakai, periksa bagian dalam sepatu dari kerikil, paku, atau benda tajam.
5. Pakai kaus kaki yang bersih dan tidak ketat. Ganti setiap hari.
6. Hindari sandal jepit dengan tali di sela jari dan sepatu berhak tinggi.$$
),
(
  'Tanda bahaya luka kaki: segera ke Puskesmas',
  'edukasi',
  $$Segera hubungi kader atau perawat, atau langsung ke Puskesmas, jika ada salah satu tanda ini:
- Luka yang tidak membaik dalam beberapa hari
- Kulit di sekitar luka merah, bengkak, atau terasa hangat
- Luka bernanah, berbau, atau mengeluarkan cairan
- Demam atau badan menggigil
- Kulit kaki atau jari berubah warna menjadi kebiruan atau kehitaman
- Nyeri makin berat, atau justru kaki terasa mati rasa

Jangan menunggu luka menjadi parah. Penanganan sejak dini mencegah luka bertambah buruk.$$
),
(
  'Penderita luka kaki bukan beban',
  'anti_stigma',
  $$Luka kaki pada penderita diabetes tidak menular. Pasien tetap boleh beraktivitas ringan sesuai saran perawat, misalnya senam lansia sambil duduk, asalkan kaki yang luka tidak tertekan.

Dukungan keluarga dan tetangga mempercepat pemulihan: menemani kontrol, mengingatkan minum obat, membantu memeriksa kaki, dan mengajak ikut kegiatan desa.

Mari sapa dan libatkan mereka. Bersama, kita jaga kaki warga desa tetap sehat.$$
);
