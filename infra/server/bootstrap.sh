#!/usr/bin/env bash
# Endurecimento do VPS (LW.3.11). Ubuntu LTS, rodar como root, uma vez por servidor novo
# (idempotente: pode rodar de novo). Ver .claude/runbook-operacao.md seção 2.
#
#   sudo DEPLOY_USER=deploy ./bootstrap.sh
#
# Trava de segurança contra se trancar fora: o script SÓ desliga senha e login de root se o
# usuário de deploy já tiver pelo menos uma chave em ~/.ssh/authorized_keys (ou se
# SSH_PUBLIC_KEY_FILE apontar para uma chave pública, que ele instala). Mantenha a sessão
# SSH atual aberta e teste um segundo login por chave antes de fechá-la.
#
# Variáveis opcionais:
#   DEPLOY_USER           usuário sem privilégio que opera o Docker (padrão: deploy)
#   SSH_PUBLIC_KEY_FILE   chave pública a instalar para o usuário de deploy
#   SSH_PORT              padrão 22 (decisão do autor: porta 22 com fail2ban)
#   SKIP_FIREWALL=1       não mexe no ufw (testes em container)
#   SKIP_PACKAGES=1       não roda apt (testes em container com pacotes já instalados)
#   SKIP_DOCKER=1         não instala o Docker (já instalado, ou teste em container)
set -euo pipefail

DEPLOY_USER="${DEPLOY_USER:-deploy}"
SSH_PORT="${SSH_PORT:-22}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${BOOTSTRAP_ROOT:-}" # prefixo de teste; vazio no servidor real

log() { printf '[bootstrap] %s\n' "$*"; }
die() { printf '[bootstrap] ERRO: %s\n' "$*" >&2; exit 1; }
has_systemd() { [ -d /run/systemd/system ]; }

[ "$(id -u)" -eq 0 ] || die "rode como root (sudo)"
[[ "$DEPLOY_USER" =~ ^[a-z][a-z0-9_-]{0,31}$ ]] || die "DEPLOY_USER inválido"
[[ "$SSH_PORT" =~ ^[0-9]+$ ]] || die "SSH_PORT inválida"

# 1. Pacotes -----------------------------------------------------------------------------
if [ "${SKIP_PACKAGES:-0}" != 1 ]; then
  log "instalando pacotes"
  export DEBIAN_FRONTEND=noninteractive
  apt-get update -qq
  apt-get install -y -qq ufw fail2ban unattended-upgrades chrony curl ca-certificates acl >/dev/null
fi

# 1b. Docker Engine e Compose, do repositório oficial da Docker (o do Ubuntu fica defasado) ----
if [ "${SKIP_DOCKER:-0}" != 1 ] && [ "${SKIP_PACKAGES:-0}" != 1 ] && ! command -v docker >/dev/null 2>&1; then
  log "instalando o Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  # shellcheck disable=SC1091
  codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $codename stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null
  if has_systemd; then systemctl enable --now docker >/dev/null 2>&1; fi
fi

# 2. Usuário de deploy: sem sudo; no grupo docker (necessário para operar o compose) ------
if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  log "criando usuário $DEPLOY_USER"
  adduser --disabled-password --gecos "" "$DEPLOY_USER" >/dev/null
fi
if getent group docker >/dev/null; then usermod -aG docker "$DEPLOY_USER"; fi
# Nunca sudo/admin: quem precisa de root entra como outro caminho (console do provedor).
for g in sudo admin wheel; do
  if getent group "$g" >/dev/null && id -nG "$DEPLOY_USER" | tr ' ' '\n' | grep -qx "$g"; then
    gpasswd -d "$DEPLOY_USER" "$g" >/dev/null
  fi
done
HOME_DIR="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$HOME_DIR/.ssh"
AUTH="$HOME_DIR/.ssh/authorized_keys"
touch "$AUTH"
if [ -n "${SSH_PUBLIC_KEY_FILE:-}" ]; then
  [ -r "$SSH_PUBLIC_KEY_FILE" ] || die "não consigo ler $SSH_PUBLIC_KEY_FILE"
  while IFS= read -r key; do
    [ -n "$key" ] && ! grep -qxF "$key" "$AUTH" && printf '%s\n' "$key" >>"$AUTH"
  done <"$SSH_PUBLIC_KEY_FILE"
fi
chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"
chmod 600 "$AUTH"
grep -Eq '^(ssh-|ecdsa-|sk-)' "$AUTH" ||
  die "$AUTH não tem nenhuma chave pública. Instale uma (SSH_PUBLIC_KEY_FILE=...) antes de desligar a senha, senão você se tranca fora."

# 3. SSH: só chave, sem root --------------------------------------------------------------
# O arquivo começa com 00- para ser lido ANTES do 50-cloud-init.conf (que costuma ligar
# PasswordAuthentication): no sshd vale o primeiro valor encontrado.
SSHD_DROPIN="$ROOT/etc/ssh/sshd_config.d/00-selucra-hardening.conf"
mkdir -p "$(dirname "$SSHD_DROPIN")"
cat >"$SSHD_DROPIN" <<CONF
# Gerado por infra/server/bootstrap.sh (LW.3.11). Não editar à mão.
Port $SSH_PORT
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AuthenticationMethods publickey
PermitEmptyPasswords no
AllowUsers $DEPLOY_USER
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
ClientAliveInterval 300
ClientAliveCountMax 2
CONF
chmod 644 "$SSHD_DROPIN"
if command -v sshd >/dev/null 2>&1; then
  mkdir -p /run/sshd
  sshd -t || { rm -f "$SSHD_DROPIN"; die "configuração do sshd inválida, mudança desfeita"; }
  if has_systemd; then systemctl reload ssh 2>/dev/null || systemctl reload sshd; fi
fi
log "SSH: só chave, sem root, AllowUsers $DEPLOY_USER (porta $SSH_PORT)"

# 4. Firewall -----------------------------------------------------------------------------
# O Docker publica portas por iptables e passa por cima do ufw: por isso o compose de
# produção NÃO publica nada além de 80/443 do Caddy (conferido pelo verify.sh).
if [ "${SKIP_FIREWALL:-0}" != 1 ]; then
  ufw --force reset >/dev/null
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw limit "$SSH_PORT/tcp" >/dev/null # limita tentativas repetidas, complementa o fail2ban
  ufw allow 80/tcp >/dev/null
  ufw allow 443/tcp >/dev/null
  ufw allow 443/udp >/dev/null # HTTP/3 do Caddy
  ufw --force enable >/dev/null
  log "ufw: só $SSH_PORT, 80 e 443"
fi

# 5. fail2ban -----------------------------------------------------------------------------
F2B="$ROOT/etc/fail2ban/jail.d/selucra.local"
mkdir -p "$(dirname "$F2B")"
cat >"$F2B" <<CONF
# Gerado por infra/server/bootstrap.sh (LW.3.11).
[DEFAULT]
bantime  = 1h
findtime = 10m
maxretry = 4
backend  = systemd

[sshd]
enabled = true
port    = $SSH_PORT
CONF
if has_systemd; then systemctl enable --now fail2ban >/dev/null 2>&1; systemctl restart fail2ban; fi

# 6. Atualizações automáticas de segurança ------------------------------------------------
# Sem reinício automático: backend e motor são singletons e um reboot derruba o app. O
# host-health.sh avisa quando há reinício pendente, e ele é feito de madrugada à mão.
mkdir -p "$ROOT/etc/apt/apt.conf.d"
cat >"$ROOT/etc/apt/apt.conf.d/20auto-upgrades" <<'CONF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
CONF
cat >"$ROOT/etc/apt/apt.conf.d/52selucra-unattended" <<'CONF'
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
CONF

# 7. Relógio -------------------------------------------------------------------------------
# O Temporizador do mercado e os tokens (JWT, links de e-mail) dependem de hora correta.
if has_systemd; then
  systemctl enable --now chrony >/dev/null 2>&1 || true
  timedatectl set-timezone UTC 2>/dev/null || true
fi

# 8. Alerta de disco, memória e reinício pendente ----------------------------------------
install -d -m 755 "$ROOT/opt/selucra" "$ROOT/etc/selucra"
# O deploy copia os compose e `infra/` e grava os `.env` aqui sem sudo (o usuário de deploy já está no grupo docker).
chown "$DEPLOY_USER:$DEPLOY_USER" "$ROOT/opt/selucra"
install -m 755 "$HERE/host-health.sh" "$ROOT/opt/selucra/host-health.sh"
install -m 755 "$HERE/verify.sh" "$ROOT/opt/selucra/verify-hardening.sh"
if [ ! -f "$ROOT/etc/selucra/host-health.env" ]; then
  cat >"$ROOT/etc/selucra/host-health.env" <<'CONF'
# URL de ping do monitor (healthchecks.io ou equivalente). Sem ela o alerta só vai para o log.
HOST_MONITOR_URL=
DISK_MAX_PERCENT=85
MEM_MIN_AVAILABLE_PERCENT=10
CONF
  chmod 600 "$ROOT/etc/selucra/host-health.env"
fi
if has_systemd && [ -f "$HERE/../systemd/selucra-host-health.timer" ]; then
  install -m 644 "$HERE/../systemd/selucra-host-health.service" /etc/systemd/system/
  install -m 644 "$HERE/../systemd/selucra-host-health.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now selucra-host-health.timer >/dev/null
fi

log "pronto. Agora: (1) abra OUTRA sessão e entre como $DEPLOY_USER por chave; (2) rode /opt/selucra/verify-hardening.sh; (3) preencha /etc/selucra/host-health.env."
