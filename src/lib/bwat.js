// Bates-Jensen Wound Assessment Tool (BWAT) — 13 butir, masing-masing 1–5 poin (total 13–65).
// Pembagian warna (keputusan kelompok, docs/KEPUTUSAN.md no. 14):
//   13–20 Hijau (risiko rendah) · 21–40 Kuning (risiko sedang) · 41–65 Merah (risiko tinggi)
//   Tidak ada luka terbuka -> Hijau.
// Aturan yang sama juga dijaga di database (migrasi ..._skor_bwat.sql).

export const BWAT = [
  {
    key: 'ukuran',
    label: '1. Ukuran luka (panjang × lebar)',
    pilihan: ['< 4 cm²', '4 – < 16 cm²', '16 – < 36 cm²', '36 – < 80 cm²', '> 80 cm²'],
  },
  {
    key: 'kedalaman',
    label: '2. Kedalaman',
    pilihan: [
      'Kemerahan tidak memucat pada kulit utuh',
      'Kehilangan sebagian lapisan kulit (epidermis/dermis)',
      'Kehilangan seluruh lapisan kulit, sampai jaringan bawah kulit, belum menembus fasia',
      'Tertutup jaringan nekrotik (dasar luka tidak terlihat)',
      'Seluruh lapisan rusak luas: sampai otot, tulang, atau struktur penunjang',
    ],
  },
  {
    key: 'tepi',
    label: '3. Tepi luka',
    pilihan: [
      'Samar, tidak terlihat jelas',
      'Jelas, menyatu dengan dasar luka',
      'Jelas, tidak menyatu dengan dasar luka',
      'Jelas, tidak menyatu, menebal',
      'Jelas, fibrotik, parut tebal/hiperkeratotik',
    ],
  },
  {
    key: 'goa',
    label: '4. Goa (undermining)',
    pilihan: ['Tidak ada', '< 2 cm di area mana pun', '2–4 cm, < 50% tepi luka', '2–4 cm, > 50% tepi luka', '> 4 cm atau ada terowongan'],
  },
  {
    key: 'jenis_nekrotik',
    label: '5. Jenis jaringan nekrotik',
    pilihan: [
      'Tidak ada',
      'Putih/abu-abu tidak hidup dan/atau slough kuning tidak melekat',
      'Slough kuning, melekat longgar',
      'Eskar hitam lunak, melekat',
      'Eskar hitam keras, melekat kuat',
    ],
  },
  {
    key: 'jumlah_nekrotik',
    label: '6. Jumlah jaringan nekrotik',
    pilihan: ['Tidak ada', '< 25% dasar luka', '25–50% dasar luka', '> 50% dan < 75% dasar luka', '75–100% dasar luka'],
  },
  {
    key: 'jenis_eksudat',
    label: '7. Jenis cairan luka (eksudat)',
    pilihan: [
      'Tidak ada',
      'Berdarah',
      'Serosanguinous (encer, merah muda)',
      'Serosa (encer, jernih)',
      'Purulen (kental, keruh, kuning/hijau, bisa berbau)',
    ],
  },
  {
    key: 'jumlah_eksudat',
    label: '8. Jumlah cairan luka',
    pilihan: ['Tidak ada, luka kering', 'Sangat sedikit, luka lembap', 'Sedikit', 'Sedang', 'Banyak'],
  },
  {
    key: 'warna_kulit',
    label: '9. Warna kulit sekitar luka',
    pilihan: [
      'Merah muda/normal',
      'Merah terang dan/atau memucat bila ditekan',
      'Putih/abu-abu pucat atau hipopigmentasi',
      'Merah gelap/ungu dan/atau tidak memucat',
      'Hitam atau hiperpigmentasi',
    ],
  },
  {
    key: 'edema',
    label: '10. Edema jaringan sekitar',
    pilihan: [
      'Tidak ada',
      'Tidak pitting, < 4 cm sekitar luka',
      'Tidak pitting, ≥ 4 cm sekitar luka',
      'Pitting, < 4 cm sekitar luka',
      'Krepitasi dan/atau pitting ≥ 4 cm',
    ],
  },
  {
    key: 'indurasi',
    label: '11. Indurasi (pengerasan) jaringan sekitar',
    pilihan: ['Tidak ada', '< 2 cm sekitar luka', '2–4 cm, < 50% sekitar luka', '2–4 cm, ≥ 50% sekitar luka', '> 4 cm di area mana pun'],
  },
  {
    key: 'granulasi',
    label: '12. Jaringan granulasi',
    pilihan: [
      'Kulit utuh atau luka sebagian lapisan',
      'Merah terang seperti daging, mengisi 75–100% luka',
      'Merah terang seperti daging, mengisi 25–75% luka',
      'Merah muda/kusam/gelap, mengisi ≤ 25% luka',
      'Tidak ada jaringan granulasi',
    ],
  },
  {
    key: 'epitelisasi',
    label: '13. Epitelisasi (luka tertutup kulit baru)',
    pilihan: ['100% tertutup, permukaan utuh', '75 – < 100% tertutup', '50 – < 75% tertutup', '25 – < 50% tertutup', '< 25% tertutup'],
  },
]

export const RISIKO = {
  hijau: { rentang: '13–20', risiko: 'Risiko rendah', keterangan: 'Luka ringan atau membaik. Lanjutkan perawatan dan kontrol sesuai jadwal.' },
  kuning: { rentang: '21–40', risiko: 'Risiko sedang', keterangan: 'Luka sedang. Perlu arahan perawat dan jadwal pemeriksaan.' },
  merah: { rentang: '41–65', risiko: 'Risiko tinggi', keterangan: 'Luka berat. Segera ke tenaga kesehatan; pertimbangkan rujukan.' },
}

export const PERINGKAT = { hijau: 1, kuning: 2, merah: 3 }

/** Total skor BWAT, atau null jika belum semua 13 butir terisi. */
export function skorBwat(jawaban) {
  if (!jawaban) return null
  let total = 0
  for (const b of BWAT) {
    const v = Number(jawaban[b.key])
    if (!(v >= 1 && v <= 5)) return null
    total += v
  }
  return total
}

export function warnaDariSkor(skor) {
  if (skor === null || skor === undefined) return null
  if (skor <= 20) return 'hijau'
  if (skor <= 40) return 'kuning'
  return 'merah'
}

/** Warna minimal dari hasil penilaian: tanpa luka = hijau. */
export function warnaMinimal({ adaLuka, jawaban }) {
  if (adaLuka === false) return 'hijau'
  return warnaDariSkor(skorBwat(jawaban))
}
