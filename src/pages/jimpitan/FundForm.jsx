import { useEffect, useRef, useState } from 'react'
import { FileUp, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { unggahBukti } from '../../lib/storage'
import { pesanError } from '../../lib/errors'
import { formatRupiah, formatTanggalPendek, hariIniWIB } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { FormModal } from '../../components/ui/FormModal'

const TUJUAN = { pos_kaki: 'Pos Kaki', puskesmas: 'Puskesmas', rumah_sakit: 'Rumah sakit', lainnya: 'Lainnya' }

/**
 * JIM-01/02/03: catat pemasukan/pengeluaran Jimpitan Sehat, dengan bukti, dan
 * (untuk Ojek Sehat) kaitan ke satu pemesanan transportasi.
 * preset: nilai awal, mis. dari pemesanan Ojek Sehat yang selesai.
 */
export function FundForm({ open, onClose, awal, preset, onSaved }) {
  const toast = useToast()
  const [kategori, setKategori] = useState({ masuk: [], keluar: [] })
  const [rides, setRides] = useState([])
  const [bukti, setBukti] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setBukti(null)
    Promise.all([
      supabase.from('master_options').select('category, value').in('category', ['kategori_pemasukan', 'kategori_pengeluaran']).eq('active', true).order('sort_order'),
      supabase.from('rides').select('id, scheduled_at, destination, estimated_cost, status').neq('status', 'batal').order('scheduled_at', { ascending: false }).limit(100),
      supabase.from('funds').select('ride_id').not('ride_id', 'is', null),
    ]).then(([k, r, f]) => {
      const rows = k.data ?? []
      setKategori({
        masuk: rows.filter((x) => x.category === 'kategori_pemasukan').map((x) => x.value),
        keluar: rows.filter((x) => x.category === 'kategori_pengeluaran').map((x) => x.value),
      })
      const dipakai = new Set((f.data ?? []).map((x) => x.ride_id))
      setRides((r.data ?? []).filter((x) => !dipakai.has(x.id) || x.id === awal?.ride_id || x.id === preset?.ride_id))
    })
  }, [open, awal?.ride_id, preset?.ride_id])

  const initial = awal
    ? { ...awal, amount: String(awal.amount), ride_id: awal.ride_id ?? '' }
    : { trx_type: 'masuk', trx_date: hariIniWIB(), ...preset }

  const fields = [
    { name: 'trx_type', label: 'Jenis', type: 'radio', required: true, options: { masuk: 'Pemasukan', keluar: 'Pengeluaran' } },
    {
      name: 'category',
      label: 'Kategori',
      type: 'select',
      required: true,
      options: (v) => (v.trx_type === 'keluar' ? kategori.keluar : kategori.masuk).map((x) => ({ value: x, label: x })),
      hint: 'Pemasukan: iuran warga, APBDes, donasi. Pengeluaran: Ojek Sehat, operasional Pos Kaki, pelatihan kader.',
    },
    { name: 'amount', label: 'Nominal (Rp)', type: 'number', required: true, placeholder: 'Contoh: 15000' },
    { name: 'trx_date', label: 'Tanggal', type: 'date', required: true },
    {
      name: 'description',
      label: 'Keterangan',
      type: 'textarea',
      required: true,
      rows: 2,
      hint: 'Jangan menulis nama atau data pribadi pasien. Contoh: "Ojek Sehat ke Pos Kaki 3 Des".',
    },
    {
      name: 'ride_id',
      label: 'Terkait pemesanan Ojek Sehat',
      type: 'select',
      show: (v) => v.trx_type === 'keluar',
      hint: 'Opsional. Satu pemesanan hanya bisa dicatat sekali.',
      options: rides.map((r) => ({
        value: r.id,
        label: `${formatTanggalPendek(r.scheduled_at)} · ke ${TUJUAN[r.destination]}${r.estimated_cost ? ` · ±${formatRupiah(r.estimated_cost)}` : ''} (${r.status})`,
      })),
    },
  ]

  async function simpan(v) {
    const nominal = Number(String(v.amount).replace(/[^0-9]/g, ''))
    if (!nominal) throw new Error('Nominal harus lebih dari 0.')
    let proof_path = awal?.proof_path ?? null
    try {
      if (bukti) proof_path = await unggahBukti(bukti)
    } catch (err) {
      throw new Error(`Bukti gagal diunggah: ${pesanError(err)}`)
    }
    const data = {
      trx_type: v.trx_type,
      category: v.category,
      amount: nominal,
      trx_date: v.trx_date,
      description: v.description.trim(),
      proof_path,
      ride_id: v.trx_type === 'keluar' && v.ride_id ? v.ride_id : null,
    }
    const { error } = awal ? await supabase.from('funds').update(data).eq('id', awal.id) : await supabase.from('funds').insert(data)
    if (error) {
      if (error.code === '23505') throw new Error('Pemesanan Ojek Sehat ini sudah tercatat di Jimpitan.')
      throw new Error(pesanError(error))
    }
    if (bukti && awal?.proof_path) await supabase.storage.from('fund-proofs').remove([awal.proof_path])
    toast.sukses(awal ? 'Transaksi diperbarui.' : 'Transaksi dicatat.')
    onSaved?.()
  }

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={awal ? 'Ubah transaksi' : 'Catat transaksi Jimpitan'}
      fields={fields}
      initial={initial}
      onSubmit={simpan}
      validate={(v) => (v.trx_date > hariIniWIB() ? { trx_date: 'Tanggal tidak boleh setelah hari ini.' } : {})}
    >
      {() => (
        <div>
          <p className="font-bold">Foto/PDF bukti (opsional)</p>
          <p className="text-base text-muted">Nota, kuitansi, atau foto serah terima. Maksimal 2 MB.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex min-h-13 items-center gap-2 rounded-field border-2 border-dashed border-primary/50 px-5 font-bold text-primary hover:bg-soft"
            >
              <FileUp aria-hidden="true" className="size-6" /> {bukti || awal?.proof_path ? 'Ganti bukti' : 'Pilih bukti'}
            </button>
            {bukti && (
              <span className="inline-flex items-center gap-2 rounded-full bg-soft px-3 py-1 font-semibold">
                {bukti.name}
                <button type="button" aria-label="Hapus pilihan bukti" onClick={() => setBukti(null)} className="grid size-8 place-items-center rounded-full hover:bg-primary-soft">
                  <X aria-hidden="true" className="size-4" />
                </button>
              </span>
            )}
            {!bukti && awal?.proof_path && <span className="text-muted">Bukti sudah ada.</span>}
            <input ref={fileRef} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={(e) => { setBukti(e.target.files?.[0] ?? null); e.target.value = '' }} />
          </div>
        </div>
      )}
    </FormModal>
  )
}
