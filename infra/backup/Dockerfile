# Ferramentas de backup e restauração (LW.3.12): pg_dump/pg_restore, age (criptografia) e rclone (envio
# para o armazenamento externo, Cloudflare R2). Imagem própria para o servidor não instalar nada e para o
# mesmo script rodar no teste de restauração semanal. Publicada pelo CI junto com as outras.
FROM alpine:3.21.8
RUN apk add --no-cache bash age rclone postgresql16-client tar gzip coreutils curl tzdata \
    && adduser -D -u 10001 -g '' backup \
    && mkdir -p /backups /work && chown backup:backup /backups /work
COPY common.sh /usr/local/lib/backup/common.sh
COPY backup.sh restore.sh restore-test.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/restore.sh /usr/local/bin/restore-test.sh
USER backup
WORKDIR /work
ENTRYPOINT []
