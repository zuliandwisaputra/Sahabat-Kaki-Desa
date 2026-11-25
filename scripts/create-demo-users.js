// =============================================================================
// Membuat 5 akun untuk roleplay (satu per peran) dan menghubungkannya ke data contoh.
//
// JALANKAN HANYA DI LAPTOP ANDA. Butuh file .env.local (sudah di .gitignore) berisi:
//   SUPABASE_URL=https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=...   (service_role / secret key — RAHASIA, jangan dibagikan)
//   DEMO_PASSWORD=...               (opsional; password untuk kelima akun)
//
// Urutan: migrasi 1–9 -> supabase/seed.sql -> `npm run akun-demo`
// Aman dijalankan ulang: akun yang sudah ada tidak dibuat lagi (password disamakan ulang).
// =============================================================================
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local', quiet: true })
config({ path: '.env', quiet: true })

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PASSWORD = process.env.DEMO_PASSWORD || 'SahabatKaki#2026'
const DOMAIN = process.env.DEMO_EMAIL_DOMAIN || 'sahabatkakidesa.id'

const NY_S = 'a1000000-0000-4000-8000-000000000001' // id Ny. S di seed.sql
const KADER_SEED = 'Ani Rahmawati' // nama kader pendamping di seed.sql

const AKUN = [
  { role: 'admin', username: 'koordinator', full_name: 'Koordinator Kelompok 2', phone: '081300000010' },
  { role: 'perawat', username: 'perawat.cindy', full_name: 'Ns. Cindy', phone: '081300000011' },
  { role: 'kader', username: 'kader.ani', full_name: KADER_SEED, phone: '081300000901' },
  { role: 'pasien', username: 'keluarga.s', full_name: 'Tn. Slamet (suami Ny. S)', phone: '081300000102' },
  { role: 'desa', username: 'desa.harjo', full_name: 'Pak Harjo (Sekretaris Desa)', phone: '081300000013' },
]

function berhenti(pesan) {
  console.error(`\n✖ ${pesan}\n`)
  process.exit(1)
}

if (!URL || !KEY) {
  berhenti('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi di file .env.local (lihat README bagian "Akun demo").')
}
if (KEY.startsWith('sb_publishable_')) {
  berhenti('Yang diisi adalah publishable key. Script ini butuh service_role / secret key (Project Settings -> API Keys).')
}
if (PASSWORD.length < 8) berhenti('DEMO_PASSWORD minimal 8 karakter.')

const db = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function cariUserByEmail(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const u = data.users.find((x) => x.email?.toLowerCase() === email)
    if (u) return u
    if (data.users.length < 200) return null
  }
  return null
}

async function cek(q, langkah) {
  const { data, error } = await q
  if (error) berhenti(`${langkah}: ${error.message}`)
  return data
}

async function main() {
  console.log(`\nMenghubungi ${URL} ...\n`)
  const hasil = []

  for (const a of AKUN) {
    const email = `${a.username}@${DOMAIN}`
    let user = await cariUserByEmail(email)
    if (user) {
      const { error } = await db.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true })
      if (error) berhenti(`Gagal memperbarui ${email}: ${error.message}`)
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        // Admin tidak bisa dipilih lewat pendaftaran; perannya diubah di langkah berikut
        user_metadata: { full_name: a.full_name, username: a.username, phone: a.phone, role: a.role === 'admin' ? 'perawat' : a.role },
      })
      if (error) berhenti(`Gagal membuat ${email}: ${error.message}`)
      user = data.user
    }

    await cek(
      db
        .from('profiles')
        .update({ role: a.role, approval_status: 'disetujui', approved_at: new Date().toISOString(), full_name: a.full_name, phone: a.phone })
        .eq('id', user.id),
      `Mengatur profil ${a.username}`,
    )
    const profil = await cek(db.from('profiles').select('id, username, role').eq('id', user.id).single(), 'Membaca profil')
    hasil.push({ ...a, id: user.id, email, usernameAsli: profil.username })
  }

  const id = Object.fromEntries(hasil.map((h) => [h.role, h.id]))

  // Hubungkan akun keluarga ke Ny. S
  const nyS = await cek(db.from('patients').select('id').eq('id', NY_S).maybeSingle(), 'Mencari Ny. S')
  if (nyS) {
    await cek(db.from('profiles').update({ patient_id: NY_S }).eq('id', id.pasien), 'Menghubungkan akun keluarga')
  } else {
    console.warn('⚠ Data Ny. S belum ada. Jalankan supabase/seed.sql dulu, lalu jalankan script ini lagi.')
  }

  // Sambungkan data contoh ke akun kader & perawat
  await cek(db.from('companions').update({ profile_id: id.kader }).is('profile_id', null).eq('name', KADER_SEED), 'Pendamping')
  await cek(db.from('foot_visits').update({ recorded_by: id.kader }).is('recorded_by', null).eq('recorder_name', KADER_SEED), 'Pencatat kartu')
  await cek(db.from('assessments').update({ nurse_id: id.perawat }).is('nurse_id', null), 'Perawat penilai')
  await cek(db.from('foot_visits').update({ followed_up_by: id.kader }).is('followed_up_by', null).not('followed_up_at', 'is', null), 'Petugas tindak lanjut')
  const pendKader = await cek(db.from('companions').select('id').eq('profile_id', id.kader), 'Membaca pendamping')
  if (pendKader.length) {
    await cek(
      db.from('companion_visits').update({ recorded_by: id.kader }).is('recorded_by', null).in('companion_id', pendKader.map((c) => c.id)),
      'Pencatat kunjungan',
    )
  }
  const latih = await cek(db.from('kader_trainings').select('id, participant_ids, participant_names'), 'Pelatihan')
  for (const t of latih) {
    if (!t.participant_names.includes(KADER_SEED)) continue
    await cek(
      db
        .from('kader_trainings')
        .update({
          participant_ids: [...new Set([...t.participant_ids, id.kader])],
          participant_names: t.participant_names.filter((n) => n !== KADER_SEED),
        })
        .eq('id', t.id),
      'Peserta pelatihan',
    )
  }

  const LABEL = { admin: 'Admin', perawat: 'Perawat Puskesmas', kader: 'Kader', pasien: 'Pasien/Keluarga', desa: 'Perangkat Desa' }
  console.log('✔ Selesai. Akun untuk roleplay (bagikan hanya ke anggota kelompok & dosen):\n')
  console.table(hasil.map((h) => ({ Peran: LABEL[h.role], Username: h.usernameAsli, Email: h.email })))
  console.log(`Password semua akun: ${PASSWORD}`)
  if (hasil.some((h) => h.usernameAsli !== h.username)) {
    console.log('\n⚠ Ada username yang sudah dipakai sebelumnya, jadi diberi akhiran angka. Masuk memakai username di tabel atau email.')
  }
  console.log('')
}

main().catch((e) => berhenti(e.message ?? String(e)))
