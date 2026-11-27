import { useState } from 'react'
import { Link, useParams } from 'react-router'
import {
  Archive,
  ArchiveRestore,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  HandHeart,
  Link2,
  Pencil,
  Printer,
  Stethoscope,
  UserRound,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { pesanError } from '../../lib/errors'
import { cek, useLoad } from '../../lib/useLoad'
import { formatTanggal, formatTanggalPendek } from '../../lib/format'
import { alamatSingkat, HAMBATAN, JENIS_KUNJUNGAN, satuPenilaian, umur } from '../../lib/pasien'
import { cetakKartuKaki } from '../../lib/pdfKartu'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { useCan } from '../../components/Can'
import { Button, ButtonLink } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/Modal'
import { Avatar } from '../../components/ui/Avatar'
import { Badge, Banner, Card, CodeBadge, EmptyState, KODE_WARNA, PageHeader, Spinner } from '../../components/ui/misc'
import { GambarPrivat, Info, StatusKartuBadge, StatusPasienBadge, TombolKontak } from '../../components/ui/extra'
import { KunjunganForm, PasangkanForm } from '../sahabat-kaki/forms'
import { HubungkanAkun } from './HubungkanAkun'

const ASPEK = { kualitas_hidup: 'Kualitas hidup', dukungan_sosial: 'Dukungan sosial', kemandirian: 'Kemandirian' }

function susunLinimasa({ kunjungan, kartu, hadir, kuesioner, bolehBukaKartu }) {
  const ev = []
  for (const k of kunjungan)
    ev.push({
      key: `k-${k.id}`,
      tanggal: k.visit_date,
      icon: HandHeart,
      judul: `Sahabat Kaki: ${JENIS_KUNJUNGAN[k.activity_type] ?? 'Kunjungan'}`,
      detail: k.complaints ? `Keluhan: ${k.complaints}` : null,
      badge: k.report_to_nurse ? <Badge tone="danger">Dilaporkan ke perawat</Badge> : null,
    })
  for (const c of kartu) {
    const a = c.assessments !== undefined ? satuPenilaian(c.assessments) : c.color_code ? { color_code: c.color_code } : null
    ev.push({
      key: `c-${c.id}`,
      tanggal: c.visit_date,
      icon: ClipboardList,
      judul: 'Kartu Kaki Sehat',
      detail: a?.follow_up_instruction ? `Arahan perawat: ${a.follow_up_instruction}` : null,
      badge: (
        <span className="flex flex-wrap gap-2">
          <CodeBadge code={a?.color_code} />
          <StatusKartuBadge status={c.status} />
        </span>
      ),
      link: bolehBukaKartu ? `/kartu-kaki/${c.id}` : null,
    })
  }
  for (const h of hadir)
    ev.push({
      key: `h-${h.id}`,
      tanggal: h.agenda?.event_date,
      icon: CalendarCheck,
      judul: h.agenda?.title ?? 'Pos Kaki',
      detail:
        h.present === null
          ? 'Kehadiran belum dicatat'
          : h.present
            ? `Hadir${h.on_time === false ? ' · kontrol terlambat' : h.on_time ? ' · tepat waktu' : ''}${h.foot_check_done ? ' · kaki diperiksa' : ''}`
            : 'Tidak hadir',
    })
  for (const q of kuesioner)
    ev.push({
      key: `q-${q.id}`,
      tanggal: q.assessed_on,
      icon: ClipboardCheck,
      judul: `Kuesioner ${ASPEK[q.aspect] ?? q.aspect} (${q.assessment_type})`,
      detail: q.score !== null ? `Skor ${q.score} · ${q.instrument}` : q.instrument,
    })
  return ev.filter((e) => e.tanggal).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1))
}

// PAS-03: detail pasien dengan riwayat lengkap dalam satu linimasa
export default function DetailPasien() {
  const { id } = useParams()
  const { profile, approved } = useAuth()
  const toast = useToast()
  const role = profile.role
  const klinis = approved && ['perawat', 'kader', 'admin'].includes(role)
  const sendiri = approved && role === 'pasien' && profile.patient_id === id
  const desa = approved && role === 'desa'
  const bolehUbah = useCan('pasien.ubah') || sendiri
  const bolehArsip = useCan('pasien.arsip')
  const bolehHubungkan = useCan('pasien.hubungkan-akun')
  const bolehPasangkan = useCan('sahabat.pasangkan')
  const bolehIsiKartu = useCan('kartu.catat')
  const [modal, setModal] = useState(null) // 'kunjungan' | 'pasangkan' | 'akun' | 'arsip'
  const [proses, setProses] = useState(false)
  const [mencetak, setMencetak] = useState(false)

  const { data, loading, error, reload } = useLoad(async () => {
    if (!klinis && !sendiri && !desa) return null
    const lengkap = klinis || sendiri
    const [pasien, pendamping, kunjungan, kartu, hadir, kuesioner, akun] = await Promise.all([
      supabase.from(lengkap ? 'patients' : 'patient_directory').select('*').eq('id', id).maybeSingle().then(cek),
      supabase.from('companions').select('*').eq('patient_id', id).order('paired_at', { ascending: false }).then(cek),
      lengkap
        ? supabase.from('companion_visits').select('*').eq('patient_id', id).order('visit_date', { ascending: false }).then(cek)
        : supabase.from('companion_visit_summary').select('*').eq('patient_id', id).then(cek),
      lengkap
        ? supabase
            .from('foot_visits')
            .select('id, visit_date, status, assessments(color_code, follow_up_instruction, activity_recommendation, next_control_date, wound_care_schedule, assessed_at)')
            .eq('patient_id', id)
            .order('visit_date', { ascending: false })
            .then(cek)
        : supabase.from('foot_card_summary').select('*').eq('patient_id', id).then(cek),
      supabase
        .from('attendance')
        .select('id, present, on_time, foot_check_done, agenda(title, event_date)')
        .eq('patient_id', id)
        .then(cek),
      ['perawat', 'admin'].includes(role) || sendiri
        ? supabase.from('questionnaires').select('id, aspect, instrument, assessment_type, assessed_on, score').eq('patient_id', id).then(cek)
        : [],
      klinis ? supabase.from('profiles').select('id, full_name, username').eq('patient_id', id).then(cek) : [],
    ])
    return { pasien, pendamping, kunjungan, kartu, hadir, kuesioner, akun }
  }, [id, klinis, sendiri, desa])

  if (!klinis && !sendiri && !desa) {
    return (
      <EmptyState icon={UserRound} title="Data pasien tidak bisa ditampilkan" action={<ButtonLink to="/">Ke Beranda</ButtonLink>}>
        {approved ? 'Anda hanya bisa melihat data pasien yang terhubung ke akun Anda.' : 'Data pasien tampil setelah akun Anda disetujui Admin.'}
      </EmptyState>
    )
  }
  if (loading && !data) return <Spinner />
  if (error) return <Banner tone="danger">{error}</Banner>
  if (!data?.pasien) return <EmptyState icon={UserRound} title="Data pasien tidak ditemukan" action={<ButtonLink to="/pasien">Ke daftar pasien</ButtonLink>} />

  const p = data.pasien
  const aktif = data.pendamping.find((c) => c.active) ?? null
  const kaderPendamping = role === 'kader' && aktif?.profile_id === profile.id
  const bolehCatatKunjungan = (approved && ['perawat', 'admin'].includes(role)) || (approved && kaderPendamping)
  const penilaianTerakhir = data.kartu.map((k) => satuPenilaian(k.assessments)).find(Boolean)
  const kodeTerakhir = data.kartu.find((k) => (k.assessments !== undefined ? satuPenilaian(k.assessments) : k.color_code))
  const kodeTerakhirWarna = kodeTerakhir ? (satuPenilaian(kodeTerakhir.assessments)?.color_code ?? kodeTerakhir.color_code) : null
  const linimasa = susunLinimasa({ ...data, bolehBukaKartu: klinis || sendiri })
  const u = umur(p.birth_date)

  async function arsipkan() {
    setProses(true)
    const { error: err } = await supabase
      .from('patients')
      .update({ archived_at: p.archived_at ? null : new Date().toISOString() })
      .eq('id', id)
    setProses(false)
    setModal(null)
    if (err) return toast.gagal(pesanError(err))
    toast.sukses(p.archived_at ? 'Pasien dipulihkan dari arsip.' : 'Pasien diarsipkan.')
    reload()
  }

  async function cetak() {
    setMencetak(true)
    try {
      await cetakKartuKaki(id)
    } catch (err) {
      toast.gagal(pesanError(err))
    } finally {
      setMencetak(false)
    }
  }

  return (
    <div className="space-y-5">
      <Link to={sendiri ? '/' : '/pasien'} className="inline-flex min-h-11 items-center font-bold text-primary underline underline-offset-4">
        ← {sendiri ? 'Beranda' : 'Daftar pasien'}
      </Link>

      <Card>
        <div className="flex flex-wrap items-start gap-4">
          {p.photo_path ? (
            <GambarPrivat bucket="wound-photos" path={p.photo_path} alt={`Foto ${p.full_name}`} className="size-20 rounded-full!" />
          ) : (
            <Avatar name={p.full_name} size="lg" className="size-20! text-2xl!" />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[26px] leading-tight font-extrabold">{p.full_name}</h1>
            <p className="text-muted">
              {p.gender === 'P' ? 'Perempuan' : 'Laki-laki'}
              {u !== null && `, ${u} tahun`} · {alamatSingkat(p)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <StatusPasienBadge status={p.status} archived={p.archived_at} />
              {kodeTerakhirWarna && <CodeBadge code={kodeTerakhirWarna} />}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {bolehIsiKartu && !p.archived_at && (
            <ButtonLink to={`/kartu-kaki/baru?pasien=${id}`} size="sm" icon={ClipboardList}>
              Isi Kartu Kaki
            </ButtonLink>
          )}
          {bolehCatatKunjungan && aktif && !p.archived_at && (
            <Button size="sm" variant="soft" icon={HandHeart} onClick={() => setModal('kunjungan')}>
              Catat kunjungan
            </Button>
          )}
          {bolehUbah && (
            <ButtonLink to={`/pasien/${id}/ubah`} size="sm" variant="secondary" icon={Pencil}>
              Ubah data
            </ButtonLink>
          )}
          {(klinis || sendiri) && (
            <Button size="sm" variant="secondary" icon={Printer} loading={mencetak} onClick={cetak}>
              Cetak kartu
            </Button>
          )}
          {bolehArsip && (
            <Button size="sm" variant="quiet" icon={p.archived_at ? ArchiveRestore : Archive} onClick={() => setModal('arsip')}>
              {p.archived_at ? 'Pulihkan' : 'Arsipkan'}
            </Button>
          )}
        </div>
      </Card>

      {desa && (
        <Banner tone="info">Perangkat Desa melihat data ringkas. Catatan klinis, foto luka, dan SBAR tidak ditampilkan.</Banner>
      )}

      {penilaianTerakhir && (
        <Card className={`border-2 ${KODE_WARNA[penilaianTerakhir.color_code]?.cls.split(' ').find((c) => c.startsWith('border-')) ?? ''}`}>
          <h2 className="flex items-center gap-2 text-xl font-extrabold">
            <Stethoscope aria-hidden="true" className="size-6 text-primary" /> Arahan perawat terakhir
          </h2>
          <dl className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <Info label="Kode warna">
              <CodeBadge code={penilaianTerakhir.color_code} /> <span className="text-base text-muted">{formatTanggalPendek(penilaianTerakhir.assessed_at)}</span>
            </Info>
            <Info label="Jadwal kontrol berikutnya">
              {penilaianTerakhir.next_control_date ? formatTanggal(penilaianTerakhir.next_control_date) : '-'}
            </Info>
            <Info label="Arahan tindak lanjut">{penilaianTerakhir.follow_up_instruction ?? '-'}</Info>
            <Info label="Rekomendasi aktivitas">{penilaianTerakhir.activity_recommendation ?? '-'}</Info>
            {penilaianTerakhir.wound_care_schedule && <Info label="Jadwal perawatan luka">{penilaianTerakhir.wound_care_schedule}</Info>}
          </dl>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">Pendamping Sahabat Kaki</h2>
            {bolehPasangkan && !p.archived_at && (
              <Button size="sm" variant="soft" onClick={() => setModal('pasangkan')}>
                {aktif ? 'Ganti' : 'Pasangkan'}
              </Button>
            )}
          </div>
          {aktif ? (
            <div className="mt-3 space-y-2">
              <p className="text-lg font-extrabold">{aktif.name}</p>
              <p className="text-muted">
                {aktif.companion_type === 'pkk' ? 'Anggota PKK' : 'Kader'}
                {aktif.relation && ` · ${aktif.relation}`} · sejak {formatTanggalPendek(aktif.paired_at)}
              </p>
              {(klinis || sendiri) && <TombolKontak phone={aktif.phone} nama={aktif.name} />}
            </div>
          ) : (
            <p className="mt-3 text-muted">Belum ada pendamping.</p>
          )}
        </Card>

        {(klinis || sendiri) && (
          <Card>
            <h2 className="text-xl font-extrabold">Persetujuan</h2>
            <ul className="mt-3 space-y-2">
              <li>
                <Badge tone={p.consent_program ? 'success' : 'warning'}>{p.consent_program ? 'Setuju' : 'Belum'}</Badge>{' '}
                Ikut program{p.consent_program_date && ` · ${formatTanggalPendek(p.consent_program_date)}`}
              </li>
              <li>
                <Badge tone={p.consent_share ? 'success' : 'warning'}>{p.consent_share ? 'Setuju' : 'Belum'}</Badge>{' '}
                Kondisi dibagikan ke pendamping & grup{p.consent_share_date && ` · ${formatTanggalPendek(p.consent_share_date)}`}
              </li>
            </ul>
            {bolehHubungkan && (
              <div className="mt-4 border-t border-line pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-extrabold">Akun keluarga terhubung</p>
                  <Button size="sm" variant="soft" icon={Link2} onClick={() => setModal('akun')}>
                    Hubungkan akun
                  </Button>
                </div>
                <p className="mt-1 text-muted">
                  {data.akun.length ? data.akun.map((a) => `${a.full_name} (@${a.username})`).join(', ') : 'Belum ada akun yang terhubung.'}
                </p>
              </div>
            )}
          </Card>
        )}
      </div>

      {(klinis || sendiri) && (
        <Card>
          <h2 className="text-xl font-extrabold">Identitas</h2>
          <dl className="mt-1 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            <Info label="Tanggal lahir">{p.birth_date ? formatTanggal(p.birth_date, { weekday: undefined }) : '-'}</Info>
            <Info label="NIK">{p.nik ?? '-'}</Info>
            <Info label="Alamat lengkap">{p.address_detail ?? '-'}</Info>
            <Info label="Nomor HP">{p.phone ?? '-'}</Info>
            <Info label="Keluarga pendamping">
              {[p.family_name, p.family_relation && `(${p.family_relation})`].filter(Boolean).join(' ') || '-'}
              {p.family_phone && <span className="block text-muted">{p.family_phone}</span>}
            </Info>
            <Info label="Riwayat penyakit">
              {[p.diabetes_since_year && `Diabetes sejak ${p.diabetes_since_year}`, p.medical_history].filter(Boolean).join('. ') || '-'}
            </Info>
            <Info label="Hambatan utama">
              {p.barriers?.length ? p.barriers.map((b) => HAMBATAN[b]).join(', ') : '-'}
              {p.barrier_notes && <span className="block text-muted">{p.barrier_notes}</span>}
            </Info>
          </dl>
        </Card>
      )}

      <section aria-labelledby="linimasa">
        <h2 id="linimasa" className="mb-3 text-xl font-extrabold">
          Riwayat perawatan
        </h2>
        {linimasa.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Belum ada riwayat">
            Kunjungan, Kartu Kaki Sehat, kehadiran Pos Kaki, dan kuesioner akan muncul di sini.
          </EmptyState>
        ) : (
          <ol className="relative space-y-3 border-l-2 border-line pl-5">
            {linimasa.map((e) => {
              const Icon = e.icon
              const isi = (
                <>
                  <span className="absolute -left-[39px] grid size-9 place-items-center rounded-full border-2 border-line bg-surface text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="block text-base text-muted">{formatTanggal(e.tanggal)}</span>
                  <span className="block text-lg leading-snug font-extrabold">{e.judul}</span>
                  {e.detail && <span className="block">{e.detail}</span>}
                  {e.badge && <span className="mt-2 block">{e.badge}</span>}
                </>
              )
              return (
                <li key={e.key} className="relative">
                  {e.link ? (
                    <Link to={e.link} className="block rounded-card border border-line bg-surface p-4 shadow-card hover:border-primary/40">
                      {isi}
                    </Link>
                  ) : (
                    <div className="rounded-card border border-line bg-surface p-4 shadow-card">{isi}</div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <KunjunganForm
        open={modal === 'kunjungan'}
        onClose={() => setModal(null)}
        pasien={p}
        companionId={aktif?.id}
        onSaved={reload}
      />
      <PasangkanForm open={modal === 'pasangkan'} onClose={() => setModal(null)} pasien={p} aktif={aktif} onSaved={reload} />
      <HubungkanAkun open={modal === 'akun'} onClose={() => setModal(null)} pasien={p} onSaved={reload} />
      <ConfirmDialog
        open={modal === 'arsip'}
        onClose={() => setModal(null)}
        onConfirm={arsipkan}
        loading={proses}
        title={p.archived_at ? 'Pulihkan pasien?' : 'Arsipkan pasien?'}
        message={
          p.archived_at
            ? `${p.full_name} akan kembali muncul di daftar pasien.`
            : `${p.full_name} dipindahkan ke arsip (tidak dihapus). Riwayatnya tetap tersimpan dan bisa dipulihkan.`
        }
        confirmLabel={p.archived_at ? 'Ya, pulihkan' : 'Ya, arsipkan'}
      />
    </div>
  )
}
