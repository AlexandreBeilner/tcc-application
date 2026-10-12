#!/usr/bin/env bash
# Teste de restauração (LW.3.12): pega o backup mais recente, descriptografa, restaura em bancos
# descartáveis `restore_test_*` no mesmo servidor Postgres e confere (1) contagem entre as medidas
# de antes e depois do dump, (2) o gatilho append-only de market_events ativo e recusando UPDATE,
# (3) avatares e .env legíveis. Apaga os bancos de teste no fim. Roda toda semana (systemd timer).
# Uso: restore-test.sh [local|remote]   (padrão: remote se BACKUP_REMOTE existir)
set -Eeuo pipefail
# shellcheck source=common.sh
source /usr/local/lib/backup/common.sh

fail() {
  log "TESTE DE RESTAURAÇÃO FALHOU: $*"
  ping_monitor "${RESTORE_TEST_HEALTHCHECK_URL:-}" /fail
  exit 1
}
trap 'fail "erro na linha $LINENO"' ERR

psql_admin() { psql -h "$PGHOST" -U "$PGUSER" -d postgres -v ON_ERROR_STOP=1 -Atq "$@"; }
cleanup() {
  for db in "${DATABASES[@]}"; do psql_admin -c "DROP DATABASE IF EXISTS restore_test_${db}" >/dev/null 2>&1 || true; done
  rm -rf "${work:-/nonexistent}"
}
trap cleanup EXIT

ping_monitor "${RESTORE_TEST_HEALTHCHECK_URL:-}" /start
source_kind="${1:-$([ -n "${BACKUP_REMOTE:-}" ] && echo remote || echo local)}"
work="$(mktemp -d /work/restore-test.XXXXXX)"

if [ "$source_kind" = remote ]; then
  remote="${BACKUP_REMOTE:?BACKUP_REMOTE não definido}/${BACKUP_ENV_NAME}/daily"
  latest="$(rclone lsf --dirs-only "$remote" | tr -d '/' | sort | tail -n 1)"
  [ -n "$latest" ] || fail "nenhum backup em ${remote}"
  rclone copy "${remote}/${latest}" "${work}/data"
else
  base="${BACKUP_DIR}/${BACKUP_ENV_NAME}/daily"
  latest="$(ls -1 "$base" | sort | tail -n 1)"
  [ -n "$latest" ] || fail "nenhum backup local em ${base}"
  cp -r "${base}/${latest}" "${work}/data"
fi
log "testando o backup ${latest} (${source_kind})"
(cd "${work}/data" && sha256sum -c <(grep '\.age$' manifest.txt))

for db in "${DATABASES[@]}"; do
  target="restore_test_${db}"
  table="$(control_table "$db")"
  decrypt < "${work}/data/${db}.dump.age" > "${work}/${db}.dump"
  psql_admin -c "DROP DATABASE IF EXISTS ${target}" -c "CREATE DATABASE ${target}"
  # Sem dono nem privilégios: o teste só confere conteúdo; a restauração real (restore.sh) preserva os donos.
  pg_restore -h "$PGHOST" -U "$PGUSER" --no-owner --no-privileges --exit-on-error -d "$target" "${work}/${db}.dump"
  rows="$(psql -h "$PGHOST" -U "$PGUSER" -d "$target" -Atc "SELECT count(*) FROM ${table}")"
  low="$(grep "^${db}\.${table}\.antes=" "${work}/data/manifest.txt" | cut -d= -f2)"
  high="$(grep "^${db}\.${table}\.depois=" "${work}/data/manifest.txt" | cut -d= -f2)"
  [ "$rows" -ge "$low" ] && [ "$rows" -le "$high" ] || fail "${db}.${table}: ${rows} linhas restauradas, esperado entre ${low} e ${high}"
  log "${db}.${table}: ${rows} linhas (esperado entre ${low} e ${high})"
done

# O restore não pode quebrar a fonte da verdade financeira: o gatilho append-only precisa continuar valendo.
trigger="$(psql -h "$PGHOST" -U "$PGUSER" -d restore_test_market -Atc "SELECT count(*) FROM pg_trigger WHERE tgname='market_events_append_only' AND tgenabled='O' AND NOT tgisinternal")"
[ "$trigger" = "1" ] || fail "gatilho market_events_append_only ausente ou desativado após o restore"
if [ "$(psql -h "$PGHOST" -U "$PGUSER" -d restore_test_market -Atc "SELECT count(*) FROM market_events")" -gt 0 ]; then
  if psql -h "$PGHOST" -U "$PGUSER" -d restore_test_market -Atqc "UPDATE market_events SET quantity = quantity WHERE id = (SELECT id FROM market_events LIMIT 1)" >/dev/null 2>&1; then
    fail "UPDATE em market_events passou após o restore (gatilho não protege)"
  fi
fi
log "gatilho append-only ativo e recusando UPDATE"

if [ -f "${work}/data/avatars.tar.gz.age" ]; then
  decrypt < "${work}/data/avatars.tar.gz.age" | tar -tzf - > /dev/null
  log "avatares legíveis"
fi
if [ -f "${work}/data/app.env.age" ]; then
  decrypt < "${work}/data/app.env.age" | grep -q '^SIMULATION_SEED=' || fail ".env restaurado sem SIMULATION_SEED"
  log ".env legível, com SIMULATION_SEED"
fi

log "teste de restauração OK (${latest})"
ping_monitor "${RESTORE_TEST_HEALTHCHECK_URL:-}"
