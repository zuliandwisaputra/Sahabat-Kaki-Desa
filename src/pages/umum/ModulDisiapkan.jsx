import { useMatches } from 'react-router'
import { CircleCheck, Hammer } from 'lucide-react'
import { MENUS } from '../../lib/permissions'
import { Card, PageHeader } from '../../components/ui/misc'

// Isi sementara untuk modul yang dibangun di tahap berikutnya.
const ISI = {
  pasien: [
    'Daftar pasien dengan pencarian dan saringan status',
    'Identitas pasien dan persetujuan pasien & keluarga',
    'Riwayat lengkap pasien dalam satu linimasa',
  ],
  'sahabat-kaki': [
    'Pasangan pasien dan pendamping (kader/PKK)',
    'Catatan kunjungan mingguan dan penanda kunjungan terlambat',
    'Tombol "Lapor ke perawat"',
  ],
  'kartu-kaki': [
    'Catatan pengamatan kader saat kunjungan',
    'Kode warna hijau/kuning/merah dan arahan SBAR dari perawat',
    'Cetak Kartu Kaki Sehat (PDF)',
  ],
  jimpitan: [
    'Catat pemasukan dan pengeluaran beserta bukti',
    'Saldo berjalan dan laporan bulanan',
    'Ekspor ke Excel/PDF',
  ],
  'pos-kaki': [
    'Agenda Pos Kaki dan daftar hadir',
    'Data driver Ojek Sehat',
    'Pemesanan Ojek Sehat yang terhubung ke Jimpitan',
  ],
  pemberdayaan: [
    'Direktori sumber daya desa',
    'Kalender kegiatan dan pendaftaran peserta',
    'Pelatihan kader, rapat Siaga Kaki, dan dokumen kebijakan',
  ],
  kuesioner: ['Kuesioner kualitas hidup, dukungan sosial, dan kemandirian', 'Skor otomatis, perbandingan awal dan ulang'],
  evaluasi: [
    'Sembilan indikator keberhasilan program',
    'Grafik per bulan dengan saringan periode dan dusun',
    'Catatan evaluasi dan rencana tindak lanjut',
  ],
  'kelola-data': [
    'Master data dusun/RT, Pos Kaki, dan kategori',
    'Ekspor data pasien dan rekap',
    'Arsip pasien dan log aktivitas',
  ],
}

export default function ModulDisiapkan() {
  const matches = useMatches()
  const menuKey = [...matches].reverse().find((m) => m.handle?.menu)?.handle.menu
  const menu = MENUS.find((m) => m.key === menuKey)

  return (
    <div>
      <PageHeader title={menu?.label ?? 'Halaman'} menu={menuKey} />
      <Card>
        <div className="flex items-start gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-soft text-primary">
            <Hammer aria-hidden="true" className="size-6" />
          </span>
          <div>
            <p className="text-lg font-extrabold">Modul ini sedang disiapkan.</p>
            <p className="text-muted">Yang akan tersedia di sini:</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2">
          {(ISI[menuKey] ?? []).map((t) => (
            <li key={t} className="flex gap-2">
              <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
