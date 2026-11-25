// Ekspor laporan ke Excel (SheetJS) dan PDF (jsPDF). Library dimuat saat dibutuhkan saja.
import { formatTanggal } from './format'

const tanggalFile = () => new Date().toISOString().slice(0, 10)
const aman = (s) => String(s).replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-|-$/g, '')

/**
 * Unduh file Excel. lembar: [{ nama, kolom: [{ key, label }], baris: [obj] }]
 * Catatan keamanan: aplikasi hanya MENULIS file Excel, tidak membaca file kiriman orang.
 */
export async function unduhExcel(namaFile, lembar) {
  const XLSX = await import('xlsx')
  const wb = XLSX.utils.book_new()
  for (const l of lembar) {
    const data = l.baris.map((r) => Object.fromEntries(l.kolom.map((k) => [k.label, r[k.key] ?? ''])))
    const ws = XLSX.utils.json_to_sheet(data, { header: l.kolom.map((k) => k.label) })
    ws['!cols'] = l.kolom.map((k) => ({ wch: Math.min(60, Math.max(k.label.length, ...l.baris.map((r) => String(r[k.key] ?? '').length)) + 2) }))
    XLSX.utils.book_append_sheet(wb, ws, l.nama.slice(0, 31))
  }
  XLSX.writeFile(wb, `${aman(namaFile)}-${tanggalFile()}.xlsx`)
}

/** Unduh PDF berisi satu atau beberapa tabel. bagian: [{ judul, kolom, baris, catatan }] */
export async function unduhPdf(namaFile, judul, bagian, { mendatar = false, subjudul } = {}) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: mendatar ? 'landscape' : 'portrait' })
  const W = doc.internal.pageSize.getWidth()
  doc.setFillColor(156, 36, 87)
  doc.rect(0, 0, W, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.text(judul, 14, 12.5)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(subjudul ?? `Sahabat Kaki Desa - dicetak ${formatTanggal(new Date(), { weekday: undefined })}`, 14, 17.5)
  let y = 28
  for (const b of bagian) {
    if (y > 260) {
      doc.addPage()
      y = 18
    }
    if (b.judul) {
      doc.setTextColor(156, 36, 87)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11.5)
      doc.text(b.judul, 14, y)
      y += 3
    }
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.6, textColor: [59, 30, 42], lineColor: [230, 200, 212] },
      headStyles: { fillColor: [156, 36, 87], textColor: 255, fontStyle: 'bold' },
      head: [b.kolom.map((k) => k.label)],
      body: b.baris.length ? b.baris.map((r) => b.kolom.map((k) => String(r[k.key] ?? ''))) : [[{ content: 'Belum ada data', colSpan: b.kolom.length }]],
    })
    y = doc.lastAutoTable.finalY + 4
    if (b.catatan) {
      doc.setTextColor(107, 72, 87)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      const t = doc.splitTextToSize(b.catatan, W - 28)
      doc.text(t, 14, y + 2)
      y += t.length * 4 + 4
    }
    y += 4
  }
  doc.save(`${aman(namaFile)}-${tanggalFile()}.pdf`)
}
