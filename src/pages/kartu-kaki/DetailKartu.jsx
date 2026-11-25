import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CheckCheck, ClipboardList, Pencil, Printer, Send, Stethoscope, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { cek, useLoad } from '../../lib/useLoad'
import { formatTanggal, formatTanggalPendek, waktuRelatif } from '../../lib/format'
import { alamatSingkat, PERUBAHAN, satuPenilaian, TANDA, umur } from '../../lib/pasien'
import { cetakKartuKaki } from '../../lib/pdfKartu'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Textarea } from '../../components/ui/Field'
import { ConfirmDialog, Modal } from '../../components/ui/Modal'
import { Badge, Banner, Card, CodeBadge, EmptyState, KODE_WARNA, Spinner } from '../../components/ui/misc'
import { GambarPrivat, Info, LangkahKartu, StatusKartuBadge } from '../../components/ui/extra'
import { PenilaianForm } from './PenilaianForm'

function PanelKode({ penilaian }) {
  const k = penilaian ? KODE_WARNA[penilaian.color_code] : null
  if (!k) {
    return (
      <div className="flex gap-3 rounded-card border-2 border-dashed border-line bg-surface p-4">
        <Stethoscope aria-hidden="true" className="mt-0.5 size-7 shrink-0 text-muted" />
        <div>
          <p className="text-xl font-extrabold">Belum dinilai perawat</p>
          <p className="text-muted">Kode warna dan arahan akan muncul setelah perawat menilai kartu ini.</p>
        </div>
      </div>
    )
  }
  const Icon = k.icon
  return (
    <div className={`flex gap-3 rounded-card border-2 p-4 ${k.cls}`} role="status">
      <Icon aria-hidden="true" className="mt-0.5 size-8 shrink-0" />
      <div>
        <p className="text-xl font-extrabold">
          {k.label} · {k.judul}
        </p>
        <p className="font-semibold">{k.arti}</p>
      </div>
    </div>
  )
}

function TindakLanjutForm({ open, onClose, onSimpan, loading }) {
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tandai sudah ditindaklanjuti"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Batal
          </Button>
          <Button
            icon={CheckCheck}
            loading={loading}
            onClick={() => {
              if (catatan.trim().length < 3) return setError('Tulis apa yang sudah dilakukan.')
              onSimpan(catatan.trim())
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <Textarea
        label="Apa yang sudah dilakukan?"
        hint="Contoh: pasien sudah diantar ke Pos Kaki dengan Ojek Sehat, luka dibersihkan perawat."
        rows={4}
        value={catatan}
        onChange={(e) => {
          setCatatan(e.target.value)
          setError('')
        }}
        error={error}
      />
    </Modal>
  )
}

export default function DetailKartu() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { profile, approved } = useAuth()
  const role = profile.role
  const klinis = approved && ['perawat', 'kader', 'admin'].includes(role)
  const desa = approved && role === 'desa'
  const pasienRole = approved && role === 'pasien'
  const bolehCatat = useCan('kartu.catat')
  const bolehKode = useCan('kartu.kode-warna')
  const bolehTindak = useCan('kartu.tindak-lanjut')
  const [modal, setModal] = useState(null) // 'nilai' | 'tindak' | 'hapus'
  const [proses, setProses] = useState(false)
  const [mencetak, setMencetak] = useState(false)

  const { data, loading, error, reload } = useLoad(async () => {
    if (desa) {
      const ringkas = await supabase.from('foot_card_summary').select('*').eq('id', id).maybeSingle().then(cek)
      const pasien = ringkas
        ? await supabase.from('patient_directory').select('*').eq('id', ringkas.patient_id).maybeSingle().then(cek)
        : null
      return { ringkas, pasien }
    }
    if (!klinis && !pasienRole) return null
    const kartu = await supabase.from('foot_visits').select('*, assessments(*)').eq('id', id).maybeSingle().then(cek)
    if (!kartu) return { kartu: null }
    const penilaian = satuPenilaian(kartu.assessments)
    const ids = [penilaian?.nurse_id, kartu.followed_up_by].filter(Boolean)
    const [pasien, orang] = await Promise.all([
      supabase.from('patients').select('id, full_name, birth_date, gender, dusun, rt, rw, diabetes_since_year, medical_history').eq('id', kartu.patient_id).maybeSingle().then(cek),
      ids.length ? supabase.from('profiles').select('id, full_name').in('id', ids).then(cek) : [],
    ])
    const nama = Object.fromEntries(orang.map((o) => [o.id, o.full_name]))
    return { kartu, penilaian, pasien, nama }
  }, [id, klinis, desa, pasienRole])

  if (!klinis && !desa && !pasienRole) {
    return (
      <EmptyState icon={ClipboardList} title="Kartu belum bisa ditampilkan" action={<ButtonLink to="/">Ke Beranda</ButtonLink>}>
        Data tampil setelah akun Anda disetujui Admin.
      </EmptyState>
    )
  }
  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>

  // ---------------- Perangkat Desa: ringkasan saja
  if (desa) {
    if (!data?.ringkas) return <EmptyState icon={ClipboardList} title="Kartu tidak ditemukan" />
    const r = data.ringkas
    return (
      <div className="space-y-5">
        <Link to="/kartu-kaki" className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
          ← Kartu Kaki Sehat
        </Link>
        <Card>
          <h1 className="text-[26px] leading-tight font-extrabold">{data.pasien?.full_name ?? 'Pasien'}</h1>
          <p className="text-muted">
            Kunjungan {formatTanggal(r.visit_date)} · {alamatSingkat(data.pasien)}
          </p>
          <div className="mt-3">
            <StatusKartuBadge status={r.status} />
          </div>
        </Card>
        <PanelKode penilaian={r.color_code ? { color_code: r.color_code } : null} />
        <LangkahKartu status={r.status} />
        <Banner tone="info">Catatan pengamatan, foto luka, dan SBAR hanya bisa dibuka petugas kesehatan dan pasien ybs.</Banner>
      </div>
    )
  }

  if (!data?.kartu) {
    return <EmptyState icon={ClipboardList} title="Kartu tidak ditemukan" action={<ButtonLink to="/kartu-kaki">Ke daftar kartu</ButtonLink>} />
  }

  const { kartu: k, penilaian: a, pasien: p, nama } = data
  const bisaUbahCatatan = bolehCatat && (['draft', 'dikirim'].includes(k.status) || ['perawat', 'admin'].includes(role))
  const bisaHapus = (bolehCatat && k.status === 'draft') || ['perawat', 'admin'].includes(role)
  const u = umur(p?.birth_date)

  async function kirimKePerawat() {
    setProses(true)
    const { error: err } = await supabase.from('foot_visits').update({ status: 'dikirim' }).eq('id', id)
    setProses(false)
    if (err) return toast.gagal(pesanError(err))
    toast.sukses('Kartu dikirim. Perawat sudah diberi tahu.')
    reload()
  }

  async function tindakLanjut(catatan) {
    setProses(true)
    const { error: err } = await supabase
      .from('foot_visits')
      .update({ status: 'ditindaklanjuti', follow_up_note: catatan })
      .eq('id', id)
    setProses(false)
    if (err) return toast.gagal(pesanError(err))
    setModal(null)
    toast.sukses('Kartu ditandai sudah ditindaklanjuti.')
    reload()
  }

  async function hapus() {
    setProses(true)
    const { error: err } = await supabase.from('foot_visits').delete().eq('id', id)
    setProses(false)
    if (err) return toast.gagal(pesanError(err))
    if (k.photo_path) await supabase.storage.from('wound-photos').remove([k.photo_path])
    toast.sukses('Kartu dihapus.')
    navigate('/kartu-kaki', { replace: true })
  }

  async function cetak() {
    setMencetak(true)
    try {
      await cetakKartuKaki(k.patient_id)
    } catch (err) {
      toast.gagal(pesanError(err))
    } finally {
      setMencetak(false)
    }
  }

  return (
    <div className="space-y-5">
      <Link to="/kartu-kaki" className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
        ← Kartu Kaki Sehat
      </Link>

      <Card>
        <p className="text-base text-muted">Kartu Kaki Sehat · {formatTanggal(k.visit_date)}</p>
        <h1 className="text-[26px] leading-tight font-extrabold">
          <Link to={`/pasien/${k.patient_id}`} className="underline-offset-4 hover:underline">
            {p?.full_name ?? 'Pasien'}
          </Link>
        </h1>
        <p className="text-muted">
          {p?.gender === 'P' ? 'Perempuan' : 'Laki-laki'}
          {u !== null && `, ${u} tahun`} · {alamatSingkat(p)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusKartuBadge status={k.status} />
          {a?.referral && <Badge tone="danger">Dirujuk: {a.referral_to}</Badge>}
        </div>
      </Card>

      <PanelKode penilaian={a} />
      <Card>
        <LangkahKartu status={k.status} />
      </Card>

      <div className="flex flex-wrap gap-2">
        {bolehKode && (
          <Button icon={Stethoscope} onClick={() => setModal('nilai')}>
            {a ? 'Ubah penilaian' : 'Beri penilaian'}
          </Button>
        )}
        {bolehCatat && k.status === 'draft' && (
          <Button icon={Send} loading={proses} onClick={kirimKePerawat}>
            Kirim ke perawat
          </Button>
        )}
        {bolehTindak && k.status === 'dinilai' && (
          <Button variant="soft" icon={CheckCheck} onClick={() => setModal('tindak')}>
            Tandai ditindaklanjuti
          </Button>
        )}
        {bisaUbahCatatan && (
          <ButtonLink to={`/kartu-kaki/${id}/ubah`} variant="secondary" icon={Pencil}>
            Ubah catatan
          </ButtonLink>
        )}
        <Button variant="secondary" icon={Printer} loading={mencetak} onClick={cetak}>
          Cetak kartu
        </Button>
        {bisaHapus && (
          <Button variant="quiet" icon={Trash2} className="text-danger" onClick={() => setModal('hapus')}>
            Hapus
          </Button>
        )}
      </div>

      <Card>
        <h2 className="text-xl font-extrabold">Catatan pengamatan kader</h2>
        <p className="text-muted">
          {k.recorder_name ?? 'Kader'} · {k.submitted_at ? `dikirim ${waktuRelatif(k.submitted_at)}` : 'belum dikirim'}
        </p>
        <dl className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          <Info label="Perubahan menurut laporan">{PERUBAHAN[k.reported_change] ?? '-'}</Info>
          <Info label="Kondisi kaki">{k.foot_condition ?? '-'}</Info>
          <Info label="Tanda/keluhan yang diamati">
            {k.signs?.length ? (
              <span className="mt-1 flex flex-wrap gap-2">
                {k.signs.map((s) => (
                  <Badge key={s} tone="warning">
                    {TANDA[s]}
                  </Badge>
                ))}
              </span>
            ) : (
              'Tidak ada'
            )}
          </Info>
          <Info label="Catatan">{k.observation_notes ?? '-'}</Info>
        </dl>
        {k.photo_path && (
          <div className="mt-3">
            <p className="text-base font-bold text-muted">Foto luka (tekan untuk memperbesar)</p>
            <GambarPrivat bucket="wound-photos" path={k.photo_path} alt="Foto luka kaki" className="mt-2 h-56 w-auto max-w-full" />
          </div>
        )}
      </Card>

      {a && (
        <Card>
          <h2 className="text-xl font-extrabold">Penilaian perawat (SBAR)</h2>
          <p className="text-muted">
            {nama[a.nurse_id] ?? 'Perawat'} · {formatTanggalPendek(a.assessed_at)}
          </p>
          <dl className="mt-3 space-y-3">
            {[
              ['S', 'Situation', a.sbar_situation],
              ['B', 'Background', a.sbar_background],
              ['A', 'Assessment', a.sbar_assessment],
              ['R', 'Recommendation', a.sbar_recommendation],
            ].map(([h, l, v]) => (
              <div key={h} className="flex gap-3">
                <dt className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-lg font-extrabold text-primary" title={l}>
                  <span aria-hidden="true">{h}</span>
                  <span className="sr-only">{l}</span>
                </dt>
                <dd className="pt-1.5 text-lg">{v ?? '-'}</dd>
              </div>
            ))}
          </dl>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 border-t border-line pt-2 sm:grid-cols-2">
            <Info label="Arahan tindak lanjut">{a.follow_up_instruction ?? '-'}</Info>
            <Info label="Rekomendasi aktivitas">{a.activity_recommendation ?? '-'}</Info>
            <Info label="Jadwal kontrol berikutnya">{a.next_control_date ? formatTanggal(a.next_control_date) : '-'}</Info>
            <Info label="Jadwal perawatan luka">{a.wound_care_schedule ?? '-'}</Info>
          </dl>
        </Card>
      )}

      {k.status === 'ditindaklanjuti' && (
        <Card>
          <h2 className="text-xl font-extrabold">Tindak lanjut</h2>
          <p className="text-muted">
            {nama[k.followed_up_by] ?? 'Petugas'} · {formatTanggal(k.followed_up_at, { hour: '2-digit', minute: '2-digit' })}
          </p>
          <p className="mt-2 text-lg">{k.follow_up_note ?? '-'}</p>
        </Card>
      )}

      <PenilaianForm open={modal === 'nilai'} onClose={() => setModal(null)} kartu={k} pasien={p} penilaian={a} onSaved={reload} />
      <TindakLanjutForm open={modal === 'tindak'} onClose={() => setModal(null)} onSimpan={tindakLanjut} loading={proses} />
      <ConfirmDialog
        open={modal === 'hapus'}
        onClose={() => setModal(null)}
        onConfirm={hapus}
        loading={proses}
        danger
        title="Hapus kartu ini?"
        message="Catatan kartu (dan penilaiannya, jika ada) akan dihapus permanen."
        confirmLabel="Ya, hapus"
      />
    </div>
  )
}
