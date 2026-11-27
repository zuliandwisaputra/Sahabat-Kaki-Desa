-- =============================================================================
-- Sahabat Kaki Desa — 8. Skor luka BWAT untuk kode warna (revisi setelah Fase 3)
--
-- Bates-Jensen Wound Assessment Tool: 13 butir × 1–5 poin = 13–65.
--   13–20 Hijau (risiko rendah) · 21–40 Kuning (risiko sedang) · 41–65 Merah (risiko tinggi)
--   Tidak ada luka terbuka -> Hijau.
-- Warna mengikuti skor; perawat boleh MENAIKKAN warna dengan alasan klinis,
-- tetapi tidak boleh menurunkannya. Aturan dijaga di sini (bukan hanya di tampilan).
-- =============================================================================

alter table public.assessments
  add column has_wound       boolean,          -- null = penilaian lama tanpa skor
  add column bwat_answers    jsonb,            -- {"ukuran":1, "kedalaman":3, ...}
  add column bwat_score      int check (bwat_score between 13 and 65),
  add column score_color     text check (score_color in ('hijau', 'kuning', 'merah')),
  add column override_reason text;             -- wajib bila warna dinaikkan dari hasil skor

comment on column public.assessments.bwat_score is 'Skor BWAT (13–65), dihitung otomatis dari bwat_answers.';
comment on column public.assessments.score_color is 'Warna menurut skor. color_code boleh lebih tinggi (dengan override_reason), tidak boleh lebih rendah.';

create or replace function public.before_assessment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_kunci text[] := array['ukuran', 'kedalaman', 'tepi', 'goa', 'jenis_nekrotik', 'jumlah_nekrotik',
                          'jenis_eksudat', 'jumlah_eksudat', 'warna_kulit', 'edema', 'indurasi',
                          'granulasi', 'epitelisasi'];
  v_k     text;
  v_nilai int;
  v_total int := 0;
  v_rank  jsonb := '{"hijau":1,"kuning":2,"merah":3}';
begin
  select fv.patient_id into new.patient_id from public.foot_visits fv where fv.id = new.foot_visit_id;
  if new.patient_id is null then
    raise exception 'Kartu kunjungan tidak ditemukan.' using errcode = '23503';
  end if;
  new.nurse_id := coalesce(new.nurse_id, auth.uid());

  -- Penilaian lama (sebelum ada skor) tidak diperiksa
  if new.has_wound is null then
    new.bwat_answers := null;
    new.bwat_score := null;
    new.score_color := null;
    return new;
  end if;

  if new.has_wound then
    if new.bwat_answers is null then
      raise exception 'Isi ke-13 butir penilaian luka BWAT.' using errcode = '23514';
    end if;
    foreach v_k in array v_kunci loop
      begin
        v_nilai := (new.bwat_answers ->> v_k)::int;
      exception when others then
        v_nilai := null;
      end;
      if v_nilai is null or v_nilai < 1 or v_nilai > 5 then
        raise exception 'Butir BWAT "%" belum diisi atau nilainya tidak 1–5.', v_k using errcode = '23514';
      end if;
      v_total := v_total + v_nilai;
    end loop;
    new.bwat_score := v_total;
    new.score_color := case when v_total <= 20 then 'hijau' when v_total <= 40 then 'kuning' else 'merah' end;
  else
    new.bwat_answers := null;
    new.bwat_score := null;
    new.score_color := 'hijau';
  end if;

  if (v_rank ->> new.color_code)::int < (v_rank ->> new.score_color)::int then
    raise exception 'Kode warna tidak boleh lebih rendah dari hasil skor (%).', initcap(new.score_color)
      using errcode = '23514';
  end if;
  if new.color_code <> new.score_color and coalesce(btrim(new.override_reason), '') = '' then
    raise exception 'Tulis alasan klinis bila kode warna dinaikkan dari hasil skor.' using errcode = '23514';
  end if;
  if new.color_code = new.score_color then
    new.override_reason := null;
  end if;
  return new;
end;
$$;

-- Ringkasan untuk Perangkat Desa & daftar kartu kini menyertakan skor (tanpa rincian klinis)
create or replace view public.foot_card_summary
  with (security_invoker = false, security_barrier = true) as
  select fv.id, fv.patient_id, fv.visit_date, fv.status, fv.submitted_at, fv.followed_up_at,
         a.color_code, a.assessed_at, a.bwat_score
  from public.foot_visits fv
  left join public.assessments a on a.foot_visit_id = fv.id
  where (select public.has_role('perawat', 'kader', 'desa', 'admin'))
     or fv.patient_id = (select public.my_patient_id());

revoke all on public.foot_card_summary from anon, authenticated;
grant select on public.foot_card_summary to authenticated, service_role;
