# Pendências externas do lançamento web

Criado em **2026-10-12**, por decisão do autor: deixar a criação de contas e serviços externos para o final, com o código já
pronto e testado. Este documento é a **lista de execução** dessa parte: para cada dependência, o que já está pronto no repositório,
o que só o autor pode fazer, em que ordem, e como **provar** que funcionou. Complementa `checklist-contas-e-segredos-producao.md`
(desenho, contas e lista de variáveis) e `runbook-operacao.md` (como operar depois); não os substitui. Backlog das tarefas:
`backlog-lancamento-web-pwa.md`.

**Regra de ouro:** nada aqui bloqueia o desenvolvimento. Tudo o que está "pronto no código" foi provado com imagens reais num
ambiente descartável; o que falta provar é a mesma coisa no servidor e com os serviços de verdade.

## 0. Ordem sugerida (do que destrava mais para o que destrava menos)

| # | Dependência | Destrava | Seção |
|---|---|---|---|
| 1 | Domínio no Registro.br e conta na Cloudflare | todo o resto (DNS, HTTPS, Pages, e-mail) | 1 |
| 2 | VPS em São Paulo (2 vCPU, 4 GB) | produção, staging, ensaio de deploy e de backup | 2 |
| 3 | GitHub: primeiro push e GHCR | imagens por SHA, deploy | 3 |
| 4 | Cloudflare Pages (app, landing, staging) | frontend no ar | 4 |
| 5 | Resend (e-mail) | recuperação de senha, verificação de e-mail, avisos | 5 |
| 6 | Google OAuth em produção | login com Google | 6 |
| 7 | Cloudflare R2, chaves `age` e monitor dos backups | backup fora do servidor, teste de restauração | 7 |
| 8 | Monitor de uptime | alerta de queda | 8 |
| 9 | Stripe e RevenueCat (sandbox, depois produção) | cobrança do PRO | 9 |
| 10 | Contador, termos e política (LW.4.2) | **cobrar de verdade** | 10 |
| 11 | Aparelhos reais (iPhone e Android) | fechar o PWA (LW.2.6) | 11 |

Pode-se abrir 1, 2 e 5 em paralelo no primeiro dia: o domínio e a reputação do e-mail levam dias para propagar e amadurecer.

---

## 1. Domínio e Cloudflare (LW.3.2)

**Pronto no código:** Caddyfile com os hosts `api.selucra.com.br` e `api-staging.selucra.com.br` (`infra/caddy/Caddyfile`),
`FRONTEND_URL`/`PUBLIC_API_URL` obrigatórios e validados pela guarda de configuração (https, fora de localhost), cadeia de IP real
Cloudflare, Caddy, backend (LW.3.9).

**Falta fazer (autor):**
1. Registrar `selucra.com.br` no Registro.br (exige CPF/CNPJ do titular) e apontar os servidores de nome para a Cloudflare.
2. Cloudflare (plano gratuito): zona `selucra.com.br`; SSL/TLS em **"Full (strict)"**; registros:
   - `selucra.com.br` e `www` para o Pages da landing; `app` para o Pages do app (ver seção 4);
   - `api` apontando para o IP do VPS, **com proxy ligado** (nuvem laranja);
   - `staging` (Pages) e `api-staging` (IP do VPS, com proxy). Hífen e não `api.staging.`: o certificado gratuito cobre um nível só.
3. **Regra de Rate Limiting** (painel Cloudflare, gratuita): `api.selucra.com.br/auth/*`, por IP, valor sugerido de 20 requisições
   por minuto com bloqueio de 1 minuto. É a limitação por IP da produção (o Caddy puro não limita taxa; o nginx do `gateway/` só serve o desenvolvimento).
4. Cloudflare Access no `staging.selucra.com.br`, liberando só o e-mail do autor.
5. (Opcional) Cloudflare Web Analytics só no hostname da landing, nunca na zona inteira (ver o checklist, seção 3).

**Como provar:** `curl -sI https://api.selucra.com.br/health` responde 200 com `Strict-Transport-Security`; um `X-Forwarded-For`
falso no login não muda o balde do limitador (teste de LW.3.9 no staging); `https://www.ssllabs.com` e `securityheaders.com` (nota A).

## 2. VPS (LW.3.1, LW.3.7, LW.3.7b, LW.3.11)

**Pronto no código:** `docker-compose.prod.yml` (produção e staging no mesmo servidor), `docker-compose.edge.yml` (Caddy),
`infra/env/*.env.example`, `infra/deploy/deploy.sh`, runbook seção 2 (servidor novo, seeds). Decisões do autor: 2 vCPU e 4 GB,
produção com a maior parte dos recursos e staging com pouco (tetos em `staging.env.example`).

**Falta fazer (autor):**
1. Escolher o provedor em São Paulo (Vultr é o candidato; conferir o preço oficial no dia) e criar o VPS Ubuntu LTS, com IP fixo,
   chave SSH cadastrada e **snapshot semanal do provedor ligado**.
2. Criar o usuário de deploy, copiar `docker-compose.*.yml` e `infra/` para `/opt/selucra/` e preencher `prod.env` e `staging.env`
   a partir dos modelos (segredos com `openssl rand -hex 24` e `-base64 48`; **guardar uma cópia fora do servidor**, o
   `SIMULATION_SEED` nunca pode ser perdido).
3. `docker network create selucra-edge` e seguir o runbook seção 2 até os seeds.
4. **Endurecimento do servidor (LW.3.11, script pronto):** rodar `infra/server/bootstrap.sh` como root com `SSH_PUBLIC_KEY_FILE` (runbook seção 2),
   entrar por chave em outra janela, rodar `verify-hardening.sh`, preencher `HOST_MONITOR_URL` e assinar o checklist do runbook.

**Como provar (aceites que só existem no servidor real):**
- `nmap -p- <ip>` de fora mostra só 22, 80 e 443 (LW.3.7);
- `docker kill`-style: `docker exec <container> kill -TERM 1` num serviço faz ele voltar sozinho; reiniciar o servidor sobe tudo (`restart: unless-stopped`);
- medir o consumo com carga real: `docker stats` com usuários e bots rodando, para fechar o tamanho do VPS (LW.3.1);
- tentativa de login SSH por senha falha (LW.3.11).

## 3. GitHub e GHCR (LW.3.13)

**Pronto no código:** `.github/workflows/images.yml` (constrói `backend`, `engine` e `backup`, publica no GHCR por SHA de 40
caracteres, Trivy sem bloquear), bases com versão fixa, `REGISTRY_PREFIX=ghcr.io/alexandrebeilner/selucra`. O repositório é privado.

**Falta fazer (autor):**
1. Fazer o **primeiro push** para o GitHub (nada disto rodou ainda; o workflow só valida a sintaxe localmente).
2. Conferir em Actions que o job "Imagens" passou nos 3 serviços e que os pacotes `selucra-backend`, `selucra-engine` e
   `selucra-backup` aparecem **privados** em Packages, com a tag igual ao SHA do commit.
3. Criar um **token de acesso pessoal (classic) com `read:packages`** e, no VPS, `docker login ghcr.io -u alexandrebeilner`.
4. Proteger a `main` (exigir CI verde). **Regra do deploy:** só promover um SHA com os três CIs verdes (backend, motor, imagens),
   porque eles rodam em paralelo e o `deploy.sh` não consulta o GitHub.

**Como provar:** `docker pull ghcr.io/alexandrebeilner/selucra-backend:<sha>` no VPS funciona; `./deploy.sh staging <sha>` completa
(ensaio do roteiro de deploy bom, imagem quebrada e migração que falha, runbook seção 4).

## 4. Cloudflare Pages: app, landing e staging (LW.3.16, LW.3.4, LW.6.x)

**Pronto no código:** `frontend/public/_headers` e `_redirects` já existem (CSP, cabeçalhos e cache prontos e provados na LW.3.16; a regra de fora é refazer o checkout em staging);
`landing/` estático com CI próprio. Variáveis do frontend são **embutidas na hora do build** (trocar o valor exige novo build).

**Falta fazer (autor):**
1. Projeto Pages `frontend` ligado ao repositório (ou publicação pelo CI), domínio `app.selucra.com.br`, variáveis de build
   `VITE_GATEWAY_URL=https://api.selucra.com.br` e `VITE_REVENUECAT_WEB_PUBLIC_KEY` (chave pública, não é segredo).
2. Projeto `landing` em `selucra.com.br` e `www` (com `www` redirecionando para o domínio raiz).
3. Branch `staging` do Pages com `VITE_GATEWAY_URL=https://api-staging.selucra.com.br` só no ambiente de preview.

**Como provar:** F5 em `/mapa` não dá 404; o app de produção fala com `api.` sem erro de CORS; login e-mail/senha funcionam; a
instalação do PWA aparece no Chrome.

## 5. E-mail com Resend (LW.3.6)

**Pronto no código:** módulo `notifications` completo (outbox, worker, webhook assinado, supressão, templates), variáveis no
compose, guarda que **recusa** `EMAIL_PROVIDER=log` em produção, observabilidade da fila (`email_outbox` em `/health/ready`).

**Falta fazer (autor):**
1. Conta no Resend e **dois subdomínios verificados** (`send.selucra.com.br` para transacional e `news.selucra.com.br` para
   opcional), com SPF, DKIM e DMARC na Cloudflare, **sem proxy** (nuvem cinza).
2. Duas chaves de API "Sending access" (uma por subdomínio) para `RESEND_API_KEY_TRANSACTIONAL` e `RESEND_API_KEY_NEWS`.
3. Webhook assinado do Resend apontando para o endereço real do backend (rota em `.docs/backend/notifications.md`), com o segredo em
   `RESEND_WEBHOOK_SECRET`. Sem ele o backend sobe com aviso: bounces e reclamações não são processados.
4. Remetentes: `no-reply@send.selucra.com.br`, `no-reply@news.selucra.com.br`, reply-to `suporte@selucra.com.br`.

**Como provar:** recuperação de senha e verificação de e-mail chegam na **caixa de entrada** (não no spam) do Gmail e do Outlook;
um bounce de teste entra na lista de supressão. Aquecer o domínio com volume baixo no começo.

## 6. Google OAuth em produção (LW.3.2)

**Pronto no código:** login Google (`/auth/google/...`), callback configurável por `GOOGLE_REDIRECT_URI`, guarda de URL.

**Falta fazer (autor), no Google Cloud Console:** tela de consentimento em **"Em produção"** (sair do modo teste), domínio autorizado
`selucra.com.br`, URL da política `https://selucra.com.br/privacidade` (ou a do app), origem `https://app.selucra.com.br` e
redirecionamento `https://api.selucra.com.br/auth/google/callback`. Staging: cliente próprio ou o redirecionamento
`https://api-staging.selucra.com.br/auth/google/callback` adicionado. Colocar `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e
`GOOGLE_REDIRECT_URI` no `.env`.

**Como provar:** login com uma conta Google real no domínio de produção, de ponta a ponta.

## 7. Backup fora do servidor: R2, chaves `age` e monitor (LW.3.12)

**Pronto no código:** imagem `selucra-backup` (`infra/backup/`), `backup.sh`, `restore-test.sh`, `restore.sh`, timers em
`infra/systemd/`, runbook seção 3. Provado com dados reais e um "remoto" simulado em disco (inclusive backup corrompido recusado e
restauração real com o gatilho append-only preservado).

**Falta fazer (autor). Passo a passo combinado para quando chegarmos aqui:**
1. **Cloudflare R2:** criar um bucket **privado** (ex. `selucra-backups`) e um token de API **só desse bucket** com "Object Read &
   Write". Anotar endpoint (`https://<id-da-conta>.r2.cloudflarestorage.com`), `Access Key ID` e `Secret`.
2. **Chaves `age`:** gerar duas (principal e de teste) com `age-keygen` (comando no runbook). A **privada principal fica fora do
   servidor** (gerenciador de senhas e uma cópia offline); a de teste vai para `/opt/selucra/backup-test.agekey` (modo 600). As
   chaves **públicas** vão em `BACKUP_AGE_RECIPIENTS`. **Sem a privada principal não há restauração de desastre.**
3. **Monitor dos backups** (healthchecks.io, plano gratuito): criar dois checks, "backup" (período 1 dia, tolerância 2 h) e "teste de
   restauração" (período 7 dias), e copiar as URLs de ping para `BACKUP_HEALTHCHECK_URL` e `RESTORE_TEST_HEALTHCHECK_URL`.
4. Preencher no `prod.env`: `BACKUP_REMOTE=r2:<bucket>`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
5. Instalar os timers: copiar os 4 arquivos de `infra/systemd/` para `/etc/systemd/system/`, `systemctl daemon-reload` e
   `systemctl enable --now selucra-backup.timer selucra-restore-test.timer`.

**Como provar (aceite da LW.3.12):**
- rodar `backup.sh` à mão e ver o arquivo no R2; `restore-test.sh` passar;
- **ensaio cronometrado** de restauração num servidor limpo só com o backup e o runbook (alvo: menos de 2 h), registrado na tabela do runbook;
- parar o backup de propósito e ver o alerta chegar por e-mail.

## 8. Monitor de uptime (LW.3.5)

**Pronto no código:** `GET /health/ready` (200 ou 503; falha se motor, banco ou Redis caem, a fila de e-mail para, algum dos 9
agendadores atrasa ou o Temporizador do mercado para), logs JSON com `requestId`, contrato em `.docs/backend/system.md`.
Decisão de custo: **sem serviço de erros** (tipo Sentry) por enquanto.

**Falta fazer (autor):** criar uma conta gratuita (UptimeRobot, 50 monitores a cada 5 min, ou o próprio healthchecks.io) e dois
monitores: `https://api.selucra.com.br/health/ready` (alerta por e-mail se 5xx ou sem resposta) e `https://app.selucra.com.br`.
Staging: monitor opcional em `api-staging`, ligado só durante as validações.

**Como provar (aceite da LW.3.5):** derrubar o motor no staging (`docker compose -p selucra-staging stop engine`) e esperar o
e-mail de alerta; religar e ver o alerta de recuperação.

## 9. Cobrança: Stripe e RevenueCat (LW.4.1, LW.3.7b, LW.5.1)

**Pronto no código:** módulo `billing` completo (webhook como aviso e reconsulta REST, `isActive` por `expiresAt`), checkout web,
guarda que **recusa** `BILLING_PROVIDER=dev` em produção, variáveis no compose. Preços atuais (M4, revisados em 2026-10-11):
**mensal R$ 9,90 e anual R$ 89,90**, sem trial. (O checklist antigo citava os mesmos valores; os de R$ 19,90/199,90 e 19,97/199,97
são antigos e não valem.)

**Falta fazer (autor):**
1. **Primeiro em sandbox**, para o staging: projeto RevenueCat de teste (chave `rcb_sb_`/`sk_` de teste), Stripe em modo de teste
   conectado, produtos mensal e anual, Offering `default`, entitlement `pro`, webhook de teste apontando para
   `https://api-staging.selucra.com.br/billing/webhook` com `REVENUECAT_WEBHOOK_AUTH` secreto. Validar uma compra de teste ponta a ponta.
2. **Depois produção:** Stripe em modo real (exige CPF/CNPJ conforme o tipo de conta; **falar com o contador antes**, ver seção 10),
   mesmos produtos no RevenueCat de produção, webhook para `https://api.selucra.com.br/billing/webhook`, `VITE_REVENUECAT_WEB_PUBLIC_KEY`
   no Pages e `REVENUECAT_SECRET_KEY`/`REVENUECAT_WEBHOOK_AUTH`/`REVENUECAT_ENTITLEMENT_ID` no `.env`.
3. Domínio verificado no Stripe/RevenueCat para o checkout web (LW.4.3), e a conta de teste das lojas fica de fora das métricas.

**Como provar:** compra de teste no staging vira assinante PRO, cancelamento volta a gratuito sem apagar progresso; os números do
painel `/admin/assinaturas` batem com o painel do RevenueCat (aceite que ficou pendente da MO.9.x).

## 10. Contador, termos e política (LW.4.2)

**Pronto no código:** `/termos` e `/privacidade` sem valor pendente; o teste de conteúdo barra termos proibidos na interface.

**Falta fazer (autor), e **bloqueia cobrar de verdade**:** parecer do contador (nota fiscal, regime tributário: o Stripe não emite
NF-e; cobrança recorrente habitual tem consequência fiscal) e revisão jurídica dos rascunhos de termos, privacidade e reembolso
(garantia de 7 dias já prometida na tela `/planos`). A política deve citar a medição própria do funil de conversão (ponto 048 de
`pontos-em-aberto-decisao-produto.md`) antes de ir a produção.

## 11. Aparelhos reais: PWA instalado (LW.2.6, LW.2.1, LW.2.8)

**Pronto no código:** service worker que nunca guarda API, página offline, convite de instalação, atualização avisada, safe-area,
roteiro manual em `backlog-lancamento-web-pwa.md` (LW.2.6, andamento de 2026-10-12).

**Falta fazer (autor):**
- percorrer o roteiro (login, Google, checkout, links de e-mail, offline, atualização de versão) em **um iPhone e um Android**
  com o app em HTTPS real, instalado na tela inicial;
- tirar as **capturas de tela** do manifest (mobile e desktop) com a aplicação em produção;
- rodar o **Lighthouse** contra a produção (alvo do LW.2.8);
- decisão do autor sobre o evento de funil "instalou" (ainda aberta).

---

## 12. Já provado no código, aguardando o externo (resumo)

| Tarefa | O que foi provado | O que só o ambiente real fecha |
|---|---|---|
| LW.3.7, 3.7b | produção e staging juntos, sem porta publicada, reinício automático, limites de memória | `nmap` externo, reinício do servidor, consumo com carga |
| LW.3.9 | IP real pela cadeia Cloudflare, Caddy, backend, com Caddy real | o balde do limitador em `staging` |
| LW.3.10 | `helmet`, limites, rate limit no nginx de desenvolvimento | `securityheaders.com`, regra do Cloudflare em `/auth/*`, HSTS no Caddy real |
| LW.3.12 | backup, retenção, restauração e teste, com dados reais | R2 de verdade, monitor, ensaio cronometrado (RTO) |
| LW.3.13 | Dockerfiles com versão fixa e workflow validado (`actionlint`) | primeira execução no GitHub, pacotes privados no GHCR |
| LW.3.14 | `docker stop` encerra em menos de 1 s com código 0 | nada |
| LW.3.15 | deploy bom, imagem quebrada volta sozinha, rollback, recusas | ensaio no staging com `pull` do GHCR e migração que falha |
| LW.3.17 | papéis sem superusuário, gatilho append-only blindado | nada (provado por completo) |
| LW.3.5 | logs JSON, `/health/ready`, falha precisa ao derrubar motor e Postgres | alerta por e-mail chegando |

## 13. Ainda por fazer em código (não depende de serviço externo)

Para não confundir com a lista acima: LW.3.2, LW.3.4, LW.3.11 e LW.3.16 já estão feitas no código (o que falta de cada uma é conta, servidor
ou aparelho, listado nas seções acima). Resta só **LW.5.1/5.2** (roteiro mobile, link de privacidade e inventário do que está parado para mesclar).
