#!/usr/bin/env bash
# Gera o `.env` de staging ou de produção no servidor, com os segredos criados ali mesmo (nenhum segredo
# passa por chat, por e-mail nem pelo repositório). Ver .claude/runbook-operacao.md seção 2.
#
#   init-env.sh <staging|prod> <sha-de-40-caracteres> [--acme-email voce@dominio] [--force]
#
# O que faz: copia `infra/env/<ambiente>.env.example` para `/opt/selucra/<ambiente>.env` (modo 600) e troca
# por valores aleatórios as senhas do Postgres e do Redis, JWT_SECRET, EMAIL_UNSUBSCRIBE_SECRET e
# SIMULATION_SEED, e grava o IMAGE_TAG. O que depende de uma conta externa (Resend, Google, RevenueCat,
# R2, monitores) continua como `<...>` no modelo: a linha vira comentário, para o arquivo carregar sem
# erro. Cobrança sem chave real vira `BILLING_PROVIDER=disabled`.
#
# Produção só sobe com `EMAIL_PROVIDER=resend` (a guarda de configuração recusa o resto): este script avisa
# o que falta. O staging aceita `EMAIL_PROVIDER=log`.
#
# Variáveis: SELUCRA_DIR (padrão /opt/selucra). Recusa sobrescrever um `.env` existente sem `--force`
# (o SIMULATION_SEED é imutável: refazer o arquivo de produção depois do primeiro dia muda o mercado).
set -euo pipefail

DIR="${SELUCRA_DIR:-/opt/selucra}"
log() { printf '[init-env] %s\n' "$*"; }
die() { printf '[init-env] ERRO: %s\n' "$*" >&2; exit 1; }

target="${1:-}"; sha="${2:-}"
shift 2 2>/dev/null || true
force=0; acme_email=""
while [ $# -gt 0 ]; do
  case "$1" in
    --force) force=1 ;;
    --acme-email) acme_email="${2:-}"; shift ;;
    *) die "opção desconhecida: $1" ;;
  esac
  shift
done
case "$target" in staging | prod) ;; *) die "uso: init-env.sh <staging|prod> <sha-de-40-caracteres> [--acme-email x] [--force]" ;; esac
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || die "informe o SHA do commit com 40 caracteres hexadecimais (nunca 'latest')"
command -v openssl >/dev/null || die "openssl não encontrado"

example="${DIR}/infra/env/${target}.env.example"
out="${DIR}/${target}.env"
[ -f "$example" ] || die "não achei ${example} (copie a pasta infra/ para ${DIR} antes)"
if [ -e "$out" ] && [ "$force" = 0 ]; then die "${out} já existe. Use --force só se tiver certeza (o SIMULATION_SEED de produção não pode mudar)"; fi

hex() { openssl rand -hex 24; }
b64() { openssl rand -base64 48 | tr -d '\n'; }
seed() { printf '%d' $((0x$(openssl rand -hex 4) % 900000000 + 100000000)); }

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
umask 077

declare -A fixed=(
  [IMAGE_TAG]="$sha"
  [POSTGRES_PASSWORD]="$(hex)"
  [DB_OWNER_PASSWORD]="$(hex)"
  [GAMIFICATION_APP_PASSWORD]="$(hex)"
  [MARKET_APP_PASSWORD]="$(hex)"
  [REDIS_PASSWORD]="$(hex)"
  [SIMULATION_SEED]="$(seed)"
  [JWT_SECRET]="$(b64)"
  [EMAIL_UNSUBSCRIBE_SECRET]="$(b64)"
)
[ -n "$acme_email" ] && fixed[ACME_EMAIL]="$acme_email"

pending=()
while IFS= read -r line || [ -n "$line" ]; do
  if [[ "$line" =~ ^([A-Z0-9_]+)=(.*)$ ]]; then
    key="${BASH_REMATCH[1]}"
    if [ -n "${fixed[$key]+x}" ]; then
      printf '%s=%s\n' "$key" "${fixed[$key]}" >>"$tmp"
      continue
    fi
    if [[ "$line" == *"<"*">"* ]]; then
      pending+=("$key")
      printf '# PENDENTE: %s\n' "$line" >>"$tmp"
      continue
    fi
  fi
  printf '%s\n' "$line" >>"$tmp"
done <"$example"

# Sem chave real de cobrança, o servidor sobe com a cobrança desligada (a tela de planos mostra "ainda não disponível").
if printf '%s\n' "${pending[@]:-}" | grep -qx 'REVENUECAT_SECRET_KEY'; then
  sed -i 's/^BILLING_PROVIDER=.*/BILLING_PROVIDER=disabled/' "$tmp"
fi

if [ "$target" = prod ] && printf '%s\n' "${pending[@]:-}" | grep -qE '^(EMAIL_FROM_TRANSACTIONAL|RESEND_API_KEY_TRANSACTIONAL)$'; then
  log "ATENÇÃO: produção exige EMAIL_PROVIDER=resend com as chaves do Resend. Sem elas o backend recusa subir."
fi

install -m 600 "$tmp" "$out"
log "gerado ${out} (modo 600) para a versão ${sha:0:12}"
if [ "${#pending[@]}" -gt 0 ]; then
  log "pendente (depende de conta externa; linhas comentadas com PENDENTE): ${pending[*]}"
fi
log "GUARDE UMA CÓPIA do arquivo fora do servidor (gerenciador de senhas): o SIMULATION_SEED e as senhas dos bancos não se recuperam."
