import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Search, UserCog, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { formatTanggalPendek } from '../../lib/format'
import { ROLE_LABELS } from '../../lib/permissions'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Field'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Badge, EmptyState, PageHeader, Spinner } from '../../components/ui/misc'

const STATUS = {
  menunggu: { tone: 'warning', text: 'Menunggu persetujuan' },
  disetujui: { tone: 'success', text: 'Aktif' },
  ditolak: { tone: 'danger', text: 'Tidak disetujui' },
}

const FILTER = [
  { key: 'menunggu', label: 'Menunggu' },
  { key: 'semua', label: 'Semua' },
  { key: 'perawat', label: 'Perawat' },
  { key: 'kader', label: 'Kader' },
  { key: 'pasien', label: 'Pasien/Keluarga' },
  { key: 'desa', label: 'Perangkat Desa' },
  { key: 'admin', label: 'Admin' },
]

function AkunItem({ a, bolehUbah, diriSendiri, onAksi }) {
  const [peran, setPeran] = useState(a.role)
  useEffect(() => setPeran(a.role), [a.role])
  const st = STATUS[a.approval_status]

  return (
    <li className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg leading-snug font-extrabold">
            {a.full_name} {diriSendiri && <span className="font-semibold text-muted">(Anda)</span>}
          </p>
          <p className="break-all text-muted">
            @{a.username} · {a.email}
          </p>
          {a.phone && <p className="text-muted">HP {a.phone}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="primary">{ROLE_LABELS[a.role]}</Badge>
          <Badge tone={st.tone}>{st.text}</Badge>
        </div>
      </div>
      <p className="mt-1 text-base text-muted">
        Mendaftar {formatTanggalPendek(a.created_at)}
        {a.role === 'pasien' && (a.patient_name ? ` · terhubung ke ${a.patient_name}` : ' · belum terhubung ke pasien')}
      </p>

      {bolehUbah && !diriSendiri && (
        <div className="mt-4 space-y-3 border-t border-line pt-4">
          {a.approval_status !== 'disetujui' && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={Check} onClick={() => onAksi(a, { status: 'disetujui' })}>
                Setujui
              </Button>
              {a.approval_status === 'menunggu' && (
                <Button
                  size="sm"
                  variant="secondary"
                  icon={X}
                  onClick={() => onAksi(a, { status: 'ditolak' })}
                  className="border-danger! text-danger"
                >
                  Tolak
                </Button>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <Select label="Peran" value={peran} onChange={(e) => setPeran(e.target.value)} className="min-w-56 flex-1">
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              variant="secondary"
              icon={UserCog}
              disabled={peran === a.role}
              onClick={() => onAksi(a, { role: peran })}
              className="min-h-13"
            >
              Ubah peran
            </Button>
          </div>
          {a.approval_status === 'disetujui' && a.role !== 'pasien' && (
            <button
              type="button"
              onClick={() => onAksi(a, { status: 'ditolak' })}
              className="min-h-11 font-bold text-danger underline underline-offset-4"
            >
              Nonaktifkan akun
            </button>
          )}
        </div>
      )}
    </li>
  )
}

// Kelola Akun: Admin = edit, Perawat = lihat (PRD bagian 4)
export default function KelolaAkun() {
  const { profile } = useAuth()
  const toast = useToast()
  const bolehUbah = useCan('akun.kelola')
  const [akun, setAkun] = useState(null)
  const [filter, setFilter] = useState('menunggu')
  const [cari, setCari] = useState('')
  const [konfirmasi, setKonfirmasi] = useState(null) // { akun, aksi }
  const [proses, setProses] = useState(false)

  const muat = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_accounts')
    if (error) {
      toast.gagal(pesanError(error))
      setAkun([])
      return
    }
    setAkun(data ?? [])
  }, [toast])

  useEffect(() => {
    muat()
  }, [muat])

  const jumlahMenunggu = (akun ?? []).filter((a) => a.approval_status === 'menunggu').length

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return (akun ?? []).filter((a) => {
      if (filter === 'menunggu' && a.approval_status !== 'menunggu') return false
      if (!['menunggu', 'semua'].includes(filter) && a.role !== filter) return false
      if (!q) return true
      return [a.full_name, a.username, a.email].some((s) => String(s ?? '').toLowerCase().includes(q))
    })
  }, [akun, filter, cari])

  async function jalankan() {
    const { akun: a, aksi } = konfirmasi
    setProses(true)
    const { error } = await supabase.rpc('admin_update_account', {
      p_user: a.id,
      p_role: aksi.role ?? null,
      p_status: aksi.status ?? null,
    })
    setProses(false)
    setKonfirmasi(null)
    if (error) return toast.gagal(pesanError(error))
    toast.sukses(
      aksi.role
        ? `Peran ${a.full_name} diubah menjadi ${ROLE_LABELS[aksi.role]}.`
        : aksi.status === 'disetujui'
          ? `Akun ${a.full_name} disetujui.`
          : `Akun ${a.full_name} tidak disetujui.`,
    )
    muat()
  }

  const pesanKonfirmasi = (() => {
    if (!konfirmasi) return ''
    const { akun: a, aksi } = konfirmasi
    if (aksi.role) return `Ubah peran ${a.full_name} dari ${ROLE_LABELS[a.role]} menjadi ${ROLE_LABELS[aksi.role]}?`
    if (aksi.status === 'disetujui') return `Setujui ${a.full_name} sebagai ${ROLE_LABELS[a.role]}? Akun ini akan bisa menambah dan mengubah data sesuai perannya.`
    return `${a.full_name} tidak akan bisa mengubah data apa pun. Lanjutkan?`
  })()

  return (
    <div>
      <PageHeader
        title="Kelola Akun"
        description="Setujui pendaftaran Perawat, Kader, dan Perangkat Desa, serta atur peran akun."
        menu="kelola-akun"
      />

      <div className="mb-4 space-y-3">
        <label className="relative block">
          <span className="sr-only">Cari nama, username, atau email</span>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder="Cari nama atau username"
            className="min-h-13 w-full rounded-field border-2 border-line bg-surface pr-4 pl-13 text-lg focus:border-primary focus:ring-4 focus:ring-primary-soft focus:outline-none"
          />
        </label>
        <div role="tablist" aria-label="Saring akun" className="flex flex-wrap gap-2">
          {FILTER.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`min-h-11 shrink-0 rounded-full border-2 px-4 font-bold transition-colors ${
                filter === f.key ? 'border-primary bg-primary text-white' : 'border-line bg-surface hover:bg-soft'
              }`}
            >
              {f.label}
              {f.key === 'menunggu' && jumlahMenunggu > 0 ? ` (${jumlahMenunggu})` : ''}
            </button>
          ))}
        </div>
      </div>

      {akun === null ? (
        <Spinner />
      ) : daftar.length === 0 ? (
        <EmptyState icon={UserCog} title={filter === 'menunggu' ? 'Tidak ada akun yang menunggu' : 'Tidak ada akun'}>
          {filter === 'menunggu' ? 'Semua pendaftaran sudah diproses.' : 'Coba ubah pencarian atau saringan.'}
        </EmptyState>
      ) : (
        <ul className="space-y-4">
          {daftar.map((a) => (
            <AkunItem
              key={a.id}
              a={a}
              bolehUbah={bolehUbah}
              diriSendiri={a.id === profile.id}
              onAksi={(akunDipilih, aksi) => setKonfirmasi({ akun: akunDipilih, aksi })}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(konfirmasi)}
        onClose={() => setKonfirmasi(null)}
        onConfirm={jalankan}
        loading={proses}
        danger={konfirmasi?.aksi.status === 'ditolak'}
        title={konfirmasi?.aksi.role ? 'Ubah peran?' : konfirmasi?.aksi.status === 'disetujui' ? 'Setujui akun?' : 'Tolak / nonaktifkan akun?'}
        message={pesanKonfirmasi}
        confirmLabel={konfirmasi?.aksi.status === 'ditolak' ? 'Ya, tolak' : 'Ya, lanjutkan'}
      />
    </div>
  )
}
