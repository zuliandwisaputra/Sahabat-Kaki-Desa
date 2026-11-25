import { useEffect, useMemo, useState } from 'react'
import { Link2, Unlink } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { useToast } from '../../context/ToastContext'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/misc'
import { KotakCari } from '../../components/ui/extra'

// AUTH-04: Perawat/Kader/Admin menghubungkan akun Pasien/Keluarga ke data pasien
export function HubungkanAkun({ open, onClose, pasien, onSaved }) {
  const toast = useToast()
  const [akun, setAkun] = useState(null)
  const [cari, setCari] = useState('')
  const [proses, setProses] = useState(null)

  useEffect(() => {
    if (!open) return
    setAkun(null)
    setCari('')
    supabase
      .from('profiles')
      .select('id, full_name, username, phone, patient_id')
      .eq('role', 'pasien')
      .eq('approval_status', 'disetujui')
      .order('full_name')
      .then(({ data }) => setAkun(data ?? []))
  }, [open])

  const daftar = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return (akun ?? [])
      .filter((a) => !q || [a.full_name, a.username, a.phone].some((s) => String(s ?? '').toLowerCase().includes(q)))
      .sort((a, b) => Number(b.patient_id === pasien?.id) - Number(a.patient_id === pasien?.id))
  }, [akun, cari, pasien?.id])

  async function ubah(a, hubungkan) {
    setProses(a.id)
    const { error } = await supabase.rpc('link_patient_account', {
      p_profile: a.id,
      p_patient: hubungkan ? pasien.id : null,
    })
    setProses(null)
    if (error) return toast.gagal(pesanError(error))
    toast.sukses(hubungkan ? `Akun ${a.full_name} terhubung ke ${pasien.full_name}.` : `Akun ${a.full_name} diputus.`)
    setAkun((list) => list.map((x) => (x.id === a.id ? { ...x, patient_id: hubungkan ? pasien.id : null } : x)))
    onSaved?.()
  }

  return (
    <Modal open={open} onClose={onClose} title="Hubungkan akun keluarga" wide>
      {pasien && (
        <div className="space-y-4">
          <p className="text-lg">
            Pilih akun Pasien/Keluarga untuk <strong>{pasien.full_name}</strong>. Akun yang terhubung bisa melihat riwayat
            perawatan dan mengisi identitas pasien ini.
          </p>
          <KotakCari value={cari} onChange={setCari} placeholder="Cari nama atau username" />
          {akun === null ? (
            <Spinner />
          ) : daftar.length === 0 ? (
            <p className="text-muted">
              Tidak ada akun Pasien/Keluarga. Minta pasien atau keluarganya mendaftar dulu dengan peran
              "Pasien/Keluarga".
            </p>
          ) : (
            <ul className="divide-y divide-line rounded-field border border-line">
              {daftar.map((a) => {
                const diSini = a.patient_id === pasien.id
                const diLain = a.patient_id && !diSini
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold">{a.full_name}</span>
                      <span className="block text-muted">
                        @{a.username}
                        {diSini && ' · terhubung ke pasien ini'}
                        {diLain && ' · sudah terhubung ke pasien lain'}
                      </span>
                    </span>
                    {diSini ? (
                      <Button size="sm" variant="secondary" icon={Unlink} loading={proses === a.id} onClick={() => ubah(a, false)}>
                        Putuskan
                      </Button>
                    ) : (
                      <Button size="sm" icon={Link2} loading={proses === a.id} onClick={() => ubah(a, true)}>
                        {diLain ? 'Pindahkan ke sini' : 'Hubungkan'}
                      </Button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}
