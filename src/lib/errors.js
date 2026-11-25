// Ubah pesan error teknis menjadi kalimat sederhana berbahasa Indonesia.
export function pesanError(error, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  if (!error) return fallback
  const msg = String(error.message ?? error.error_description ?? error ?? '')
  const code = error.code ?? ''
  const lower = msg.toLowerCase()

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('network request failed')) {
    return 'Tidak ada koneksi internet. Periksa sinyal lalu coba lagi.'
  }
  if (lower.includes('invalid login credentials')) {
    return 'Username/email atau password salah.'
  }
  if (lower.includes('email not confirmed')) {
    return 'Email belum dikonfirmasi. Buka email dari Sahabat Kaki Desa lalu klik link konfirmasi.'
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Email ini sudah terdaftar. Silakan masuk, atau pakai "Lupa password".'
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || code === 'over_email_send_rate_limit') {
    return 'Terlalu sering mencoba. Tunggu beberapa menit lalu coba lagi.'
  }
  if (lower.includes('password should be') || lower.includes('weak password')) {
    return 'Password terlalu lemah. Pakai minimal 8 karakter, campuran huruf dan angka.'
  }
  if (lower.includes('same password') || lower.includes('should be different')) {
    return 'Password baru harus berbeda dari password lama.'
  }
  if (lower.includes('error sending') && lower.includes('email')) {
    return 'Email tidak bisa dikirim saat ini. Hubungi Admin.'
  }
  if (lower.includes('jwt expired') || (lower.includes('session') && lower.includes('missing'))) {
    return 'Sesi Anda sudah berakhir. Silakan masuk lagi.'
  }
  if (lower.includes('row-level security') || lower.includes('permission denied')) {
    return 'Anda tidak punya izin untuk melakukan ini.'
  }
  if (code === '23505' || lower.includes('duplicate key')) {
    return 'Data yang sama sudah ada.'
  }
  if (code === '23503') {
    return 'Data ini masih terhubung dengan data lain.'
  }
  // Pesan dari trigger/fungsi database kita sudah berbahasa Indonesia
  if (code === '42501' || code === '22023' || code === 'P0002' || code === '23514' || code === 'P0001') {
    return msg
  }
  return msg || fallback
}
