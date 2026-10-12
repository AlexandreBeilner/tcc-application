#!/usr/bin/env bash
# Restauração REAL (LW.3.12), para um servidor novo ou depois de um desastre. DESTRUTIVA: recria o
# conteúdo dos bancos. Antes: backend e motor PARADOS (o script recusa se houver conexões ativas).
# Uso: restore.sh <timestamp|latest> [local|remote] --yes
#   Rode com `--user root --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER` (o serviço descarta todas as
#   capacidades): o volume de avatares
#   pertence ao usuário `node` do backend e o usuário `backup` não consegue escrever nele.
#   Restaura os dois bancos (preservando os donos dos objetos: os papéis precisam existir, o script de
#   inicialização do Postgres já os cria) e os avatares. O `.env` NÃO é restaurado sozinho: o script só
#   o decifra para `/work/app.env.restored`, e quem opera o copia para o servidor.
set -Eeuo pipefail
# shellcheck source=common.sh
source /usr/local/lib/backup/common.sh

[ "${3:-}" = "--yes" ] || { echo "restauração destrutiva: repita o comando com --yes no fim"; exit 2; }
which_backup="${1:?informe o timestamp (ex. 20261012T063000Z) ou latest}"
source_kind="${2:-$([ -n "${BACKUP_REMOTE:-}" ] && echo remote || echo local)}"
work="$(mktemp -d /work/restore.XXXXXX)"
trap 'rm -rf "$work"' EXIT

if [ "$source_kind" = remote ]; then
  remote="${BACKUP_REMOTE:?BACKUP_REMOTE não definido}/${BACKUP_ENV_NAME}/daily"
  [ "$which_backup" = latest ] && which_backup="$(rclone lsf --dirs-only "$remote" | tr -d '/' | sort | tail -n 1)"
  rclone copy "${remote}/${which_backup}" "${work}/data"
else
  base="${BACKUP_DIR}/${BACKUP_ENV_NAME}/daily"
  [ "$which_backup" = latest ] && which_backup="$(ls -1 "$base" | sort | tail -n 1)"
  cp -r "${base}/${which_backup}" "${work}/data"
fi
log "restaurando o backup ${which_backup} (${source_kind})"
(cd "${work}/data" && sha256sum -c <(grep '\.age$' manifest.txt))

for db in "${DATABASES[@]}"; do
  active="$(psql -h "$PGHOST" -U "$PGUSER" -d postgres -Atc "SELECT count(*) FROM pg_stat_activity WHERE datname='${db}' AND pid <> pg_backend_pid()")"
  [ "$active" = "0" ] || { log "erro: ${active} conexão(ões) ativa(s) em ${db}; pare o backend e o motor antes"; exit 1; }
done

for db in "${DATABASES[@]}"; do
  log "restaurando ${db}"
  decrypt < "${work}/data/${db}.dump.age" > "${work}/${db}.dump"
  pg_restore -h "$PGHOST" -U "$PGUSER" --clean --if-exists --exit-on-error -d "$db" "${work}/${db}.dump"
done

if [ -f "${work}/data/avatars.tar.gz.age" ] && [ -d "$AVATAR_DIR" ]; then
  log "restaurando avatares"
  [ "$(id -u)" = "0" ] || { log "erro: restaurar avatares exige --user root e as capacidades CHOWN, DAC_OVERRIDE e FOWNER (ver o cabeçalho)"; exit 1; }
  decrypt < "${work}/data/avatars.tar.gz.age" | tar -xzmf - -C "$AVATAR_DIR" --no-same-owner
  # Mesmo dono do backend (usuário `node`, uid 1000 na imagem), senão ele não consegue trocar a foto.
  chown -R "${AVATAR_OWNER:-1000:1000}" "$AVATAR_DIR"
fi
if [ -f "${work}/data/app.env.age" ]; then
  decrypt < "${work}/data/app.env.age" > /work/app.env.restored
  chmod 600 /work/app.env.restored
  log ".env decifrado em /work/app.env.restored (copie para o servidor e apague)"
fi
log "restauração concluída: ${which_backup}. Suba o motor e o backend e rode a verificação de integridade do painel admin."
