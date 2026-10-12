#!/usr/bin/env bash
# Funções comuns de backup/restauração (LW.3.12). Lidas com `source`.

: "${BACKUP_ENV_NAME:?defina BACKUP_ENV_NAME (production ou staging)}"
: "${PGHOST:?defina PGHOST}" "${PGUSER:?defina PGUSER}" "${PGPASSWORD:?defina PGPASSWORD}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
AVATAR_DIR="${AVATAR_DIR:-/data/avatars}"
APP_ENV_FILE="${APP_ENV_FILE:-/backup-input/app.env}"
AGE_IDENTITY_FILE="${AGE_IDENTITY_FILE:-/backup-input/age-identity}"
KEEP_DAILY="${KEEP_DAILY:-7}"
KEEP_WEEKLY="${KEEP_WEEKLY:-4}"
KEEP_LOCAL="${KEEP_LOCAL:-3}"
# Os dois bancos lógicos (spec seção 3): usuário/gamificação e mercado (Event Sourcing).
# shellcheck disable=SC2034  # usada pelos scripts que fazem source
DATABASES=(gamification market)

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Ping de monitoramento (healthchecks.io ou equivalente): `<url>/start`, `<url>` (ok), `<url>/fail`.
# Sem URL configurada o ping é ignorado, mas o alerta de "não rodou" depende dele (ver runbook).
ping_monitor() {
  local url="$1" suffix="${2:-}"
  [ -n "$url" ] || return 0
  curl -fsS -m 10 --retry 3 -o /dev/null "${url}${suffix}" || log "aviso: não consegui avisar o monitoramento (${suffix:-ok})"
}

# Chaves públicas do age (separadas por vírgula ou espaço): os backups são criptografados para todas.
age_recipient_args() {
  local r
  [ -n "${AGE_RECIPIENTS:-}" ] || { log "erro: defina AGE_RECIPIENTS (chaves públicas age)"; return 1; }
  for r in ${AGE_RECIPIENTS//,/ }; do printf -- '-r\n%s\n' "$r"; done
}

encrypt() {
  local args=()
  mapfile -t args < <(age_recipient_args)
  age "${args[@]}"
}

decrypt() { age -d -i "$AGE_IDENTITY_FILE"; }

# Contagens de controle (antes e depois do dump): o restore tem de cair entre as duas.
count_rows() {
  local db="$1" table="$2"
  psql -h "$PGHOST" -U "$PGUSER" -d "$db" -Atc "SELECT count(*) FROM ${table}"
}

# Tabela de controle de cada banco.
control_table() {
  case "$1" in
    gamification) echo users ;;
    market) echo market_events ;;
  esac
}

# Mantém só os `keep` diretórios mais novos (nomes são timestamps UTC, a ordem alfabética é a cronológica).
prune_local() {
  local dir="$1" keep="$2" old
  [ -d "$dir" ] || return 0
  while IFS= read -r old; do
    [ -n "$old" ] && { log "removendo cópia local antiga: $old"; rm -rf "${dir:?}/$old"; }
  done < <(ls -1 "$dir" | sort | head -n "-$keep")
}

prune_remote() {
  local path="$1" keep="$2" old
  while IFS= read -r old; do
    [ -n "$old" ] && { log "removendo cópia remota antiga: ${path}/${old}"; rclone purge "${path}/${old}"; }
  # Pasta ainda inexistente (primeira semana) não é erro. O `|| true` fica DENTRO da substituição: sem ele
  # o ERR trap herdado dispararia lá dentro e a mensagem de falha seria lida como nome de pasta a apagar.
  done < <({ rclone lsf --dirs-only "$path" 2>/dev/null || true; } | tr -d '/' | sort | head -n "-$keep")
}
