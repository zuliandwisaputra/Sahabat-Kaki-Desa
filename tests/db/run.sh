#!/usr/bin/env bash
# Uji migrasi + RLS di PostgreSQL lokal (PostgreSQL 15 atau lebih baru).
# Membuat database baru, memasang tiruan Supabase, menjalankan semua migrasi
# di supabase/migrations/, lalu menjalankan skenario uji tests/db/rls_test.sql.
#
# Pemakaian (contoh, sebagai user postgres):  bash tests/db/run.sh
set -euo pipefail
DB="${DB:-skd_uji}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

# Uji dua kali: dengan & tanpa opsi "Grant API access to new tables automatically"
for HAK in true false; do
  echo "=========== Mode hak otomatis Supabase: $HAK ==========="
  "${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
  "${PSQL[@]}" -d "$DB" -v hak_otomatis=$HAK -f "$ROOT/tests/db/supabase_stub.sql"
  for f in "$ROOT"/supabase/migrations/*.sql; do
    echo "-> migrasi $(basename "$f")"
    "${PSQL[@]}" -d "$DB" -f "$f"
  done
  "${PSQL[@]}" -d "$DB" -f "$ROOT/tests/db/rls_test.sql"
done
