# Runbook de operação (produção e staging)

Criado em 2026-10-12 (LW.3.12). Documento operacional: o que fazer, em que ordem, e como saber que deu certo.
Desenho do servidor e o porquê das escolhas: `analise-ambiente-producao.md`. Contas, chaves e variáveis:
`checklist-contas-e-segredos-producao.md`. **Seções marcadas "(LW.3.15)" serão preenchidas quando o `deploy.sh` existir.**

## 1. Visão em uma tela

- Um VPS (2 vCPU, 4 GB, São Paulo), três projetos do Compose: `selucra-prod`, `selucra-staging` (pode ficar desligado) e `selucra-edge` (Caddy, 80/443).
- Arquivos em `/opt/selucra/`: `docker-compose.prod.yml`, `docker-compose.edge.yml`, `infra/` (Caddyfile, init do Postgres), `prod.env` e `staging.env` (modo 600, **nunca no git**).
- Comandos curtos usados abaixo (ajuste o caminho do `.env` para staging):
  ```
  PROD="docker compose -p selucra-prod --env-file /opt/selucra/prod.env -f /opt/selucra/docker-compose.prod.yml"
  ```
- Backend e motor são **singletons**: nunca duas réplicas. Não existe deploy sem interrupção (janela de segundos).

## 2. Servidor novo, do zero

1. `docker network create selucra-edge`
2. Copiar `docker-compose.*.yml` e `infra/` para `/opt/selucra/`; criar `prod.env` a partir de `infra/env/prod.env.example` (segredos com `openssl rand -hex 24` / `-base64 48`). **Guardar uma cópia do `prod.env` em local seguro** (o `SIMULATION_SEED` é imutável e some com o servidor).
3. `docker login ghcr.io` com o token de leitura (`read:packages`) do usuário de deploy.
4. `$PROD up -d` e, depois, `docker compose -p selucra-edge --env-file /opt/selucra/prod.env -f /opt/selucra/docker-compose.edge.yml up -d`. As migrações rodam no boot do backend e do motor.
5. **Seeds (uma vez, nesta ordem; todos idempotentes):**
   1. catálogo do motor: `$PROD run --rm --entrypoint seed engine` (sem `--synthetic-*`)
   2. lições: `$PROD exec backend node dist/db/seedLessons.js` (só importa o que falta, nunca sobrescreve texto editado no painel)
   3. conquistas: `$PROD exec backend node dist/db/seedAchievements.js`
   4. missões: `$PROD exec backend node dist/db/seedMissions.js`
   5. administrador (por último): `$PROD exec -it backend node dist/db/seed.js` com `ADMIN_EMAIL` no ambiente; a senha **só digitada no terminal** (sem eco) ou por `ADMIN_PASSWORD_FILE` apagado em seguida; nunca em variável de ambiente nem linha de comando.
   Detalhes e a prova de idempotência: `analise-ambiente-producao.md` seção 7.
6. Backup: seção 3 abaixo (configurar antes de abrir ao público).

### Papéis do banco (LW.3.17)
O Postgres nasce com **três papéis sem superusuário** (`infra/postgres/init-prod/`, só na primeira inicialização do volume): `selucra_owner` (dono dos dois bancos, usado **só** para migrar no boot, via `DATABASE_MIGRATE_URL`), `gamification_app` (backend) e `market_app` (motor), estes dois **só com DML** (`SELECT/INSERT/UPDATE/DELETE`, sem DDL, sem `TRUNCATE`). O superusuário `POSTGRES_USER` fica só para administração e backup. Consequência intencional: o motor **não consegue** `DROP`/`DISABLE TRIGGER` do `market_events_append_only` nem `TRUNCATE` o log (o dono conseguiria; a migração 000034 desliga o gatilho). Tabelas novas de migrações futuras já chegam com o acesso certo (`ALTER DEFAULT PRIVILEGES`). Mudar a senha de um papel depois: `ALTER ROLE ... PASSWORD` com o superusuário **e** atualizar o `.env` (a variável só vale na criação). Conferir: `docker exec <postgres> psql -U <superusuário> -c '\du'`.

## 3. Backup e restauração (LW.3.12)

### O que é salvo
Por execução, em `daily/<timestamp UTC>/`: `gamification.dump.age` e `market.dump.age` (`pg_dump -Fc`), `avatars.tar.gz.age`, `app.env.age` (o `.env` do servidor, com o `SIMULATION_SEED`), `manifest.txt` (SHA-256 de cada arquivo e contagem de `users` e `market_events` antes e depois do dump). **Tudo é criptografado com `age` dentro do container, antes de sair do servidor.** Domingo também vira cópia semanal.
- **Retenção:** 7 diários e 4 semanais no armazenamento externo (Cloudflare R2); 3 cópias locais no volume `backup_data`.
- **Staging não tem backup** (descartável).
- **O Redis não é salvo:** só tem cache com validade, reconstruível.
- **RPO/RTO esperados:** perder no máximo 24 h de dados (backup às 03:30, horário de São Paulo); voltar em menos de 2 h (cronometrar no primeiro ensaio e registrar abaixo).

### Chaves (decisão de desenho)
- Backups são criptografados para **duas chaves públicas** `age`: a **principal**, cuja chave privada fica **fora do servidor** (gerenciador de senhas e uma cópia impressa/offline; sem ela não há restauração de desastre), e a de **teste**, cuja privada fica no servidor (`/opt/selucra/backup-test.agekey`, modo 600) só para o teste semanal automático. Quem invadir o servidor já alcança os dados vivos; quem invadir só o bucket R2 não consegue ler nada.
- Gerar: `docker run --rm --entrypoint age-keygen ghcr.io/alexandrebeilner/selucra-backup:<sha>` (uma vez para cada chave). As chaves públicas vão em `BACKUP_AGE_RECIPIENTS`.

### Agendamento
`infra/systemd/` tem os dois timers: backup diário 03:30 e teste de restauração aos domingos 05:00 (horário de São Paulo). Instalar: copiar os quatro arquivos para `/etc/systemd/system/`, `systemctl daemon-reload`, `systemctl enable --now selucra-backup.timer selucra-restore-test.timer`. Ver: `systemctl list-timers 'selucra-*'`, `journalctl -u selucra-backup -n 50`.

### Alerta (backup falhou ou não rodou)
Cada rotina avisa um monitor "dead man's switch" (healthchecks.io ou equivalente): `BACKUP_HEALTHCHECK_URL` e `RESTORE_TEST_HEALTHCHECK_URL`. O script chama `/start`, a URL (sucesso) e `/fail`; o monitor alerta por e-mail se um ping não chegar no prazo (configure período 1 dia e tolerância de 2 h para o backup, 7 dias para o teste). **Sem essas duas variáveis o backup funciona, mas nada avisa quando ele para.**

### Backup manual
`$PROD --profile tools run --rm backup backup.sh`

### Testar a restauração (semanal, automático; também manual)
`$PROD --profile tools run --rm backup restore-test.sh` (usa o R2; `restore-test.sh local` usa a cópia local). Restaura o backup mais recente em bancos descartáveis `restore_test_*`, confere o SHA-256, a contagem de linhas (entre as medidas de antes e depois do dump), **o gatilho `market_events_append_only` ativo e recusando `UPDATE`**, avatares e `.env` legíveis, e apaga os bancos de teste. Saída diferente de zero e ping `/fail` se qualquer coisa falhar.

### Restauração real (desastre ou servidor novo)
1. Servidor com os passos 1 a 3 da seção 2 feitos; **parar o backend e o motor**: `$PROD stop backend engine` (o script recusa se houver conexões ativas nos bancos).
2. Ter a chave privada principal do `age` em `/opt/selucra/restore.agekey` (a variável de ambiente do comando abaixo troca, só nesta execução, a chave de teste pela principal).
3. ```
   BACKUP_TEST_IDENTITY_FILE=/opt/selucra/restore.agekey $PROD --profile tools run --rm \
     --user root --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER backup restore.sh latest remote --yes
   ```
   (`latest` pode ser um timestamp; `local` no lugar de `remote` usa o volume local.) Restaura os dois bancos com `--clean --if-exists`, preservando donos, e os avatares; deixa o `.env` decifrado em `/work/app.env.restored` (dentro do container: copie para o servidor se precisar e apague).
4. `$PROD up -d`; conferir os healthchecks e rodar a **verificação de integridade** do painel admin (`/admin`, fonte da verdade de `market_events`).
5. Registrar a data, o backup usado e o tempo total na tabela abaixo.

### Registro de ensaios de restauração
| Data | Backup | Onde | Tempo | Resultado |
|---|---|---|---|---|
| 2026-10-12 | 20261012T131201Z | máquina de desenvolvimento, stack descartável, "remoto" simulado em disco (rclone `:local:`) | segundos (dados de teste: 1 usuário, 1930 eventos) | OK: bancos, gatilho append-only, avatares e `.env`; backup corrompido recusado. **Falta o ensaio cronometrado num servidor limpo com o R2 de verdade.** |

## 4. Deploy, rollback e migrações (LW.3.15)

Script: `infra/deploy/deploy.sh` (copiado para `/opt/selucra/deploy.sh`). Fluxo: **versão = SHA de 40 caracteres** do commit (o CI de imagens, LW.3.13, publica `selucra-backend`, `-engine` e `-backup` com essa tag; nunca `latest`).

```
./deploy.sh staging <sha>                 # 1. valida no staging
./deploy.sh prod <sha>                    # 2. promove a MESMA imagem (recusa se não for a do staging)
./deploy.sh prod rollback                 # volta para a versão anterior (sem backup novo)
./deploy.sh <prod|staging> status
```
Opções: `--allow-peak` (ignora a recusa do horário de pico, padrão 18h a 23h em São Paulo, `DEPLOY_AVOID_HOURS`), `--skip-staging-check` (emergência). `DEPLOY_NOTIFY_URL` opcional avisa um monitor (`/start`, ok, `/fail`).

**O que o script faz, nesta ordem:** (1) recusa versão inválida, igual à atual, ou produção sem passar pelo staging; (2) **backup** com a imagem da versão atual (se falhar, aborta sem tocar em nada); (3) `pull` das imagens novas (se falhar, nada mudou); (4) `up -d` e espera `postgres`, `redis`, `engine` e `backend` saudáveis (falha cedo em laço de reinício ou `unhealthy`; tempo máximo 240 s); (5) sucesso: grava `IMAGE_TAG` no `.env`; (6) falha: **volta sozinho** a versão anterior e sai com código 1 (código 2 se o rollback também falhar).

**Janela de deploy:** backend e motor são singletons (os agendadores rodam dentro do processo), então **não existe deploy sem interrupção**: o serviço cai por alguns segundos e depois leva o tempo do boot (migrações incluídas), na prática de 15 a 60 s. Faça de madrugada. A fila de e-mail, o ranking e o Temporizador retomam sozinhos (o Temporizador recupera os ticks perdidos até `TICK_MAX_CATCHUP`).

**Migrações:** rodam no boot do backend (Drizzle) e do motor (golang-migrate). Elas **não se desfazem sozinhas**: o rollback troca só a imagem. Casos:
- migração aditiva (coluna ou tabela nova): a imagem antiga costuma continuar funcionando; nada a fazer.
- migração que quebrou o boot (o deploy já voltou a versão antiga, o banco ficou na metade ou à frente): olhar `docker compose logs backend`/`engine`; se for estado "dirty" do golang-migrate, seguir a nota em memória do projeto antes de forçar versão; **se o app antigo não sobe com o schema novo, restaurar do backup tirado no início do deploy** (seção 3) e só então corrigir a migração.
- antes de qualquer migração que apague ou reescreva dado, confirmar que o backup do início do deploy existe (`docker compose ... run --rm backup ls` no volume, ou o log do `deploy.sh`).

**Ensaiado em 2026-10-12** (máquina de desenvolvimento, imagens locais por SHA, `DEPLOY_PULL=0`): deploy bom (14 s, com backup); versão quebrada (volta sozinha em 21 s, saída 1, app saudável na versão antiga); rollback manual; backup que falha aborta sem mudar nada; versão `latest`, igual à atual, fora do staging e dentro do pico são recusadas. **Falta ensaiar no staging do VPS real**, com o `pull` do GHCR.

## 5. Outras rotinas (a preencher conforme as tarefas)
- Girar segredos: LW.3.8/LW.3.11. Criar o admin com segurança: seção 2, passo 5.
- Se o motor ou o Temporizador parar: `$PROD ps`, `$PROD logs --tail 100 engine`; o `restart: unless-stopped` reinicia sozinho e o Temporizador recupera os ticks perdidos até `TICK_MAX_CATCHUP`.
- Estado "dirty" de migração (golang-migrate): ver a nota em memória do projeto antes de forçar versão; restaurar do backup é o caminho seguro quando uma migração destrutiva falhou.
