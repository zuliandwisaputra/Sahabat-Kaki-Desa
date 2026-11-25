import { useMemo, useState } from 'react'
import { CategoryScale, Chart as ChartJS, Legend, LinearScale, LineElement, PointElement, Tooltip } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { ChartColumn, FileDown, FileSpreadsheet, NotebookPen, Pencil, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { usePeran } from '../../lib/usePeran'
import { pesanError } from '../../lib/errors'
import { formatTanggal, hariIniWIB } from '../../lib/format'
import { ASPEK_LABEL, INSTRUMEN } from '../../lib/kuesioner'
import { unduhExcel, unduhPdf } from '../../lib/ekspor'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { FormModal } from '../../components/ui/FormModal'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Banner, Card, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const PERIODE = {
  bulan: { label: 'Bulan ini', mundur: 0 },
  '3bulan': { label: '3 bulan terakhir', mundur: 2 },
  '6bulan': { label: '6 bulan terakhir', mundur: 5 },
  tahun: { label: 'Tahun ini', mundur: null },
}

function rentang(kunci) {
  const hari = hariIniWIB()
  const [y, m] = hari.split('-').map(Number)
  if (kunci === 'tahun') return { dari: `${y}-01-01`, sampai: hari }
  const d = new Date(Date.UTC(y, m - 1 - PERIODE[kunci].mundur, 1))
  return { dari: d.toISOString().slice(0, 10), sampai: hari }
}

const persen = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null)

function Bilah({ nilai }) {
  if (nilai === null) return null
  return (
    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-soft" aria-hidden="true">
      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, nilai)}%` }} />
    </div>
  )
}

function KartuIndikator({ no, judul, utama, persenNilai, rincian, target }) {
  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-white">{no}</span>
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-bold">{judul}</p>
          <p className="mt-1 text-2xl leading-tight font-extrabold">
            {utama}
            {persenNilai !== null && persenNilai !== undefined && <span className="ml-2 text-lg text-primary">{persenNilai}%</span>}
          </p>
          <Bilah nilai={persenNilai ?? null} />
          {rincian?.map((r) => (
            <p key={r} className="mt-1 text-muted">
              {r}
            </p>
          ))}
          {target && <p className="mt-1 text-base font-semibold text-muted">Target: {target}</p>}
        </div>
      </div>
    </li>
  )
}

/** Susun 9 indikator menjadi baris (dipakai tampilan & ekspor) */
function susunIndikator(e) {
  const i = (k) => e[k] ?? {}
  const f = (x) => (x === null || x === undefined ? '-' : x)
  const p = (a, b) => (b > 0 ? ` (${persen(a, b)}%)` : '')
  return [
    { no: 1, judul: 'Kader dan pendamping yang sudah mendapat pelatihan', utama: `${f(i('i1').terlatih)} orang`, persen: persen(i('i1').terlatih, i('i1').pendamping_aktif), rincian: [`Pendamping aktif saat ini: ${f(i('i1').pendamping_aktif)}`] },
    { no: 2, judul: 'Pasien yang memperoleh pendamping Sahabat Kaki', utama: `${f(i('i2').dengan_pendamping)}/${f(i('i2').total)} pasien`, persen: persen(i('i2').dengan_pendamping, i('i2').total), target: '100% pasien aktif' },
    {
      no: 3,
      judul: 'Keterlaksanaan kunjungan pendamping mingguan dan kegiatan Pos Kaki',
      utama: `${f(i('i3').minggu_terkunjungi)}/${f(i('i3').target_minggu)} minggu-pasien`,
      persen: persen(i('i3').minggu_terkunjungi, i('i3').target_minggu),
      rincian: [
        `Pos Kaki terlaksana: ${f(i('i3').pos_terlaksana)} dari ${f(i('i3').pos_terjadwal)} jadwal`,
        `Kehadiran: ${f(i('i3').hadir)}/${f(i('i3').terdaftar)}${p(i('i3').hadir, i('i3').terdaftar)}, tepat waktu ${f(i('i3').tepat_waktu)}`,
      ],
      target: '≥ 1 kunjungan per pasien per minggu; ≥ 80% hadir sesuai jadwal',
    },
    {
      no: 4,
      judul: 'Kelengkapan pengisian Kartu Kaki Sehat',
      utama: `${f(i('i4').lengkap)}/${f(i('i4').total)} kartu lengkap`,
      persen: persen(i('i4').lengkap, i('i4').total),
      rincian: [`Dinilai perawat ≤ 2×24 jam: ${f(i('i4').ditinjau_48j)}/${f(i('i4').total)}${p(i('i4').ditinjau_48j, i('i4').total)}`],
      target: '≥ 90% kartu ditinjau dalam 2×24 jam',
    },
    {
      no: 5,
      judul: 'Ketepatan pelaporan dan tindak lanjut tanda bahaya (kuning/merah)',
      utama: `${f(i('i5').ditindaklanjuti)}/${f(i('i5').tanda_bahaya)} ditindaklanjuti`,
      persen: persen(i('i5').ditindaklanjuti, i('i5').tanda_bahaya),
      rincian: [`Dalam 2×24 jam: ${f(i('i5').dalam_48j)}`, `Rata-rata waktu sampai ditindaklanjuti: ${i('i5').rata_jam ?? '-'} jam`],
    },
    {
      no: 6,
      judul: 'Pemanfaatan Ojek Sehat oleh pasien yang membutuhkan transportasi',
      utama: `${f(i('i6').memakai)}/${f(i('i6').butuh)} pasien`,
      persen: persen(i('i6').memakai, i('i6').butuh),
      rincian: [`Total perjalanan selesai: ${f(i('i6').perjalanan)}`],
    },
    {
      no: 7,
      judul: 'Keterlibatan pasien dalam kegiatan masyarakat',
      utama: `${f(i('i7').terlibat)}/${f(i('i7').total)} pasien`,
      persen: persen(i('i7').terlibat, i('i7').total),
      rincian: [`Kegiatan dalam periode: ${f(i('i7').kegiatan)}`],
    },
    {
      no: 8,
      judul: 'Koordinasi rutin masyarakat dan Puskesmas (rapat Siaga Kaki)',
      utama: `${f(i('i8').rapat)} rapat`,
      persen: persen(Math.min(i('i8').rapat ?? 0, i('i8').bulan ?? 0), i('i8').bulan),
      rincian: [`Periode: ${f(i('i8').bulan)} bulan`],
      target: 'Minimal 1 rapat per bulan',
    },
  ]
}

const fmtSkor = (x, aspek) => (x === null || x === undefined ? '-' : aspek === 'kualitas_hidup' ? Number(x).toFixed(1) : Number(x).toFixed(2))

export default function Evaluasi() {
  const toast = useToast()
  const peran = usePeran()
  const bolehCatat = useCan('evaluasi.catatan')
  const [periode, setPeriode] = useState('3bulan')
  const [dusun, setDusun] = useState('')
  const [form, setForm] = useState({ open: false, awal: null })
  const [hapus, setHapus] = useState(null)
  const [proses, setProses] = useState(false)
  const [mengekspor, setMengekspor] = useState(null)
  const r = rentang(periode)

  const { data: dusunList } = useLoad(
    () => supabase.from('master_options').select('value').eq('category', 'dusun').eq('active', true).order('sort_order').then(cek),
    [],
  )
  const { data, loading, error } = useLoad(async () => {
    if (!peran.approved) return null
    const [ind, bulanan] = await Promise.all([
      supabase.rpc('evaluation_indicators', { p_from: r.dari, p_to: r.sampai, p_dusun: dusun || null }).then(cek),
      supabase.rpc('evaluation_monthly', { p_months: 6, p_dusun: dusun || null }).then(cek),
    ])
    return { ind, bulanan }
  }, [periode, dusun, peran.approved])
  const catatan = useLoad(
    () => (peran.approved ? supabase.from('evaluation_notes').select('*').order('period_month', { ascending: false }).then(cek) : []),
    [peran.approved],
  )

  const indikator = useMemo(() => (data ? susunIndikator(data.ind) : []), [data])

  const grafik = useMemo(() => {
    if (!data) return null
    const b = data.bulanan
    const label = b.map((x) => `${BULAN[Number(x.bulan.slice(5, 7)) - 1]} ${x.bulan.slice(2, 4)}`)
    const seri = [
      ['Kunjungan pendamping', 'kunjungan', '#9C2457'],
      ['Kartu Kaki Sehat', 'kartu', '#1E5E74'],
      ['Hadir Pos Kaki', 'hadir_pos', '#B45309'],
      ['Ojek Sehat', 'ojek', '#4B5563'],
      ['Ikut kegiatan', 'kegiatan', '#7C3AED'],
    ]
    return {
      labels: label,
      datasets: seri.map(([l, k, c]) => ({ label: l, data: b.map((x) => Number(x[k])), borderColor: c, backgroundColor: c, tension: 0.3, pointRadius: 4, borderWidth: 3 })),
    }
  }, [data])

  async function simpanCatatan(v) {
    const d = { period_month: `${v.period_month}-01`, dusun: v.dusun || null, notes: v.notes.trim(), follow_up_plan: v.follow_up_plan?.trim() || null }
    const { error: err } = form.awal ? await supabase.from('evaluation_notes').update(d).eq('id', form.awal.id) : await supabase.from('evaluation_notes').insert(d)
    if (err) throw new Error(pesanError(err))
    toast.sukses('Catatan evaluasi disimpan.')
    catatan.reload()
  }

  async function hapusCatatan() {
    setProses(true)
    const { error: err } = await supabase.from('evaluation_notes').delete().eq('id', hapus.id)
    setProses(false)
    if (err) return toast.gagal(pesanError(err))
    setHapus(null)
    catatan.reload()
  }

  async function ekspor(jenis) {
    setMengekspor(jenis)
    try {
      const judulPeriode = `${PERIODE[periode].label} (${formatTanggal(r.dari, { weekday: undefined })} - ${formatTanggal(r.sampai, { weekday: undefined })})${dusun ? `, Dusun ${dusun}` : ''}`
      const kolom = [
        { key: 'no', label: 'No' },
        { key: 'judul', label: 'Indikator' },
        { key: 'nilai', label: 'Hasil' },
        { key: 'ket', label: 'Keterangan' },
      ]
      const baris = [
        ...indikator.map((x) => ({ no: x.no, judul: x.judul, nilai: `${x.utama}${x.persen !== null && x.persen !== undefined ? ` (${x.persen}%)` : ''}`, ket: [...(x.rincian ?? []), x.target && `Target: ${x.target}`].filter(Boolean).join('; ') })),
        ...(data.ind.i9 ?? []).map((k) => ({ no: 9, judul: `Skor ${ASPEK_LABEL[k.aspek]} (${INSTRUMEN[k.aspek].nama})`, nilai: `awal ${fmtSkor(k.awal, k.aspek)} -> ulang ${fmtSkor(k.ulang, k.aspek)}`, ket: `n awal ${k.n_awal}, n ulang ${k.n_ulang}` })),
      ]
      const kolBulan = [
        { key: 'bulan', label: 'Bulan' },
        { key: 'kunjungan', label: 'Kunjungan pendamping' },
        { key: 'kartu', label: 'Kartu Kaki Sehat' },
        { key: 'hadir_pos', label: 'Hadir Pos Kaki' },
        { key: 'ojek', label: 'Ojek Sehat' },
        { key: 'kegiatan', label: 'Ikut kegiatan' },
        { key: 'rapat', label: 'Rapat' },
      ]
      const barisBulan = data.bulanan.map((x) => ({ ...x, bulan: `${BULAN[Number(x.bulan.slice(5, 7)) - 1]} ${x.bulan.slice(0, 4)}` }))
      if (jenis === 'excel') {
        await unduhExcel('Evaluasi-Sahabat-Kaki-Desa', [
          { nama: 'Indikator', kolom, baris },
          { nama: 'Per bulan', kolom: kolBulan, baris: barisBulan },
        ])
      } else {
        await unduhPdf('Evaluasi-Sahabat-Kaki-Desa', 'Evaluasi Program Sahabat Kaki Desa', [
          { judul: `Indikator - ${judulPeriode}`, kolom, baris },
          { judul: 'Rekap 6 bulan terakhir', kolom: kolBulan, baris: barisBulan },
        ], { mendatar: true })
      }
    } catch (err) {
      toast.gagal(pesanError(err))
    } finally {
      setMengekspor(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Evaluasi"
        description="Sembilan indikator keberhasilan program. Indikator 1–8 dihitung otomatis dari data, indikator 9 dari skor kuesioner."
        menu="evaluasi"
        actions={
          data && (
            <>
              <Button variant="secondary" size="sm" icon={FileSpreadsheet} loading={mengekspor === 'excel'} onClick={() => ekspor('excel')}>
                Excel
              </Button>
              <Button variant="secondary" size="sm" icon={FileDown} loading={mengekspor === 'pdf'} onClick={() => ekspor('pdf')}>
                PDF
              </Button>
            </>
          )
        }
      />
      {!peran.approved ? (
        <EmptyState icon={ChartColumn} title="Evaluasi tampil setelah akun disetujui" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select label="Periode" value={periode} onChange={(e) => setPeriode(e.target.value)}>
              {Object.entries(PERIODE).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
            <Select label="Dusun" value={dusun} onChange={(e) => setDusun(e.target.value)}>
              <option value="">Semua dusun</option>
              {(dusunList ?? []).map((d) => (
                <option key={d.value} value={d.value}>
                  {d.value}
                </option>
              ))}
            </Select>
          </div>
          {loading && !data ? (
            <Spinner />
          ) : error ? (
            <Banner tone="danger">{error}</Banner>
          ) : (
            <>
              <p className="text-muted">
                {formatTanggal(r.dari, { weekday: undefined })} – {formatTanggal(r.sampai, { weekday: undefined })} · {data.ind.pasien_aktif} pasien aktif
              </p>
              <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {indikator.map((x) => (
                  <KartuIndikator key={x.no} no={x.no} judul={x.judul} utama={x.utama} persenNilai={x.persen} rincian={x.rincian} target={x.target} />
                ))}
                <li className="rounded-card border border-line bg-surface p-4 shadow-card lg:col-span-2">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-white">9</span>
                    <div className="min-w-0 flex-1">
                      <p className="leading-snug font-bold">Perubahan dukungan sosial, kemandirian perawatan diri, dan kualitas hidup (skor kuesioner awal vs ulang)</p>
                      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        {(data.ind.i9 ?? []).map((k) => {
                          const naik = k.awal !== null && k.ulang !== null ? Number(k.ulang) - Number(k.awal) : null
                          return (
                            <div key={k.aspek} className="rounded-field bg-soft/60 p-3">
                              <p className="font-extrabold">{ASPEK_LABEL[k.aspek]}</p>
                              <p className="text-base text-muted">{INSTRUMEN[k.aspek].nama}</p>
                              <p className="mt-1 text-lg">
                                Awal <strong>{fmtSkor(k.awal, k.aspek)}</strong> → Ulang <strong>{fmtSkor(k.ulang, k.aspek)}</strong>
                              </p>
                              {naik !== null && (
                                <p className={`font-bold ${naik > 0 ? 'text-success' : naik < 0 ? 'text-danger' : 'text-muted'}`}>
                                  {naik > 0 ? 'Naik' : naik < 0 ? 'Turun' : 'Tetap'} {naik !== 0 && Math.abs(naik).toFixed(2)}
                                </p>
                              )}
                              <p className="text-base text-muted">
                                {k.n_awal} pasien awal · {k.n_ulang} pasien ulang
                              </p>
                            </div>
                          )
                        })}
                      </div>
                      <p className="mt-2 text-base font-semibold text-muted">Target: skor naik atau minimal tetap</p>
                    </div>
                  </div>
                </li>
              </ul>

              <Card>
                <h2 className="text-xl font-extrabold">Grafik 6 bulan terakhir</h2>
                <div className="mt-3 h-72">
                  <Line
                    data={grafik}
                    aria-label="Grafik kegiatan per bulan"
                    role="img"
                    options={{
                      maintainAspectRatio: false,
                      plugins: { legend: { position: 'bottom', labels: { font: { size: 14, family: 'Nunito' }, boxWidth: 14 } } },
                      scales: { y: { beginAtZero: true, ticks: { precision: 0, font: { size: 14 } } }, x: { ticks: { font: { size: 14 } } } },
                    }}
                  />
                </div>
              </Card>
            </>
          )}

          <section aria-labelledby="catatan-eva" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id="catatan-eva" className="text-xl font-extrabold">
                Catatan evaluasi & rencana tindak lanjut
              </h2>
              {bolehCatat && (
                <Button size="sm" icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
                  Tulis catatan
                </Button>
              )}
            </div>
            {(catatan.data ?? []).length === 0 ? (
              <EmptyState icon={NotebookPen} title="Belum ada catatan evaluasi" />
            ) : (
              <ul className="space-y-3">
                {catatan.data.map((c) => (
                  <li key={c.id} className="rounded-card border border-line bg-surface p-4 shadow-card">
                    <p className="text-base text-muted">
                      {BULAN[Number(c.period_month.slice(5, 7)) - 1]} {c.period_month.slice(0, 4)}
                      {c.dusun ? ` · Dusun ${c.dusun}` : ' · semua dusun'}
                    </p>
                    <p className="mt-1 whitespace-pre-line">{c.notes}</p>
                    {c.follow_up_plan && (
                      <p className="mt-2 whitespace-pre-line">
                        <strong>Rencana tindak lanjut:</strong> {c.follow_up_plan}
                      </p>
                    )}
                    {bolehCatat && (
                      <div className="mt-2 flex justify-end gap-1">
                        <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setForm({ open: true, awal: { ...c, period_month: c.period_month.slice(0, 7), dusun: c.dusun ?? '' } })}>
                          Ubah
                        </Button>
                        <Button size="sm" variant="quiet" icon={Trash2} className="text-danger" onClick={() => setHapus(c)}>
                          Hapus
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      <FormModal
        open={form.open}
        onClose={() => setForm({ open: false, awal: null })}
        title={form.awal ? 'Ubah catatan evaluasi' : 'Catatan evaluasi'}
        fields={[
          { name: 'period_month', label: 'Bulan', type: 'month', required: true },
          { name: 'dusun', label: 'Dusun', type: 'select', hint: 'Kosongkan untuk semua dusun.', options: (dusunList ?? []).map((d) => ({ value: d.value, label: d.value })) },
          { name: 'notes', label: 'Catatan evaluasi', type: 'textarea', required: true, rows: 4 },
          { name: 'follow_up_plan', label: 'Rencana tindak lanjut', type: 'textarea', rows: 3 },
        ]}
        initial={form.awal ?? { period_month: hariIniWIB().slice(0, 7) }}
        onSubmit={simpanCatatan}
      />
      <ConfirmDialog
        open={Boolean(hapus)}
        onClose={() => setHapus(null)}
        onConfirm={hapusCatatan}
        loading={proses}
        danger
        title="Hapus catatan?"
        message="Catatan evaluasi ini akan dihapus."
        confirmLabel="Ya, hapus"
      />
    </div>
  )
}
