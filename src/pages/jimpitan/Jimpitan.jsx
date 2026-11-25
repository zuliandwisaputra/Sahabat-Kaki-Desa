import { useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, Bike, FileText, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { cek, useLoad } from '../../lib/useLoad'
import { pesanError } from '../../lib/errors'
import { signedUrl } from '../../lib/storage'
import { formatRupiah, formatTanggalPendek, hariIniWIB } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { Can, useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Badge, Banner, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'
import { FundForm } from './FundForm'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const labelBulan = (ym) => `${NAMA_BULAN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

// JIM-04: saldo berjalan & laporan bulanan bisa dilihat semua peran (transparan).
// JIM-05: hanya pencatatan, tidak ada transfer uang.
export default function Jimpitan() {
  const toast = useToast()
  const bolehCatat = useCan('jimpitan.catat')
  const [bulan, setBulan] = useState(hariIniWIB().slice(0, 7))
  const [form, setForm] = useState({ open: false, awal: null })
  const [hapus, setHapus] = useState(null)
  const [proses, setProses] = useState(false)

  const { data, loading, error, reload } = useLoad(
    () => supabase.from('funds').select('*').order('trx_date', { ascending: false }).order('created_at', { ascending: false }).then(cek),
    [],
  )

  const olah = useMemo(() => {
    const rows = data ?? []
    const per = {}
    for (const f of rows) {
      const ym = f.trx_date.slice(0, 7)
      per[ym] ??= { masuk: 0, keluar: 0 }
      per[ym][f.trx_type] += Number(f.amount)
    }
    const urut = Object.keys(per).sort()
    let saldo = 0
    const laporan = urut.map((ym) => {
      saldo += per[ym].masuk - per[ym].keluar
      return { ym, ...per[ym], saldo }
    })
    return {
      saldo,
      laporan: laporan.reverse(),
      bulanList: [...new Set([hariIniWIB().slice(0, 7), ...urut])].sort().reverse(),
      transaksi: rows.filter((f) => f.trx_date.startsWith(bulan)),
      bulanIni: per[bulan] ?? { masuk: 0, keluar: 0 },
    }
  }, [data, bulan])

  async function bukaBukti(path) {
    const url = await signedUrl('fund-proofs', path, 300)
    if (url) window.open(url, '_blank', 'noopener')
    else toast.gagal('Bukti tidak bisa dibuka.')
  }

  async function konfirmasiHapus() {
    setProses(true)
    const { error: err } = await supabase.from('funds').delete().eq('id', hapus.id)
    setProses(false)
    if (err) return toast.gagal(pesanError(err))
    if (hapus.proof_path) await supabase.storage.from('fund-proofs').remove([hapus.proof_path])
    toast.sukses('Transaksi dihapus.')
    setHapus(null)
    reload()
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Jimpitan Sehat"
        description="Dana gotong royong warga untuk Ojek Sehat, Pos Kaki, dan pelatihan kader. Hanya pencatatan, tanpa transfer uang."
        menu="jimpitan"
        actions={
          <Can do="jimpitan.catat">
            <Button icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
              Catat transaksi
            </Button>
          </Can>
        }
      />

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <Banner tone="danger">{error}</Banner>
      ) : (
        <>
          <section className="rounded-card bg-primary p-5 text-white shadow-button">
            <p className="flex items-center gap-2 font-semibold text-white/90">
              <Wallet aria-hidden="true" className="size-6" /> Saldo Jimpitan saat ini
            </p>
            <p className="mt-1 text-[34px] leading-tight font-extrabold">{formatRupiah(olah.saldo)}</p>
          </section>

          <div className="flex flex-wrap items-end gap-3">
            <Select label="Bulan" value={bulan} onChange={(e) => setBulan(e.target.value)} className="min-w-56">
              {olah.bulanList.map((ym) => (
                <option key={ym} value={ym}>
                  {labelBulan(ym)}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="flex items-center gap-1 font-bold text-success">
                <ArrowDownLeft aria-hidden="true" className="size-5" /> Pemasukan
              </p>
              <p className="text-xl font-extrabold">{formatRupiah(olah.bulanIni.masuk)}</p>
            </div>
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="flex items-center gap-1 font-bold text-danger">
                <ArrowUpRight aria-hidden="true" className="size-5" /> Pengeluaran
              </p>
              <p className="text-xl font-extrabold">{formatRupiah(olah.bulanIni.keluar)}</p>
            </div>
          </div>

          <section aria-labelledby="transaksi">
            <h2 id="transaksi" className="mb-3 text-xl font-extrabold">
              Transaksi {labelBulan(bulan)}
            </h2>
            {olah.transaksi.length === 0 ? (
              <EmptyState icon={Wallet} title="Belum ada transaksi bulan ini" />
            ) : (
              <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                {olah.transaksi.map((f) => (
                  <li key={f.id} className="border-b border-line px-4 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-base text-muted">
                          {formatTanggalPendek(f.trx_date)} · {f.category}
                        </p>
                        <p className="font-bold">{f.description}</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {f.ride_id && (
                            <Badge tone="primary" icon={Bike}>
                              Ojek Sehat
                            </Badge>
                          )}
                          {f.proof_path && (
                            <button type="button" onClick={() => bukaBukti(f.proof_path)} className="inline-flex min-h-9 items-center gap-1 font-bold text-primary underline underline-offset-4">
                              <FileText aria-hidden="true" className="size-5" /> Lihat bukti
                            </button>
                          )}
                        </div>
                      </div>
                      <p className={`shrink-0 text-lg font-extrabold ${f.trx_type === 'masuk' ? 'text-success' : 'text-danger'}`}>
                        {f.trx_type === 'masuk' ? '+' : '−'}
                        {formatRupiah(f.amount)}
                      </p>
                    </div>
                    {bolehCatat && (
                      <div className="mt-1 flex justify-end gap-1">
                        <Button size="sm" variant="quiet" icon={Pencil} onClick={() => setForm({ open: true, awal: f })}>
                          Ubah
                        </Button>
                        <Button size="sm" variant="quiet" icon={Trash2} className="text-danger" onClick={() => setHapus(f)}>
                          Hapus
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="laporan">
            <h2 id="laporan" className="mb-3 text-xl font-extrabold">
              Laporan bulanan
            </h2>
            {olah.laporan.length === 0 ? (
              <EmptyState icon={FileText} title="Belum ada laporan" />
            ) : (
              <ul className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                {olah.laporan.map((l) => (
                  <li key={l.ym} className="border-b border-line px-4 py-3 last:border-0">
                    <p className="font-extrabold">{labelBulan(l.ym)}</p>
                    <dl className="mt-1 grid grid-cols-3 gap-2">
                      <div>
                        <dt className="text-base text-muted">Masuk</dt>
                        <dd className="font-bold text-success">{formatRupiah(l.masuk)}</dd>
                      </div>
                      <div>
                        <dt className="text-base text-muted">Keluar</dt>
                        <dd className="font-bold text-danger">{formatRupiah(l.keluar)}</dd>
                      </div>
                      <div>
                        <dt className="text-base text-muted">Saldo akhir</dt>
                        <dd className="font-extrabold">{formatRupiah(l.saldo)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <FundForm open={form.open} awal={form.awal} onClose={() => setForm({ open: false, awal: null })} onSaved={reload} />
      <ConfirmDialog
        open={Boolean(hapus)}
        onClose={() => setHapus(null)}
        onConfirm={konfirmasiHapus}
        loading={proses}
        danger
        title="Hapus transaksi?"
        message={hapus ? `${hapus.description} (${formatRupiah(hapus.amount)}) akan dihapus dan saldo dihitung ulang.` : ''}
        confirmLabel="Ya, hapus"
      />
    </div>
  )
}
