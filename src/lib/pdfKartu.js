// KKS-07: cetak Kartu Kaki Sehat (PDF) lengkap dengan kode warna terakhir.
// KKS-01: identitas pasien, jadwal kontrol, jadwal perawatan luka, catatan pemeriksaan
// oleh tenaga kesehatan, pengingat perawatan diri, kontak kader dan Puskesmas.
import { supabase } from './supabase'
import { formatTanggal, formatTanggalPendek } from './format'
import { PERUBAHAN, TANDA, alamatSingkat, satuPenilaian, umur } from './pasien'

const WARNA = {
  hijau: { label: 'HIJAU', arti: 'Tidak ada tanda bahaya. Lanjutkan perawatan dan kontrol sesuai jadwal.', fill: [220, 252, 231], text: [22, 101, 52], line: [34, 197, 94] },
  kuning: { label: 'KUNING', arti: 'Perlu perhatian. Hubungi kader atau perawat untuk arahan dan jadwal pemeriksaan.', fill: [254, 249, 195], text: [133, 77, 14], line: [234, 179, 8] },
  merah: { label: 'MERAH', arti: 'Tanda bahaya. Segera ke tenaga kesehatan.', fill: [254, 226, 226], text: [153, 27, 27], line: [239, 68, 68] },
}
const BERRY = [156, 36, 87]
const TINTA = [59, 30, 42]
const ABU = [107, 72, 87]

const PENGINGAT = [
  'Cuci kaki setiap hari dengan air hangat suam-kuku, lalu keringkan sampai sela jari.',
  'Periksa kaki setiap hari (telapak, tumit, sela jari). Pakai cermin atau minta bantuan keluarga.',
  'Selalu pakai alas kaki yang tertutup dan pas, juga di dalam rumah.',
  'Potong kuku lurus, jangan terlalu pendek. Jangan memotong kapalan sendiri.',
  'Minum obat dan kontrol gula darah sesuai anjuran.',
  'Segera lapor kader/perawat bila ada luka baru, kemerahan, bengkak, bau, nanah, atau demam.',
]

export async function cetakKartuKaki(pasienId) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

  const [pasienRes, kartuRes, pendRes, setRes] = await Promise.all([
    supabase.from('patients').select('*').eq('id', pasienId).maybeSingle(),
    supabase
      .from('foot_visits')
      .select('visit_date, status, reported_change, signs, observation_notes, assessments(color_code, follow_up_instruction, sbar_recommendation, activity_recommendation, next_control_date, wound_care_schedule, assessed_at, referral, referral_to)')
      .eq('patient_id', pasienId)
      .neq('status', 'draft')
      .order('visit_date', { ascending: false })
      .limit(8),
    supabase.from('companions').select('name, phone').eq('patient_id', pasienId).eq('active', true).maybeSingle(),
    supabase.from('app_settings').select('key, value'),
  ])
  if (pasienRes.error) throw pasienRes.error
  const p = pasienRes.data
  if (!p) throw new Error('Data pasien tidak bisa dibuka.')
  const kartu = (kartuRes.data ?? []).map((k) => ({ ...k, a: satuPenilaian(k.assessments) }))
  const pend = pendRes.data
  const set = Object.fromEntries((setRes.data ?? []).map((s) => [s.key, s.value]))
  const terakhir = kartu.find((k) => k.a)?.a ?? null

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const M = 14
  const lebar = W - 2 * M
  let y = 0

  const muat = (tinggi) => {
    if (y + tinggi > 282) {
      doc.addPage()
      y = 16
    }
  }
  const judul = (teks) => {
    muat(12)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(...BERRY)
    doc.text(teks.toUpperCase(), M, y)
    doc.setDrawColor(...BERRY)
    doc.setLineWidth(0.4)
    doc.line(M, y + 1.5, W - M, y + 1.5)
    y += 7
  }
  const paragraf = (teks, { size = 10.5, bold = false, warna = TINTA, indent = 0 } = {}) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...warna)
    const baris = doc.splitTextToSize(String(teks), lebar - indent)
    muat(baris.length * size * 0.45 + 1)
    doc.text(baris, M + indent, y)
    y += baris.length * size * 0.45 + 1.5
  }

  // ---- Kepala kartu
  doc.setFillColor(...BERRY)
  doc.rect(0, 0, W, 26, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text('KARTU KAKI SEHAT', M, 13)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text(['Sahabat Kaki Desa', set.nama_desa, set.nama_puskesmas].filter(Boolean).join('  -  '), M, 20)
  y = 34

  // ---- Kode warna terakhir
  const w = terakhir ? WARNA[terakhir.color_code] : null
  doc.setLineWidth(0.8)
  if (w) {
    doc.setFillColor(...w.fill)
    doc.setDrawColor(...w.line)
  } else {
    doc.setFillColor(245, 245, 245)
    doc.setDrawColor(200, 200, 200)
  }
  doc.roundedRect(M, y, lebar, 22, 3, 3, 'FD')
  doc.setTextColor(...(w ? w.text : ABU))
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(w ? `KODE ${w.label}` : 'BELUM DINILAI PERAWAT', M + 5, y + 8.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.text(
    doc.splitTextToSize(w ? `${w.arti}  (dinilai ${formatTanggalPendek(terakhir.assessed_at)})` : 'Kartu akan diberi kode warna oleh perawat.', lebar - 10),
    M + 5,
    y + 15,
  )
  y += 30

  // ---- Identitas
  judul('Identitas pasien')
  const u = umur(p.birth_date)
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: M, right: M },
    styles: { fontSize: 10.5, cellPadding: 1.2, textColor: TINTA },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48, textColor: ABU } },
    body: [
      ['Nama', p.full_name],
      ['Tanggal lahir', `${formatTanggal(p.birth_date, { weekday: undefined })}${u !== null ? ` (${u} tahun)` : ''}`],
      ['Jenis kelamin', p.gender === 'P' ? 'Perempuan' : 'Laki-laki'],
      ['Alamat', [alamatSingkat(p), p.address_detail].filter(Boolean).join(' - ')],
      ['Nomor HP', p.phone ?? '-'],
      ['Keluarga pendamping', [p.family_name, p.family_relation && `(${p.family_relation})`, p.family_phone].filter(Boolean).join(' ') || '-'],
      ['Riwayat penyakit', [p.diabetes_since_year && `Diabetes sejak ${p.diabetes_since_year}`, p.medical_history].filter(Boolean).join('. ') || '-'],
    ],
  })
  y = doc.lastAutoTable.finalY + 6

  // ---- Jadwal & arahan perawat terakhir
  judul('Jadwal & arahan perawat')
  autoTable(doc, {
    startY: y,
    theme: 'plain',
    margin: { left: M, right: M },
    styles: { fontSize: 10.5, cellPadding: 1.2, textColor: TINTA },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 48, textColor: ABU } },
    body: [
      ['Jadwal kontrol berikutnya', terakhir?.next_control_date ? formatTanggal(terakhir.next_control_date) : '-'],
      ['Jadwal perawatan luka', terakhir?.wound_care_schedule ?? '-'],
      ['Arahan tindak lanjut', terakhir?.follow_up_instruction ?? terakhir?.sbar_recommendation ?? '-'],
      ['Rekomendasi aktivitas', terakhir?.activity_recommendation ?? '-'],
      ...(terakhir?.referral ? [['Rujukan', terakhir.referral_to ?? 'Ya']] : []),
    ],
  })
  y = doc.lastAutoTable.finalY + 6

  // ---- Riwayat pemeriksaan
  judul('Catatan pemeriksaan kaki')
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    margin: { left: M, right: M },
    styles: { fontSize: 9.5, cellPadding: 1.8, textColor: TINTA, lineColor: [230, 200, 212] },
    headStyles: { fillColor: BERRY, textColor: 255, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: 26 }, 2: { cellWidth: 34 }, 3: { cellWidth: 20, fontStyle: 'bold' } },
    head: [['Tanggal', 'Perubahan', 'Tanda', 'Kode', 'Arahan perawat']],
    body: kartu.length
      ? kartu.map((k) => [
          formatTanggalPendek(k.visit_date),
          PERUBAHAN[k.reported_change] ?? '-',
          (k.signs ?? []).map((s) => TANDA[s]).join(', ') || '-',
          k.a ? WARNA[k.a.color_code].label : 'Belum',
          k.a?.follow_up_instruction ?? '-',
        ])
      : [['-', '-', '-', '-', 'Belum ada catatan pemeriksaan']],
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const kode = Object.values(WARNA).find((x) => x.label === data.cell.raw)
        if (kode) {
          data.cell.styles.fillColor = kode.fill
          data.cell.styles.textColor = kode.text
        }
      }
    },
  })
  y = doc.lastAutoTable.finalY + 6

  // ---- Pengingat perawatan diri
  judul('Pengingat perawatan diri')
  PENGINGAT.forEach((t, i) => paragraf(`${i + 1}. ${t}`, { indent: 1 }))
  y += 2

  // ---- Arti kode warna
  judul('Arti kode warna')
  for (const k of Object.values(WARNA)) {
    muat(9)
    doc.setFillColor(...k.fill)
    doc.setDrawColor(...k.line)
    doc.setLineWidth(0.5)
    doc.roundedRect(M, y - 4.2, 22, 6.5, 1.5, 1.5, 'FD')
    doc.setTextColor(...k.text)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.text(k.label, M + 11, y, { align: 'center' })
    doc.setTextColor(...TINTA)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text(doc.splitTextToSize(k.arti, lebar - 27), M + 26, y)
    y += 8.5
  }
  y += 2

  // ---- Kontak
  judul('Kontak')
  paragraf(`Kader pendamping: ${pend ? `${pend.name}${pend.phone ? ` - ${pend.phone}` : ''}` : '-'}`)
  paragraf(`Puskesmas: ${[set.nama_puskesmas, set.telepon_puskesmas].filter(Boolean).join(' - ') || '-'}`)
  if (set.link_grup_wa) paragraf(`Grup WhatsApp Sahabat Kaki: ${set.link_grup_wa}`)

  // ---- Kaki halaman
  const total = doc.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...ABU)
    doc.text(`Dicetak ${formatTanggal(new Date(), { weekday: undefined })} - Bawa kartu ini setiap kontrol ke Pos Kaki.`, M, 292)
    doc.text(`Hal. ${i}/${total}`, W - M, 292, { align: 'right' })
  }

  const nama = p.full_name.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')
  doc.save(`Kartu-Kaki-Sehat-${nama || 'pasien'}.pdf`)
}
