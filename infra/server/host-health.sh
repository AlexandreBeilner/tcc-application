#!/usr/bin/env bash
# Alerta de disco, memória e reinício pendente do servidor (LW.3.11). Roda a cada 15 min pelo
# timer selucra-host-health. Avisa o monitor externo: ping ok quando tudo bem, /fail com o
# motivo quando não. Sem HOST_MONITOR_URL só escreve no log (journalctl -t selucra-host-health).
set -uo pipefail

ENV_FILE="${HOST_HEALTH_ENV:-/etc/selucra/host-health.env}"
# shellcheck disable=SC1090
[ -r "$ENV_FILE" ] && . "$ENV_FILE"
DISK_MAX_PERCENT="${DISK_MAX_PERCENT:-85}"
MEM_MIN_AVAILABLE_PERCENT="${MEM_MIN_AVAILABLE_PERCENT:-10}"
MEMINFO="${MEMINFO:-/proc/meminfo}"
DISK_PATHS="${DISK_PATHS:-/ /var/lib/docker}"
REBOOT_FLAG="${REBOOT_FLAG:-/var/run/reboot-required}"

problems=()

for path in $DISK_PATHS; do
  [ -d "$path" ] || continue
  used="$(df --output=pcent "$path" | tail -1 | tr -dc '0-9')"
  if [ -n "$used" ] && [ "$used" -ge "$DISK_MAX_PERCENT" ]; then
    problems+=("disco ${path} em ${used}% (limite ${DISK_MAX_PERCENT}%)")
  fi
done

total="$(awk '/^MemTotal:/ {print $2}' "$MEMINFO")"
avail="$(awk '/^MemAvailable:/ {print $2}' "$MEMINFO")"
if [ -n "$total" ] && [ -n "$avail" ] && [ "$total" -gt 0 ]; then
  pct=$((avail * 100 / total))
  if [ "$pct" -lt "$MEM_MIN_AVAILABLE_PERCENT" ]; then
    problems+=("memória disponível ${pct}% (mínimo ${MEM_MIN_AVAILABLE_PERCENT}%)")
  fi
fi

if [ -e "$REBOOT_FLAG" ]; then
  problems+=("reinício pendente por atualização de segurança (fazer de madrugada)")
fi

ping() {
  [ -n "${HOST_MONITOR_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 2 -o /dev/null --data-raw "${2:-}" "${HOST_MONITOR_URL%/}${1}" || echo "aviso: não consegui avisar o monitor"
}

if [ "${#problems[@]}" -gt 0 ]; then
  msg="$(printf '%s; ' "${problems[@]}")"
  msg="${msg%; }"
  echo "ALERTA: $msg"
  ping /fail "$msg"
  exit 1
fi
echo "ok"
ping "" "ok"
