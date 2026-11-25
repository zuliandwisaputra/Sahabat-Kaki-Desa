import { useCallback, useEffect, useState } from 'react'
import { BookOpen, Megaphone, Pencil, Pin, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { formatTanggalPendek } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { Can, useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Select, TextInput, Textarea } from '../../components/ui/Field'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Badge, EmptyState, Spinner } from '../../components/ui/misc'

const KATEGORI = {
  pengumuman: 'Pengumuman desa',
  edukasi: 'Edukasi kaki',
  anti_stigma: 'Anti-stigma',
  duta_kaki_sehat: 'Duta Kaki Sehat',
}

const TABS = [
  { key: 'pengumuman', label: 'Pengumuman', kategori: ['pengumuman'] },
  { key: 'edukasi', label: 'Edukasi', kategori: ['edukasi'] },
  { key: 'anti_stigma', label: 'Anti-stigma', kategori: ['anti_stigma', 'duta_kaki_sehat'] },
]

const KOSONG = { title: '', body: '', category: 'pengumuman', pinned: false }

function ArtikelForm({ open, onClose, awal, onSaved, kategoriBaru = 'pengumuman' }) {
  const toast = useToast()
  const [form, setForm] = useState(KOSONG)
  const [errors, setErrors] = useState({})
  const [simpan, setSimpan] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(awal ? { title: awal.title, body: awal.body, category: awal.category, pinned: awal.pinned } : { ...KOSONG, category: kategoriBaru })
      setErrors({})
    }
  }, [open, awal, kategoriBaru])

  async function onSubmit(e) {
    e.preventDefault()
    const er = {}
    if (form.title.trim().length < 3) er.title = 'Tulis judul (minimal 3 huruf).'
    if (form.body.trim().length < 10) er.body = 'Tulis isi (minimal 10 huruf).'
    setErrors(er)
    if (Object.keys(er).length) return
    setSimpan(true)
    const data = { title: form.title.trim(), body: form.body.trim(), category: form.category, pinned: form.pinned }
    const { error } = awal
      ? await supabase.from('articles').update(data).eq('id', awal.id)
      : await supabase.from('articles').insert(data)
    setSimpan(false)
    if (error) return toast.gagal(pesanError(error))
    toast.sukses(awal ? 'Perubahan disimpan.' : 'Tulisan diterbitkan.')
    onSaved(data.category)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={awal ? 'Ubah tulisan' : 'Tulis pengumuman / artikel'}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={simpan}>
            Batal
          </Button>
          <Button type="submit" form="form-artikel" loading={simpan}>
            Simpan
          </Button>
        </>
      }
    >
      <form id="form-artikel" onSubmit={onSubmit} noValidate className="space-y-5">
        <Select label="Jenis" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
          {Object.entries(KATEGORI).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </Select>
        <TextInput
          label="Judul"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          error={errors.title}
          required
        />
        <Textarea
          label="Isi"
          rows={8}
          hint="Pakai bahasa sederhana. Jangan menulis nama atau data pribadi pasien."
          value={form.body}
          onChange={(e) => setForm({ ...form, body: e.target.value })}
          error={errors.body}
          required
        />
        <label className="flex min-h-12 cursor-pointer items-center gap-3 font-bold">
          <input
            type="checkbox"
            checked={form.pinned}
            onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
            className="size-6 accent-primary"
          />
          Sematkan di paling atas
        </label>
      </form>
    </Modal>
  )
}

function ArtikelItem({ a, bolehUbah, onEdit, onDelete }) {
  const [buka, setBuka] = useState(false)
  const panjang = a.body.length > 220
  return (
    <article className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={a.category === 'pengumuman' ? 'primary' : 'neutral'}>{KATEGORI[a.category]}</Badge>
        {a.pinned && (
          <Badge tone="warning" icon={Pin}>
            Disematkan
          </Badge>
        )}
        <span className="text-base text-muted">{formatTanggalPendek(a.created_at)}</span>
      </div>
      <h3 className="mt-2 text-xl leading-snug font-extrabold">{a.title}</h3>
      <p className={`mt-1 whitespace-pre-line ${!buka && panjang ? 'line-clamp-4' : ''}`}>{a.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {panjang && (
          <button
            type="button"
            onClick={() => setBuka((v) => !v)}
            aria-expanded={buka}
            className="min-h-11 font-bold text-primary underline underline-offset-4"
          >
            {buka ? 'Tutup' : 'Baca selengkapnya'}
          </button>
        )}
        {bolehUbah && (
          <div className="ml-auto flex gap-1">
            <Button variant="quiet" size="sm" icon={Pencil} onClick={() => onEdit(a)}>
              Ubah
            </Button>
            <Button variant="quiet" size="sm" icon={Trash2} onClick={() => onDelete(a)} className="text-danger">
              Hapus
            </Button>
          </div>
        )}
      </div>
    </article>
  )
}

/** HOME-03 & HOME-04: pengumuman desa dan artikel edukasi kesehatan kaki */
export function ArtikelSection({ hanyaTab, judul = 'Info & edukasi', kategoriBaru = 'pengumuman' } = {}) {
  const toast = useToast()
  const bolehUbah = useCan('beranda.artikel')
  const tabs = hanyaTab ? TABS.filter((t) => hanyaTab.includes(t.key)) : TABS
  const [tab, setTab] = useState(tabs[0].key)
  const [items, setItems] = useState(null)
  const [form, setForm] = useState({ open: false, awal: null })
  const [hapus, setHapus] = useState(null)
  const [menghapus, setMenghapus] = useState(false)

  const muat = useCallback(async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(60)
    if (error) toast.gagal(pesanError(error))
    setItems(data ?? [])
  }, [toast])

  useEffect(() => {
    muat()
  }, [muat])

  async function konfirmasiHapus() {
    setMenghapus(true)
    const { error } = await supabase.from('articles').delete().eq('id', hapus.id)
    setMenghapus(false)
    if (error) return toast.gagal(pesanError(error))
    toast.sukses('Tulisan dihapus.')
    setHapus(null)
    muat()
  }

  const aktif = tabs.find((t) => t.key === tab) ?? tabs[0]
  const daftar = (items ?? []).filter((a) => aktif.kategori.includes(a.category))

  return (
    <section aria-labelledby="info-desa">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="info-desa" className="text-xl font-extrabold">
          {judul}
        </h2>
        <Can do="beranda.artikel">
          <Button size="sm" icon={Plus} onClick={() => setForm({ open: true, awal: null })}>
            Tulis
          </Button>
        </Can>
      </div>

      <div role="tablist" aria-label="Jenis tulisan" className={`mb-4 flex flex-wrap gap-2 ${tabs.length < 2 ? 'hidden' : ''}`}>
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`min-h-11 shrink-0 rounded-full border-2 px-4 font-bold transition-colors ${
              tab === t.key ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink hover:bg-soft'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {items === null ? (
        <Spinner />
      ) : daftar.length === 0 ? (
        <EmptyState icon={tab === 'pengumuman' ? Megaphone : BookOpen} title="Belum ada tulisan">
          {bolehUbah ? 'Tekan tombol "Tulis" untuk menambahkan.' : 'Nantikan informasi dari kader dan perawat.'}
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {daftar.map((a) => (
            <ArtikelItem
              key={a.id}
              a={a}
              bolehUbah={bolehUbah}
              onEdit={(x) => setForm({ open: true, awal: x })}
              onDelete={setHapus}
            />
          ))}
        </div>
      )}

      <ArtikelForm
        open={form.open}
        awal={form.awal}
        kategoriBaru={kategoriBaru}
        onClose={() => setForm({ open: false, awal: null })}
        onSaved={(kategori) => {
          setTab(tabs.find((t) => t.kategori.includes(kategori))?.key ?? tab)
          muat()
        }}
      />
      <ConfirmDialog
        open={Boolean(hapus)}
        onClose={() => setHapus(null)}
        onConfirm={konfirmasiHapus}
        loading={menghapus}
        danger
        title="Hapus tulisan?"
        message={hapus ? `"${hapus.title}" akan dihapus dan tidak bisa dikembalikan.` : ''}
        confirmLabel="Ya, hapus"
      />
    </section>
  )
}
