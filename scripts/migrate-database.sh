#!/usr/bin/env bash
# Copies the production database to a new, empty database (the Frankfurt Neon
# project), then compares exact row counts table by table.
# Procedure and switch-over: docs/migration-europe.md.
#
# Usage (both URLs typed in your own terminal, never committed):
#   SOURCE_DATABASE_URL='postgresql://…' TARGET_DATABASE_URL='postgresql://…' \
#     npm run db:copy
#
# Runs pg_dump/pg_restore from the official postgres Docker image matching the
# source server's major version. URLs reach the container through environment
# variables only: they never appear in a command line or in the output.
set -euo pipefail

fail() {
  echo "Erreur : $*" >&2
  exit 1
}

[ -n "${SOURCE_DATABASE_URL:-}" ] || fail "SOURCE_DATABASE_URL est vide."
[ -n "${TARGET_DATABASE_URL:-}" ] || fail "TARGET_DATABASE_URL est vide."
[ "$SOURCE_DATABASE_URL" != "$TARGET_DATABASE_URL" ] ||
  fail "la source et la cible sont identiques."
case "$SOURCE_DATABASE_URL$TARGET_DATABASE_URL" in
*-pooler.*) fail "utilisez les URL directes (sans -pooler) : pg_dump ne passe pas par PgBouncer." ;;
esac
command -v docker >/dev/null || fail "Docker est requis (colima start)."

# The dump holds customer data: it lives in a Docker volume of its own
# (inside the Docker VM, never in a shared folder), removed whatever happens.
volume="caldera-db-copy-$$"
work=$(mktemp -d)
docker volume create "$volume" >/dev/null
trap 'docker volume rm -f "$volume" >/dev/null; rm -rf "$work"' EXIT

pg() {
  docker run --rm -i --network host \
    -e SOURCE_DATABASE_URL -e TARGET_DATABASE_URL \
    -v "$volume:/work" "postgres:${PG_MAJOR:-18}-alpine" sh -c "$1"
}

PG_MAJOR=18
major=$(pg 'psql "$SOURCE_DATABASE_URL" -Atc "show server_version_num"')
PG_MAJOR=$((major / 10000))
target_major=$(pg 'psql "$TARGET_DATABASE_URL" -Atc "show server_version_num"')
target_major=$((target_major / 10000))
echo "Source : PostgreSQL $PG_MAJOR — cible : PostgreSQL $target_major"
[ "$target_major" -ge "$PG_MAJOR" ] ||
  fail "la cible doit être en PostgreSQL $PG_MAJOR ou plus récent."

tables=$(pg 'psql "$TARGET_DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema = '"'"'public'"'"'"')
[ "$tables" = "0" ] || fail "la base cible n’est pas vide ($tables tables) : rien n’a été modifié."

# Anything still being paid would be written to the old base after the copy.
open=$(pg 'psql "$SOURCE_DATABASE_URL" -Atc "select (select count(*) from \"Order\" where status in ('"'"'PENDING_PAYMENT'"'"', '"'"'PAYMENT_PROCESSING'"'"')) || '"'"' commande(s) en attente, '"'"' || (select count(*) from \"StockReservation\" where status = '"'"'ACTIVE'"'"') || '"'"' réservation(s) active(s)'"'"'"')
echo "Source : $open"
case "$open" in
"0 commande(s) en attente, 0 réservation(s) active(s)") ;;
*)
  [ "${FORCE_COPY:-}" = "1" ] ||
    fail "paiements en cours. Attendez la fin des réservations (20 min après CHECKOUT_PAUSED=1) ou relancez avec FORCE_COPY=1."
  ;;
esac

echo "Copie…"
pg 'pg_dump "$SOURCE_DATABASE_URL" --format=custom --no-owner --no-privileges --file=/work/caldera.dump'
pg 'pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --no-privileges --exit-on-error --single-transaction /work/caldera.dump'

# Exact row count of every table, generated from the source catalog.
pg 'psql "$SOURCE_DATABASE_URL" -At -f - > /work/count.sql' <<'SQL'
select string_agg(
  format('select %L as t, count(*) as n from public.%I', table_name, table_name),
  ' union all ' order by table_name
)
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE';
SQL
pg 'psql "$SOURCE_DATABASE_URL" -At -F " " -f /work/count.sql' >"$work/source.txt"
pg 'psql "$TARGET_DATABASE_URL" -At -F " " -f /work/count.sql' >"$work/target.txt"
if diff "$work/source.txt" "$work/target.txt" >/dev/null; then
  echo "Comptages identiques sur $(wc -l <"$work/source.txt" | tr -d ' ') tables :"
  sed 's/^/  /' "$work/source.txt"
else
  echo "Écart de comptage (source < > cible) :" >&2
  diff "$work/source.txt" "$work/target.txt" >&2 || true
  exit 1
fi
echo "Copie terminée. Étape suivante : docs/migration-europe.md, « Bascule »."
