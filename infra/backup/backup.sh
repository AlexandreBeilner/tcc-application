#!/usr/bin/env bash
# Backup completo (LW.3.12): pg_dump (formato custom) dos dois bancos, volume de avatares e o `.env`
# do servidor, tudo criptografado com age ANTES de sair do container; cópia local curta e envio ao
# armazenamento externo (rclone, Cloudflare R2) com retenção de 7 diários e 4 semanais.
# Uso: backup.sh   (variáveis em common.sh; HEALTHCHECK_URL opcional avisa início, sucesso ou falha)
set -Eeuo pipefail
# shellcheck source=common.sh
source /usr/local/lib/backup/common.sh

fail() {
  log "BACKUP FALHOU: $*"
  ping_monitor "${HEALTHCHECK_URL:-}" /fail
  exit 1
}
trap 'fail "erro na linha $LINENO"' ERR

ping_monitor "${HEALTHCHECK_URL:-}" /start
ts="$(date -u +%Y%m%dT%H%M%SZ)"
root="${BACKUP_DIR}/${BACKUP_ENV_NAME}"
out="${root}/daily/${ts}"
mkdir -p "$out"
manifest="${out}/manifest.txt"
{ echo "timestamp_utc=${ts}"; echo "ambiente=${BACKUP_ENV_NAME}"; echo "pg_dump=$(pg_dump --version)"; } > "$manifest"

for db in "${DATABASES[@]}"; do
  table="$(control_table "$db")"
  before="$(count_rows "$db" "$table")"
  log "dump de ${db} (${table}: ${before} linhas antes)"
  pg_dump -h "$PGHOST" -U "$PGUSER" -Fc "$db" | encrypt > "${out}/${db}.dump.age"
  after="$(count_rows "$db" "$table")"
  echo "${db}.${table}.antes=${before}" >> "$manifest"
  echo "${db}.${table}.depois=${after}" >> "$manifest"
done

if [ -d "$AVATAR_DIR" ]; then
  log "avatares"
  tar -czf - -C "$AVATAR_DIR" . | encrypt > "${out}/avatars.tar.gz.age"
fi

# O `.env` carrega o SIMULATION_SEED (imutável) e os segredos: sem ele o backup do banco não basta.
if [ -s "$APP_ENV_FILE" ]; then
  log "arquivo .env do servidor"
  encrypt < "$APP_ENV_FILE" > "${out}/app.env.age"
else
  log "aviso: .env do servidor não montado, ficou fora do backup"
fi

(cd "$out" && sha256sum -- *.age >> manifest.txt)

# Domingo também vira cópia semanal.
if [ "$(date -u +%u)" = "7" ]; then
  mkdir -p "${root}/weekly"
  cp -r "$out" "${root}/weekly/${ts}"
fi

if [ -n "${BACKUP_REMOTE:-}" ]; then
  remote="${BACKUP_REMOTE}/${BACKUP_ENV_NAME}"
  log "enviando para ${BACKUP_REMOTE}"
  rclone copy "$out" "${remote}/daily/${ts}"
  rclone check "$out" "${remote}/daily/${ts}" --one-way
  [ -d "${root}/weekly/${ts}" ] && { rclone copy "${root}/weekly/${ts}" "${remote}/weekly/${ts}"; }
  prune_remote "${remote}/daily" "$KEEP_DAILY"
  prune_remote "${remote}/weekly" "$KEEP_WEEKLY"
else
  log "aviso: BACKUP_REMOTE não definido, o backup ficou só neste servidor (não protege contra perda do servidor)"
fi

prune_local "${root}/daily" "$KEEP_LOCAL"
prune_local "${root}/weekly" 1
log "backup concluído: ${ts}"
ping_monitor "${HEALTHCHECK_URL:-}"
