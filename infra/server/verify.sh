#!/usr/bin/env bash
# Confere o endurecimento do servidor (LW.3.11) e imprime o checklist com PASSOU/FALHOU.
# Roda no próprio servidor, como root: /opt/selucra/verify-hardening.sh
# Complementos que só existem de fora (nmap e login por senha): ver runbook seção 2.
set -uo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
fail=0
check() { # check "descrição" comando...
  local desc="$1"; shift
  if "$@" >/dev/null 2>&1; then printf 'PASSOU  %s\n' "$desc"; else printf 'FALHOU  %s\n' "$desc"; fail=1; fi
}
# Sempre captura a saída antes de filtrar: com `pipefail`, `grep -q` fecha o pipe cedo e o
# comando de cima morre por SIGPIPE, dando falso FALHOU.
sshd_has() {
  local out
  out="$(sshd -T 2>/dev/null)" || return 1
  grep -qix "$1" <<<"$out"
}
no_exposed_ports() {
  # Portas publicadas pelo Docker em 0.0.0.0 além de 80 e 443 passam por cima do ufw.
  local ports extra
  ports="$(docker ps --format '{{.Ports}}')" || return 1
  extra="$(tr ',' '\n' <<<"$ports" | grep -E '(0\.0\.0\.0|\[::\]):' | grep -vE ':(80|443)->' || true)"
  [ -z "$extra" ]
}
ufw_only_expected() {
  local out extra
  out="$(ufw status)" || return 1
  extra="$(grep -E '^[0-9]+' <<<"$out" | grep -vE "^($SSH_PORT|80|443)(/| )" || true)"
  grep -q '^Status: active' <<<"$out" && [ -z "$extra" ]
}

check "sshd: PermitRootLogin no" sshd_has "permitrootlogin no"
check "sshd: PasswordAuthentication no" sshd_has "passwordauthentication no"
check "sshd: KbdInteractiveAuthentication no" sshd_has "kbdinteractiveauthentication no"
check "sshd: AllowUsers só $DEPLOY_USER" sshd_has "allowusers $DEPLOY_USER"
check "sshd: porta $SSH_PORT" sshd_has "port $SSH_PORT"
no_sudo() { local g; g="$(id -nG "$DEPLOY_USER")" || return 1; ! tr ' ' '\n' <<<"$g" | grep -qxE 'sudo|admin|wheel'; }
check "usuário $DEPLOY_USER sem sudo" no_sudo
check "usuário $DEPLOY_USER tem chave autorizada" bash -c "grep -Eq '^(ssh-|ecdsa-|sk-)' \$(getent passwd $DEPLOY_USER | cut -d: -f6)/.ssh/authorized_keys"
check "ufw ativo" bash -c "ufw status | grep -q '^Status: active'"
check "ufw: entrada padrão negada" bash -c "ufw status verbose | grep -q 'deny (incoming)'"
check "ufw: só $SSH_PORT, 80 e 443 abertas" ufw_only_expected
check "Docker: nenhuma porta pública além de 80 e 443" no_exposed_ports
check "fail2ban ativo com a cela sshd" bash -c "fail2ban-client status sshd"
check "unattended-upgrades habilitado" bash -c "grep -q 'Unattended-Upgrade \"1\"' /etc/apt/apt.conf.d/20auto-upgrades"
check "relógio sincronizado" bash -c "timedatectl show -p NTPSynchronized --value | grep -qx yes"
check "timer do alerta de disco e memória ativo" systemctl is-active selucra-host-health.timer
check "alerta de disco e memória roda sem problema" /opt/selucra/host-health.sh

[ "$fail" -eq 0 ] && echo "TUDO CERTO" || echo "HÁ ITENS FALHANDO"
exit "$fail"
