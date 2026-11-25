// KUE-01..03: tiga instrumen kuesioner terstandar (keputusan no. 15) dan cara menghitung skornya.
// Kalimat butir di sini adalah versi ringkas berbahasa sederhana untuk prototipe.
// Untuk pengambilan data sungguhan, gunakan teks resmi versi Bahasa Indonesia yang dirujuk makalah.

const SKALA = {
  kualitas: ['Sangat buruk', 'Buruk', 'Biasa saja', 'Baik', 'Sangat baik'],
  puas: ['Sangat tidak puas', 'Tidak puas', 'Biasa saja', 'Puas', 'Sangat puas'],
  seberapa: ['Tidak sama sekali', 'Sedikit', 'Sedang', 'Sangat sering', 'Berlebihan'],
  cukup: ['Tidak sama sekali', 'Sedikit', 'Sedang', 'Seringkali', 'Sepenuhnya'],
  frekuensi: ['Tidak pernah', 'Jarang', 'Cukup sering', 'Sangat sering', 'Selalu'],
  setuju7: ['Sangat tidak setuju', 'Tidak setuju', 'Agak tidak setuju', 'Netral', 'Agak setuju', 'Setuju', 'Sangat setuju'],
  hari: ['0 hari', '1 hari', '2 hari', '3 hari', '4 hari', '5 hari', '6 hari', '7 hari'],
}

const butir = (no, teks, skala, extra = {}) => ({ key: `q${no}`, no, teks, skala, ...extra })

export const INSTRUMEN = {
  kualitas_hidup: {
    aspek: 'Kualitas hidup',
    nama: 'WHOQOL-BREF',
    petunjuk: 'Tanyakan tentang keadaan pasien selama 2 minggu terakhir.',
    min: 1,
    butir: [
      butir(1, 'Bagaimana menurut Anda kualitas hidup Anda?', 'kualitas'),
      butir(2, 'Seberapa puas Anda dengan kesehatan Anda?', 'puas'),
      butir(3, 'Seberapa jauh rasa sakit fisik menghalangi Anda melakukan yang dibutuhkan?', 'seberapa', { balik: true }),
      butir(4, 'Seberapa sering Anda membutuhkan pengobatan agar bisa beraktivitas sehari-hari?', 'seberapa', { balik: true }),
      butir(5, 'Seberapa jauh Anda menikmati hidup?', 'seberapa'),
      butir(6, 'Seberapa jauh Anda merasa hidup Anda berarti?', 'seberapa'),
      butir(7, 'Seberapa baik Anda mampu berkonsentrasi?', 'seberapa'),
      butir(8, 'Seberapa aman Anda rasakan dalam kehidupan sehari-hari?', 'seberapa'),
      butir(9, 'Seberapa sehat lingkungan tempat tinggal Anda?', 'seberapa'),
      butir(10, 'Apakah Anda punya cukup tenaga untuk kegiatan sehari-hari?', 'cukup'),
      butir(11, 'Apakah Anda dapat menerima penampilan tubuh Anda?', 'cukup'),
      butir(12, 'Apakah Anda punya cukup uang untuk memenuhi kebutuhan?', 'cukup'),
      butir(13, 'Seberapa mudah Anda mendapat informasi yang dibutuhkan sehari-hari?', 'cukup'),
      butir(14, 'Seberapa sering Anda punya kesempatan bersantai atau berekreasi?', 'cukup'),
      butir(15, 'Seberapa baik kemampuan Anda bergerak atau berpindah tempat?', 'kualitas'),
      butir(16, 'Seberapa puas Anda dengan tidur Anda?', 'puas'),
      butir(17, 'Seberapa puas Anda dengan kemampuan melakukan kegiatan sehari-hari?', 'puas'),
      butir(18, 'Seberapa puas Anda dengan kemampuan bekerja?', 'puas'),
      butir(19, 'Seberapa puas Anda terhadap diri sendiri?', 'puas'),
      butir(20, 'Seberapa puas Anda dengan hubungan pribadi/sosial Anda?', 'puas'),
      butir(21, 'Seberapa puas Anda dengan kehidupan seksual Anda?', 'puas'),
      butir(22, 'Seberapa puas Anda dengan dukungan dari teman?', 'puas'),
      butir(23, 'Seberapa puas Anda dengan kondisi tempat tinggal Anda?', 'puas'),
      butir(24, 'Seberapa puas Anda dengan akses ke layanan kesehatan?', 'puas'),
      butir(25, 'Seberapa puas Anda dengan transportasi yang tersedia?', 'puas'),
      butir(26, 'Seberapa sering Anda punya perasaan negatif (sedih, putus asa, cemas)?', 'frekuensi', { balik: true }),
    ],
    domain: {
      'Kesehatan fisik': [3, 4, 10, 15, 16, 17, 18],
      Psikologis: [5, 6, 7, 11, 19, 26],
      'Hubungan sosial': [20, 21, 22],
      Lingkungan: [8, 9, 12, 13, 14, 23, 24, 25],
    },
    satuan: 'dari 100',
    keterangan: 'Rata-rata skor 4 domain (0–100). Makin tinggi makin baik.',
  },
  dukungan_sosial: {
    aspek: 'Dukungan sosial',
    nama: 'MSPSS',
    petunjuk: 'Seberapa setuju pasien dengan pernyataan berikut.',
    min: 1,
    butir: [
      butir(1, 'Ada orang istimewa yang ada di dekat saya ketika saya membutuhkan.', 'setuju7'),
      butir(2, 'Ada orang istimewa yang bisa saya ajak berbagi suka dan duka.', 'setuju7'),
      butir(3, 'Keluarga saya benar-benar berusaha membantu saya.', 'setuju7'),
      butir(4, 'Saya mendapat bantuan dan dukungan perasaan yang saya butuhkan dari keluarga.', 'setuju7'),
      butir(5, 'Ada orang istimewa yang benar-benar membuat saya merasa nyaman.', 'setuju7'),
      butir(6, 'Teman-teman saya benar-benar berusaha membantu saya.', 'setuju7'),
      butir(7, 'Saya bisa mengandalkan teman-teman ketika ada masalah.', 'setuju7'),
      butir(8, 'Saya bisa membicarakan masalah saya dengan keluarga.', 'setuju7'),
      butir(9, 'Saya punya teman yang bisa diajak berbagi suka dan duka.', 'setuju7'),
      butir(10, 'Ada orang istimewa dalam hidup saya yang peduli dengan perasaan saya.', 'setuju7'),
      butir(11, 'Keluarga saya mau membantu saya mengambil keputusan.', 'setuju7'),
      butir(12, 'Saya bisa membicarakan masalah saya dengan teman-teman.', 'setuju7'),
    ],
    domain: { 'Orang istimewa': [1, 2, 5, 10], Keluarga: [3, 4, 8, 11], Teman: [6, 7, 9, 12] },
    satuan: 'dari 7',
    keterangan: 'Rata-rata 1–7: 1–2,9 rendah; 3–5 sedang; 5,1–7 tinggi.',
  },
  kemandirian: {
    aspek: 'Kemandirian (perawatan diri)',
    nama: 'SDSCA',
    petunjuk: 'Dalam 7 hari terakhir, berapa hari pasien melakukan hal berikut?',
    min: 0,
    butir: [
      butir(1, 'Mengikuti pola makan sehat.', 'hari'),
      butir(2, 'Mengikuti rencana makan yang dianjurkan petugas.', 'hari'),
      butir(3, 'Makan 5 porsi atau lebih buah dan sayur.', 'hari'),
      butir(4, 'Makan makanan tinggi lemak (gorengan, daging berlemak, santan).', 'hari', { balik: true }),
      butir(5, 'Beraktivitas fisik minimal 30 menit.', 'hari'),
      butir(6, 'Ikut olahraga khusus (jalan kaki, senam) selain pekerjaan rumah.', 'hari'),
      butir(7, 'Memeriksa gula darah.', 'hari'),
      butir(8, 'Memeriksa gula darah sesuai anjuran petugas.', 'hari'),
      butir(9, 'Memeriksa kaki.', 'hari'),
      butir(10, 'Memeriksa bagian dalam alas kaki sebelum dipakai.', 'hari'),
      butir(11, 'Minum obat diabetes sesuai anjuran.', 'hari'),
    ],
    domain: { 'Pola makan': [1, 2, 3, 4], 'Aktivitas fisik': [5, 6], 'Cek gula darah': [7, 8], 'Perawatan kaki': [9, 10], Obat: [11] },
    satuan: 'hari/minggu',
    keterangan: 'Rata-rata hari per minggu (0–7). Makin tinggi makin mandiri.',
  },
}

export const ASPEK_LABEL = { kualitas_hidup: 'Kualitas hidup', dukungan_sosial: 'Dukungan sosial', kemandirian: 'Kemandirian' }

export function opsiButir(instrumen, b) {
  const label = SKALA[b.skala]
  return Object.fromEntries(label.map((l, i) => [String(i + instrumen.min), `${i + instrumen.min} · ${l}`]))
}

function nilai(instrumen, b, jawaban) {
  const v = Number(jawaban?.[b.key])
  if (jawaban?.[b.key] === undefined || jawaban?.[b.key] === '' || Number.isNaN(v)) return null
  if (!b.balik) return v
  return instrumen.min === 0 ? 7 - v : 6 - v // SDSCA: 7−x; WHOQOL: 6−x
}

const rata = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length
const bulat = (x, d) => Math.round(x * 10 ** d) / 10 ** d

/** Hitung skor. Hasil: { lengkap, skor, domain: {nama: nilai}, kategori } */
export function hitungSkor(aspek, jawaban) {
  const ins = INSTRUMEN[aspek]
  const v = Object.fromEntries(ins.butir.map((b) => [b.no, nilai(ins, b, jawaban)]))
  const lengkap = Object.values(v).every((x) => x !== null)
  if (!lengkap) return { lengkap: false, skor: null, domain: {}, kategori: null }
  const domain = {}
  if (aspek === 'kualitas_hidup') {
    for (const [nama, nos] of Object.entries(ins.domain)) {
      domain[nama] = bulat(((rata(nos.map((n) => v[n])) * 4 - 4) * 100) / 16, 1)
    }
    const skor = bulat(rata(Object.values(domain)), 1)
    return { lengkap, skor, domain, kategori: null }
  }
  for (const [nama, nos] of Object.entries(ins.domain)) domain[nama] = bulat(rata(nos.map((n) => v[n])), 2)
  const skor = bulat(rata(Object.values(v)), 2)
  let kategori = null
  if (aspek === 'dukungan_sosial') kategori = skor < 3 ? 'Rendah' : skor <= 5 ? 'Sedang' : 'Tinggi'
  return { lengkap, skor, domain, kategori }
}

export function kategoriMspss(skor) {
  if (skor === null || skor === undefined) return null
  return skor < 3 ? 'Rendah' : skor <= 5 ? 'Sedang' : 'Tinggi'
}
