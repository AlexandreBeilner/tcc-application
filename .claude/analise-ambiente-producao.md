# Análise: do ambiente de desenvolvimento para produção

Análise pedida pelo autor em **2026-10-10**, com base no código real (`docker-compose.yml`, três `Dockerfile`s,
`gateway/nginx.conf`, `backend/src/server.ts` e `app.ts`, `engine/cmd/api/main.go`, `engine/cmd/seed`, CI).
É o "porquê" das tarefas LW.3.7 a LW.3.17 de `backlog-lancamento-web-pwa.md`. Alvo: **um VPS em São Paulo com
Docker Compose, Postgres próprio, frontend no Cloudflare Pages, orçamento de ~R$ 200 por mês**, deploy simples
e seguro. Não é decisão de produto; é a lista do que muda e do que impede um deploy limpo.

## 1. Princípios do alvo

1. **Imagem imutável, construída no CI, nunca no servidor.** O CI constrói `backend`, `engine` e `gateway`, marca com o
   SHA do commit e publica num registro (GHCR). O VPS só faz `pull` e `up -d`. Isso torna o rollback trivial (voltar a tag
   anterior) e evita compilar Go e TypeScript num servidor de R$ 100.
2. **Um comando de deploy** (`deploy.sh`) que faz backup, baixa as imagens, sobe, espera a saúde e, se falhar, volta a versão anterior.
3. **Segredos fora do repositório e sem valor padrão.** O compose de produção recusa subir com variável faltando.
4. **Nada exposto, exceto 80/443.** Banco, Redis, motor e backend ficam só em rede interna.
5. **Menor privilégio**: container sem root, sem capacidades, sistema de arquivos só de leitura onde der, usuário de banco sem superpoderes.
6. **Dev continua como está.** `docker-compose.yml` não muda; produção é um arquivo à parte.

## 2. Dev x produção, ponto a ponto

| Área | Hoje (dev) | Em produção | Tarefa |
|---|---|---|---|
| Portas | `5432`, `6379` e `8000` publicadas no host | só o proxy em 80/443; todo o resto em rede interna | LW.3.7 |
| Senhas | `tcc/tcc` padrão; Redis sem senha; `JWT_SECRET` com valor de dev | obrigatórias e fortes, sem padrão (`${VAR:?}`); Redis com `requirepass` | LW.3.7, LW.3.8 |
| Guarda de config | o backend sobe com qualquer valor | recusa subir com segredo fraco/de dev, e-mail em `log`, cobrança em `dev`, URL `localhost` (variável `DEPLOY_ENV`, não `NODE_ENV`) | LW.3.8 |
| Banco: usuário | um único `POSTGRES_USER` superusuário dono dos dois bancos | um papel por banco (`gamification_app`, `market_app`), sem superusuário, sem `CREATE ROLE`/`CREATEDB`; superusuário só para administração | LW.3.7 |
| Imagens | `build:` local no compose; tags sem versão (`postgres:16-alpine`, `redis:7-alpine`) | `image:` com tag de SHA vinda do registro; base images com versão fixa e, se possível, digest | LW.3.13 |
| Container | só o backend e o motor já rodam sem root | `read_only: true` + `tmpfs`, `cap_drop: [ALL]`, `no-new-privileges`, `pids_limit`, limite de memória/CPU, rotação de log | LW.3.7 |
| Vida do processo | sem `restart`, sem healthcheck, **sem tratamento de SIGTERM** (nenhum `graceful shutdown` no `server.ts` nem no motor) | `restart: unless-stopped`, healthcheck dos três (`/health` já existe), encerramento limpo (parar de aceitar, terminar requisição, parar schedulers, fechar banco) | LW.3.7, LW.3.14 |
| Migrações | rodam **no boot** do backend (`runMigrations`) e do motor (`db.Migrate`) | continua assim, mas **backup antes de cada deploy**; migração que falha deixa o container em laço de reinício, então o `deploy.sh` precisa detectar e reverter a imagem (o banco só reverte pelo backup) | LW.3.15 |
| Seeds | `npm run db:seed:*` (usa `tsx`, dependência de desenvolvimento, que não existe na imagem final); **o seed do catálogo do motor (`cmd/seed`) não é compilado na imagem** (o `Dockerfile` só builda `cmd/api`) | backend: rodar `node dist/db/seed*.js` (já compilado pelo `tsc`); motor: incluir o binário `seed` na imagem; documentar a ordem (admin, lições, conquistas, missões, catálogo) e que são idempotentes | LW.3.14 |
| Proxy | nginx simples em HTTP, sem TLS, sem cabeçalhos, sem limite de corpo/tempo | Caddy com TLS automático, HSTS, limites; nginx fora do caminho de produção (ver 3) | LW.3.7, LW.3.9, LW.3.10 |
| IP do cliente | `trust proxy 1` para um salto (nginx) | número de saltos igual à cadeia real; senão o limitador de taxa trata todos como um cliente só | LW.3.9 |
| Frontend | `vite dev` com proxy `/auth`, `/me`...; API na mesma origem | build estático com `VITE_GATEWAY_URL=https://api.selucra.com.br` e `VITE_REVENUECAT_WEB_PUBLIC_KEY` **embutidos na hora do build** (não mudam depois); `_redirects` para o roteamento da SPA (`/* /index.html 200`) e `_headers` (CSP, cache, `sw.js` sem cache longo) | LW.3.16 |
| Origens e URLs | `localhost` por toda parte | `FRONTEND_URL`, `PUBLIC_API_URL`, `GOOGLE_REDIRECT_URI` e as origens autorizadas no Google, mais as URLs dos webhooks do Resend e do RevenueCat, todas com o domínio real | LW.3.2 |
| Backup | nenhum | `pg_dump` dos dois bancos, criptografado, para fora do servidor, com teste de restauração e alerta | LW.3.12 |
| Estado em disco | volumes `postgres_data`, `redis_data`, `avatar_data` | os mesmos, com backup (inclusive `avatar_data`); classificar o que o Redis guarda (cache de cotação e ranking, reconstruível) para decidir se precisa persistir | LW.3.12 |
| Observabilidade | `console.log` | logs estruturados rotacionados, erro enviado a um serviço, `/health` monitorado de fora, alerta de backup, disco, motor parado | LW.3.5 |
| CI/CD | só `backend` e `engine` rodam lint/teste; nada constrói imagem, nada faz deploy; frontend sem CI | CI do frontend, construção e publicação de imagens por SHA, deploy por tag | LW.3.4, LW.3.13 |

## 3. O gateway nginx em produção

Hoje: `frontend → gateway (nginx) → backend → motor`. O nginx só repassa tudo para o backend; em produção o Caddy já termina
o TLS e pode repassar direto, então manter o nginx cria um salto a mais (e o problema do IP) sem benefício. **Recomendação:**
em produção o **Caddy faz o papel do gateway** (porta de entrada única, sem expor o motor). O `gateway/` continua no repositório
para o desenvolvimento. Isso é um desvio consciente da spec seção 3 ("proxy reverso como porta de entrada"): o papel continua,
muda a peça. Precisa de aceite do autor e de uma linha na spec. Com Caddy direto no backend e **sem** Cloudflare na frente,
`trust proxy 1` já está certo; com Cloudflare na frente, são 2.

## 4. Restrições que moldam o deploy (descobertas no código)

- **O backend e o motor são singletons.** Todos os agendadores rodam dentro do processo (folha de pagamento, ranking a cada 3 h,
  duelos, retrospectivas, assembleias, reconciliação de assinaturas, fila de e-mail; no motor, o Temporizador e os bots), e o
  limitador de taxa guarda o contador em memória. **Nunca subir duas réplicas**: duplicaria jobs e quebraria o limite. Portanto
  **não há deploy sem interrupção** (blue-green): o deploy tem uma janela de poucos segundos e precisa ser escolhida fora do horário de pico.
  Escalar para várias réplicas exigiria eleição de líder para os jobs e contador no Redis; fica fora do lançamento.
- **`SIMULATION_SEED` nunca muda** depois do primeiro dia (RNF08: série determinística entre reinícios). Entra no `.env` de
  produção como valor fixo e vai para o backup do `.env`.
- **O motor não tem autenticação**: quem alcançar `engine:8080` consegue `POST /admin/tick` e disparar eventos macro. Só é seguro
  porque a rede é interna; por isso a regra "nada de portas publicadas" é de segurança, não de arrumação. O backend é o único que fala com ele.
- **Migrações no boot** são aceitáveis para uma instância, mas qualquer migração que remova ou reescreva dado precisa de backup
  antes (o `market_events` é append-only por gatilho e é a fonte da verdade financeira).
- **Seed do admin:** `ADMIN_PASSWORD` lido de variável de ambiente deixa a senha no histórico do shell. Em produção, o seed lê a
  senha de um arquivo temporário ou prompt interativo, nunca da linha de comando.

## 5. Desenho alvo no servidor

```
/opt/selucra/
  docker-compose.prod.yml    # versionado no repositório, copiado no deploy
  Caddyfile                  # idem
  .env                       # modo 600, dono do usuário de deploy, NUNCA no git
  deploy.sh                  # backup -> pull -> up -d -> health -> rollback se falhar
  backups/                   # cópia local curta; cópia criptografada vai para o armazenamento externo
Rede "edge":     caddy, backend           (única com publicação 80/443, só o caddy)
Rede "internal": backend, engine, postgres, redis   (internal: true, sem saída para a internet)
```

- O backend precisa sair para a internet (RevenueCat, Resend, Google), então fica nas duas redes; **o banco e o Redis só na interna**.
- O motor só na interna (sem saída para a internet, já que não precisa).
- Atualizações do sistema operacional, firewall, SSH por chave e `fail2ban` na LW.3.11.

## 6. Tarefas novas (acrescidas ao backlog em 2026-10-10)

| Tarefa | Resumo |
|---|---|
| LW.3.13 | CI constrói e publica as imagens (GHCR) por SHA; compose de produção usa `image:` por tag; `.dockerignore` do gateway/frontend; varredura de vulnerabilidade das imagens |
| LW.3.14 | Encerramento limpo (SIGTERM) no backend e no motor; seed do catálogo do motor dentro da imagem; seeds do backend rodando a partir do `dist` |
| LW.3.15 | `deploy.sh` com backup prévio, health check e rollback; documentar a janela de deploy |
| LW.3.16 | Deploy do frontend no Cloudflare Pages: variáveis de build, `_redirects`, `_headers`, previews, domínio e rollback |
| LW.3.17 | Papéis de banco por serviço, sem superusuário; senha do admin da aplicação sem variável de ambiente |

As tarefas LW.3.7 a LW.3.12 já existentes cobrem rede, guardas de configuração, IP real, cabeçalhos, servidor e backup.

## 7. O que não vale fazer agora

- **Kubernetes, Swarm, Terraform**: sobra complexidade para um VPS, e os singletons impedem o ganho de réplicas.
- **Banco gerenciado, réplica de leitura, multi-região**: depois de validar tração.
- **Segredos em cofre dedicado (Vault etc.)**: o `.env` com modo 600 e backup criptografado basta no início; revisitar com mais de uma pessoa operando.
