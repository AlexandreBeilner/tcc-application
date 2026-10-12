#!/usr/bin/env bash
# Deploy de produção ou staging (LW.3.15). Um comando: backup -> pull -> up -> espera a saúde -> volta a
# versão anterior se falhar. As imagens vêm do GHCR por SHA (LW.3.13); o servidor nunca compila.
#
# Uso:
#   deploy.sh <prod|staging> <sha-de-40-caracteres> [--allow-peak] [--skip-staging-check]
#   deploy.sh <prod|staging> rollback   [--allow-peak]     # volta para a versão anterior (sem backup novo)
#   deploy.sh <prod|staging> status
#
# Janela de deploy: backend e motor são singletons (agendadores em processo), então NÃO existe deploy sem
# interrupção: o serviço fica fora do ar por alguns segundos, mais o tempo do boot (migrações incluídas).
# Evite o horário de pico (padrão 18h a 23h em São Paulo, `DEPLOY_AVOID_HOURS`); `--allow-peak` ignora.
#
# Migração que falha NÃO se desfaz sozinha: o rollback troca só a imagem. Se a versão nova já alterou o schema
# e a antiga não funciona com ele, restaurar do backup tirado no início deste deploy (runbook seção 3).
#
# Variáveis (todas opcionais): SELUCRA_DIR (/opt/selucra), DEPLOY_AVOID_HOURS (18-23), DEPLOY_HEALTH_TIMEOUT (240 s),
# DEPLOY_NOTIFY_URL (ping estilo healthchecks.io: /start, ok e /fail), DEPLOY_PULL=0 (só para testes).
set -Eeuo pipefail

DIR="${SELUCRA_DIR:-/opt/selucra}"
STATE="${DIR}/state"
AVOID_HOURS="${DEPLOY_AVOID_HOURS:-18-23}"
HEALTH_TIMEOUT="${DEPLOY_HEALTH_TIMEOUT:-240}"
SERVICES=(postgres redis engine backend)

log() { printf '%s [deploy] %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "${STATE}/deploy.log" >&2; }
die() { log "ERRO: $*"; ping_notify /fail; exit 1; }
ping_notify() { [ -n "${DEPLOY_NOTIFY_URL:-}" ] && { curl -fsS -m 10 --retry 2 -o /dev/null "${DEPLOY_NOTIFY_URL}${1:-}" || true; } || true; }

usage() { sed -n '2,13p' "$0" | sed 's/^# \{0,1\}//'; exit 2; }

target="${1:-}"; action="${2:-}"
case "$target" in prod) PROJECT=selucra-prod ;; staging) PROJECT=selucra-staging ;; *) usage ;; esac
[ -n "$action" ] || usage
shift 2 || true
allow_peak=0; skip_staging_check=0
for arg in "$@"; do
  case "$arg" in
    --allow-peak) allow_peak=1 ;;
    --skip-staging-check) skip_staging_check=1 ;;
    *) usage ;;
  esac
done

ENV_FILE="${DIR}/${target}.env"
COMPOSE_FILE="${DIR}/docker-compose.prod.yml"
mkdir -p "$STATE"
[ -f "$ENV_FILE" ] || die "não achei ${ENV_FILE}"
[ -f "$COMPOSE_FILE" ] || die "não achei ${COMPOSE_FILE}"

dc() { docker compose -p "$PROJECT" --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"; }
env_tag() { grep -E '^IMAGE_TAG=' "$ENV_FILE" | tail -n 1 | cut -d= -f2- | tr -d '"' | tr -d "'"; }
state_get() { cat "${STATE}/${target}.$1" 2>/dev/null || true; }
state_put() { printf '%s\n' "$2" > "${STATE}/${target}.$1"; }

if [ "$action" = status ]; then
  echo "ambiente: ${target}"
  echo "versão no .env: $(env_tag)"
  echo "versão anterior: $(state_get previous)"
  dc ps
  exit 0
fi

# Um deploy por vez (dois ao mesmo tempo brigariam pelas mesmas imagens e contêineres).
exec 9>"${STATE}/${target}.lock"
flock -n 9 || die "já existe um deploy de ${target} em andamento"

current="$(env_tag)"
if [ "$action" = rollback ]; then
  new="$(state_get previous)"
  [ -n "$new" ] || die "não há versão anterior registrada para voltar"
  do_backup=0
else
  new="$action"
  do_backup=1
fi
[[ "$new" =~ ^[0-9a-f]{40}$ ]] || die "a versão precisa ser um SHA de commit com 40 caracteres hexadecimais (nunca 'latest'): '${new}'"
[ "$new" != "$current" ] || die "a versão ${new:0:12} já é a que está no ar"
[ "$target" = staging ] && do_backup=0   # staging é descartável, sem backup (runbook seção 3)

# Produção só recebe o que passou pelo staging (a mesma imagem, validada).
if [ "$target" = prod ] && [ "$action" != rollback ] && [ "$skip_staging_check" = 0 ]; then
  on_staging="$(cat "${STATE}/staging.current" 2>/dev/null || true)"
  [ "$on_staging" = "$new" ] || die "a versão ${new:0:12} não é a que está no staging (${on_staging:0:12}). Valide no staging primeiro ou use --skip-staging-check"
fi

# Evita o horário de pico (horário de São Paulo).
if [ "$allow_peak" = 0 ] && [ "$target" = prod ]; then
  hour=$((10#$(TZ=America/Sao_Paulo date +%H)))
  from="${AVOID_HOURS%-*}"; to="${AVOID_HOURS#*-}"
  if [ "$hour" -ge "$from" ] && [ "$hour" -le "$to" ]; then
    die "agora são ${hour}h em São Paulo, dentro da janela de pico (${AVOID_HOURS}). Faça de madrugada ou use --allow-peak"
  fi
fi

# Espera todos os serviços saudáveis. Falha cedo em laço de reinício (migração que quebra o boot) ou "unhealthy".
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT)) svc id health running restarts all
  while [ "$SECONDS" -lt "$deadline" ]; do
    all=1
    for svc in "${SERVICES[@]}"; do
      id="$(dc ps -q "$svc" 2>/dev/null | head -n 1)"
      [ -n "$id" ] || { all=0; continue; }
      health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$id")"
      running="$(docker inspect -f '{{.State.Running}}' "$id")"
      restarts="$(docker inspect -f '{{.RestartCount}}' "$id")"
      if [ "$health" = unhealthy ] || [ "${restarts:-0}" -ge 3 ]; then
        log "${svc}: ${health}, ${restarts} reinício(s)"; dc logs --tail 15 "$svc" 2>&1 | sed 's/^/    /' >&2 || true; return 1
      fi
      [ "$health" = healthy ] && [ "$running" = true ] || all=0
    done
    [ "$all" = 1 ] && return 0
    sleep 3
  done
  log "tempo esgotado (${HEALTH_TIMEOUT} s) esperando os serviços ficarem saudáveis"
  return 1
}

apply_version() { IMAGE_TAG="$1" dc up -d --remove-orphans; }

log "=== ${target}: ${current:0:12} -> ${new:0:12} (${action}) ==="
ping_notify /start

# 1) Backup antes de qualquer mudança (com a imagem da versão ATUAL, que já está no servidor).
if [ "$do_backup" = 1 ]; then
  log "backup antes do deploy"
  IMAGE_TAG="$current" dc --profile tools run --rm backup backup.sh || die "o backup falhou: nada foi alterado, deploy abortado"
fi

# 2) Baixa as imagens novas. Se falhar, nada mudou.
if [ "${DEPLOY_PULL:-1}" = 1 ]; then
  log "baixando as imagens ${new:0:12}"
  IMAGE_TAG="$new" dc --profile tools pull backend engine backup || die "não consegui baixar as imagens: nada foi alterado"
fi

# 3) Sobe a versão nova e espera a saúde.
log "subindo a versão ${new:0:12} (o serviço fica fora do ar por alguns segundos)"
if apply_version "$new" && wait_healthy; then
  sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=${new}/" "$ENV_FILE"
  state_put previous "$current"   # também no rollback: o que acabamos de deixar vira "a anterior"
  state_put current "$new"
  log "deploy concluído: ${target} está em ${new:0:12}"
  ping_notify
  exit 0
fi

# 4) Falhou: volta a versão anterior.
log "FALHA ao subir ${new:0:12}: voltando para ${current:0:12}"
if apply_version "$current" && wait_healthy; then
  log "rollback concluído: ${target} voltou para ${current:0:12}."
  log "ATENÇÃO: se a versão nova aplicou uma migração, o banco pode estar à frente da imagem antiga. Se o app antigo não funciona, restaure do backup tirado no início deste deploy (runbook seção 3)."
  ping_notify /fail
  exit 1
fi
log "ROLLBACK TAMBÉM FALHOU. O serviço está fora do ar. Veja 'docker compose ps' e os logs; restaure do backup se for o caso (runbook seção 3)."
ping_notify /fail
exit 2
