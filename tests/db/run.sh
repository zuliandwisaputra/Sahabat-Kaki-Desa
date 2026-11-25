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

"${PSQL[@]}" -d postgres -c "drop database if exists $DB" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f "$ROOT/tests/db/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "-> migrasi $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done
"${PSQL[@]}" -d "$DB" -f "$ROOT/tests/db/rls_test.sql"
