# Registro do ambiente de produção e staging (como está configurado e como chegou aqui)

Criado em **2026-10-12**, no dia em que o ambiente real foi montado de ponta a ponta. Serve para responder, daqui a meses, "o que
existe, onde está, por que foi feito assim e o que já deu problema". **Não contém nenhum segredo**: onde um valor secreto mora,
só está dito *onde*, nunca *qual é*.

Documentos que se complementam (não repetem este):
- `checklist-atualizar-producao.md`: o roteiro de todo dia para publicar uma versão (use este para operar).
- `runbook-operacao.md`: como operar, o que o `deploy.sh` faz por dentro, backup e restauração, suporte de reembolso.
- `pendencias-externas-lancamento.md`: o que ainda falta e o estado de cada dependência externa.
- `checklist-contas-e-segredos-producao.md`: lista de contas e de variáveis de ambiente.
- `analise-ambiente-producao.md`: o porquê das decisões de desenho (dev x produção).

---

## 1. Visão em uma tela

```
Usuário
  │
  ├─ selucra.com.br, www ──────────► Cloudflare Pages, projeto `selucra-landing` (site estático, pasta landing/)
  ├─ app.selucra.com.br ───────────► Cloudflare Pages, projeto `selucra-app` (branch `main`, pasta frontend/)
  ├─ staging.selucra.com.br ───────► Cloudflare Pages, projeto `selucra-staging` (branch `staging`), atrás do Cloudflare Access
  │
  ├─ api.selucra.com.br ───────┐
  └─ api-staging.selucra.com.br┤──► Cloudflare (proxy, SSL "Full (strict)")
                               │         │
                               │         ▼
                               │   VPS Vultr, São Paulo, IP 216.128.172.57  (Ubuntu 24.04, 2 vCPU, 4 GB, 100 GB NVMe)
                               │     Caddy (portas 80/443, o único com porta publicada)
                               │       ├─ api.*          ──► backend-prod:3000    ─┐
                               │       └─ api-staging.*  ──► backend-staging:3000 ─┤  cada ambiente com o seu
                               │                                                    │  Postgres, Redis, motor (Go)
                               │                                                    ▼
                               └─ Backup noturno criptografado ──► Cloudflare R2 (bucket `selucra-backups`)
```

Dois ambientes no **mesmo VPS**, isolados (projetos Docker Compose separados, bancos, Redis, volumes e segredos próprios):
**produção** (`selucra-prod`, a maior parte da memória) e **staging** (`selucra-staging`, enxuto). O Caddy é um projeto à parte
(`selucra-edge`) e atende os dois pelo nome do host.

## 2. Inventário: serviços, contas e o que há em cada um

Nenhum segredo aqui. "Mora em" diz onde a credencial está.

| Peça | O que é / configuração | Credencial mora em |
|---|---|---|
| **Domínio** `selucra.com.br` | Registrado no Registro.br; servidores de nome apontam para a Cloudflare | conta do Registro.br |
| **Cloudflare** (plano gratuito) | DNS da zona, SSL/TLS **Full (strict)**, Always Use HTTPS, TLS mínimo 1.2, proxy ligado na `api`, Pages, Access, R2 | conta Cloudflare |
| **VPS** Vultr, São Paulo | Ubuntu 24.04 LTS, 2 vCPU AMD, 4 GB, 100 GB NVMe, IPv4 público, sem IPv6. Rótulo `selucra-prod` | conta Vultr; chave SSH `~/.ssh/selucra_vps` no computador do autor |
| **GitHub** | Repositório `AlexandreBeilner/tcc-application`; CI; **GHCR** privado com as imagens por SHA | conta GitHub; token `read:packages` salvo no servidor (veja 6.4) |
| **Cloudflare Pages** | 3 projetos: `selucra-landing`, `selucra-app`, `selucra-staging` | variáveis de build no painel do Pages |
| **Cloudflare Access** (Zero Trust, plano Free) | Aplicação "Selucra Staging" protege `staging.selucra.com.br`; política "Somente o autor", código por e-mail | conta Cloudflare |
| **Resend** (e-mail) | Domínios verificados `send.selucra.com.br` (transacional) e `news.selucra.com.br` (opcional); DMARC `p=none` na raiz; duas chaves "Sending access", uma por domínio; webhook assinado em `https://api.selucra.com.br/webhooks/resend` | `prod.env` no servidor |
| **Google OAuth** | Projeto "Selucra" no Google Cloud; tela de consentimento **publicada** (não em teste); escopos só `openid`, `email`, `profile`; **dois clientes**: Produção e Staging | `prod.env` e `staging.env` |
| **RevenueCat** | Projeto com **Web Billing**; produtos `selucra_monthly` (R$ 9,90) e o anual (R$ 89,90); entitlement `pro`; offering `default` (Current) com pacotes Monthly e Annual; webhook de **produção** para `https://api.selucra.com.br/billing/webhook` (ambiente Production) e outro de **sandbox** para o staging | `prod.env` / `staging.env`; chave pública no Pages |
| **Stripe** | Conta **real** conectada ao RevenueCat (a de teste só no sandbox). Cobrança real ligada em 2026-10-12 | conta Stripe |
| **Cloudflare R2** | Bucket privado `selucra-backups`, token só desse bucket (leitura e escrita) | `prod.env` (`R2_*`) |
| **healthchecks.io** | Checks do backup (1 dia, tolerância 2 h) e do teste de restauração (7 dias); o do host (15 min) está em "a confirmar" | URLs de ping em `prod.env` e `/etc/selucra/host-health.env` |
| **UptimeRobot** (gratuito) | 3 monitores a cada 5 min: `https://api.selucra.com.br/health/ready`, `https://app.selucra.com.br` e `https://selucra.com.br`; alerta por e-mail | conta UptimeRobot |

### Proteção contra tentativa repetida de senha (duas camadas)
- **Cloudflare**, regra de Rate Limiting (plano gratuito: janela curta, só barra rajadas) em `api.selucra.com.br` para `/auth/`; testada.
- **Backend** (`loginRateLimit.ts`, 2026-10-12): login com 30 tentativas por IP e 10 por e-mail em 15 minutos, cadastro com 20 por hora por IP, Google por token com 30 em 15 minutos. Em memória (uma instância só). `AUTH_RATE_LIMIT=off` só em desenvolvimento; staging e produção recusam subir com ele. Sem isto o login não tinha limite no código, e o nginx que limitava só existe no desenvolvimento.

### DNS (zona `selucra.com.br`)
- `api` e `api-staging`: registro **A** para o IP do VPS, **com proxy** (nuvem laranja). Durante a primeira emissão do certificado ficaram cinza, e depois foram ligados.
- `app`, `staging`, raiz e `www`: criados pelo Pages ao adicionar o domínio personalizado em cada projeto.
- `send`, `news` e `_dmarc`: registros do Resend, **sempre sem proxy** (nuvem cinza). E-mail nunca passa por proxy.
- Hífen em `api-staging` (e não `api.staging`) porque o certificado gratuito da Cloudflare cobre um nível só.

## 3. No servidor

### Arquivos e pastas (tudo em `/opt/selucra`, dono `deploy`)
| Caminho | O que é |
|---|---|
| `docker-compose.prod.yml` | Postgres, Redis, motor, backend e backup; serve produção e staging (muda só o `.env`) |
| `docker-compose.edge.yml` | Caddy (porta de entrada); lê `ACME_EMAIL` do `prod.env` |
| `infra/` | `caddy/Caddyfile`, `deploy/deploy.sh`, `server/` (bootstrap, init-env, verify), `systemd/`, `env/*.example`, `backup/`, `postgres/init-prod/` |
| `prod.env`, `staging.env` | Variáveis de cada ambiente, modo 600. **O `prod.env` tem o `SIMULATION_SEED`, imutável.** Há uma cópia fora do servidor (gerenciador de senhas) |
| `backup-test.agekey` | Chave **privada** `age` só do teste semanal de restauração (a privada principal NÃO está no servidor) |
| `state/` | Estado do `deploy.sh` (versão atual, anterior, log) |

### Docker
- Projetos Compose: `selucra-prod`, `selucra-staging`, `selucra-edge`. Rede externa compartilhada: `selucra-edge`.
- Só o **Caddy** publica portas (80, 443 tcp e 443 udp). Postgres, Redis, motor e backend ficam em rede interna.
- Imagens: `ghcr.io/alexandrebeilner/selucra-{backend,engine,backup}:<SHA>`. Nunca `latest`.

### Papéis do banco (LW.3.17)
`selucra_owner` (dono dos bancos, só migra), `gamification_app` (backend) e `market_app` (motor), os dois de runtime só com DML. O
superusuário `selucra` fica para administração e backup. O motor não consegue desligar o gatilho append-only de `market_events`.

### Acesso e endurecimento (LW.3.11, `infra/server/bootstrap.sh`)
- Usuário **`deploy`**: entra **só por chave SSH**, sem `sudo`, no grupo `docker`. **Root não entra por SSH** (nem por senha).
- Quem precisa de root usa o **console web da Vultr** (View Console, login `root`, senha do painel). O console não aceita colar:
  digite à mão. Só são necessárias coisas pontuais (instalar pacote, instalar timer, `verify-hardening.sh`).
- `ufw`: entrada negada, abertas 22 (limitada), 80 e 443. `fail2ban` na cela `sshd`. Atualizações de segurança automáticas, **sem
  reinício automático** (backend e motor são singletons; o alerta avisa quando há reinício pendente). Relógio sincronizado (chrony).
- `/opt/selucra/verify-hardening.sh` (como root) confere tudo; o resultado do dia 2026-10-12 foi todo PASSOU.

### Timers do systemd (instalados em `/etc/systemd/system`)
- `selucra-backup.timer`: backup todo dia às 03:30 (horário de São Paulo).
- `selucra-restore-test.timer`: teste de restauração aos domingos às 05:00.
- `selucra-host-health.timer`: a cada 15 min, alerta de disco (85%), memória (10%) e reinício pendente.
- Ver: `systemctl list-timers 'selucra-*'` (como root) e `journalctl -u selucra-backup -n 50`.

## 4. Onde cada variável de ambiente mora

| Variável | Onde | Observação |
|---|---|---|
| `JWT_SECRET`, senhas do Postgres e do Redis, `SIMULATION_SEED`, `EMAIL_UNSUBSCRIBE_SECRET` | `prod.env` / `staging.env` | geradas **no servidor** por `infra/server/init-env.sh`; nunca passaram pelo chat |
| `RESEND_*`, `EMAIL_FROM_*`, `EMAIL_REPLY_TO` | `prod.env` | `EMAIL_PROVIDER=resend` (produção **exige**; staging usa `log`) |
| `GOOGLE_CLIENT_ID/SECRET`, `GOOGLE_REDIRECT_URI` | `prod.env`, `staging.env` | um cliente por ambiente |
| `BILLING_PROVIDER=revenuecat`, `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_AUTH`, `REVENUECAT_ENTITLEMENT_ID=pro` | `prod.env`, `staging.env` | o valor do webhook é o **mesmo texto** do cabeçalho de autorização no painel do RevenueCat |
| `BACKUP_AGE_RECIPIENTS` (duas chaves **públicas**), `BACKUP_REMOTE`, `R2_*`, URLs do healthchecks | `prod.env` | |
| `VITE_GATEWAY_URL` | Pages | `https://api.selucra.com.br` (app) e `https://api-staging.selucra.com.br` (staging); **embutida na hora do build** |
| `VITE_REVENUECAT_WEB_PUBLIC_KEY` | Pages | chave `rcb_` de **produção** no `selucra-app`; chave `rcb_sb_` (sandbox) no `selucra-staging` |
| `NODE_VERSION=22` | Pages | |

Regra: depois de editar um `.env`, aplicar com `docker compose ... up -d backend` (recria só o que mudou). Depois de editar com o
`nano`, conferir a ACL do backup: `getfacl prod.env | grep 10001`.

## 5. Fluxos que existem

- **Publicar versão:** `checklist-atualizar-producao.md` (staging primeiro, mesmo SHA em produção; `deploy.sh` faz backup, `pull`,
  espera a saúde e volta sozinho se falhar; recusa 18h a 23h, horário de São Paulo, sem `--allow-peak`).
- **Frontend:** o Pages publica sozinho a `main` (app) e a branch `staging` (staging). Atualizar o staging:
  `git push origin origin/main:refs/heads/staging`. Rollback: Deployments, Rollback to this deployment.
- **Backup:** diário, criptografado com `age` para **duas chaves** (principal, privada só com o autor; e de teste, no servidor), enviado
  ao R2 em `production/daily/<carimbo>`. Teste de restauração semanal automático.
- **Cobrança:** o RevenueCat avisa por webhook e o backend **reconsulta** a API dele (o aviso é só um gatilho). Reconciliação a cada 6 h
  e na subida do backend. Detalhes de cancelar e reembolsar no runbook (seção "Suporte").

## 6. O que foi feito em 2026-10-12, em ordem

1. **Código (commits na branch `backlog-monetizacao`, PRs #110 e #111):** domínios reais nos exemplos e testes (LW.3.2); CI do frontend
   (LW.3.4, deploy do backend decidido como **manual**); script de endurecimento do servidor (LW.3.11); CSP e cabeçalhos do app no Pages,
   provados no navegador (LW.3.16); roteiro mobile e inventário de merge (LW.5.1 e LW.5.2); `init-env.sh`; ACL do backup; checklist de
   deploy; correção do webhook.
2. **Servidor:** conta Vultr, VPS criado, chave SSH, `bootstrap.sh` (Docker, usuário `deploy`, SSH só por chave, `ufw`, `fail2ban`),
   `verify-hardening.sh` todo PASSOU.
3. **Cloudflare:** zona, nameservers no Registro.br, SSL Full (strict), registros de API, proxy ligado.
4. **GHCR:** imagens publicadas pelo CI e token de leitura no servidor.
5. **Staging no ar** (`selucra-staging` + `api-staging`), seeds, administrador, frontend no Pages, Cloudflare Access.
6. **Resend** (domínios, chaves, webhook, envio testado e recebido). O encaminhamento de `suporte@` e `privacidade@` (Cloudflare Email Routing) foi feito pelo autor.
7. **Backup:** chaves `age`, R2, primeiro backup e **teste de restauração aprovado no servidor real**, monitores no healthchecks.io,
   timers do systemd.
8. **Produção no ar** (`selucra-prod` + `api`), seeds, administrador, `selucra-app` no Pages, teste de cadastro com e-mail verificado.
9. **Uptime** (UptimeRobot), **Google OAuth** (produção e staging).
10. **Cobrança:** sandbox no staging (compra, cancelamento, vencimento, renovação, reativação), depois **Stripe real e RevenueCat de
    produção ligados por decisão do autor, sem contador**; compra real aprovada.
11. **Primeiro deploy normal com o `deploy.sh`** (SHA `f516e871…`, PR #111) e o ciclo completo de cobrança provado: compra, cancelamento e
    reembolso pelo RevenueCat revogando o PRO.

## 7. Problemas que apareceram e como foram resolvidos (para não repetir)

| Problema | Causa | Solução / regra |
|---|---|---|
| `docker-compose.edge.yml` ficou igual ao `prod` | Um `rsync` incompleto (sem destino) tratou o último arquivo como destino e o sobrescreveu | O `rsync` deve **terminar** em `deploy@IP:/opt/selucra/`; conferir `wc -l` e `sha256sum` do edge (45 linhas) |
| Backup: `Permission denied` ao ler o `prod.env` | O contêiner de backup roda como uid 10001, sem root, e o arquivo é modo 600 do `deploy` | ACL só para esse uid: `setfacl -m u:10001:r prod.env backup-test.agekey`; pacote `acl` (agora no bootstrap) |
| Não dá para rodar tarefa de root | Root bloqueado no SSH e `deploy` sem `sudo` (de propósito) | Console web da Vultr |
| `psql -c` com `:'variavel'` falhou | `psql -c` não interpola variáveis | Interpolar pelo shell ou mandar o SQL por entrada padrão |
| Admin criado com e-mail `SEU-EMAIL` (texto literal copiado) | Placeholder maiúsculo não trocado | `update users set email = ...`; ao copiar comandos, trocar tudo o que é placeholder |
| Produção não sobe sem Resend | A guarda de configuração recusa `EMAIL_PROVIDER=log` em produção | Staging sobe primeiro; produção só depois do Resend |
| Webhook do RevenueCat respondia **400** | Contrato Zod com `.optional()` recusava `null` (o RevenueCat manda `null`, ex.: `aliases: null` em `INVOICE_ISSUANCE`) | Corrigido no PR #111; só `event.id` e `event.type` são obrigatórios; o log mostra os campos recusados |
| Reembolso feito no **Stripe** não tirou o PRO | Reembolsar pagamento não cancela a assinatura e o RevenueCat não soube | Reembolsar **sempre pelo botão do RevenueCat** (devolve o dinheiro e revoga o acesso); ver runbook |
| "Seu PRO terminou" cinco minutos depois da compra no staging | O sandbox do RevenueCat usa **ciclo acelerado de 5 minutos** | Comportamento do sandbox, não bug; compra de teste não entra nas métricas de conversão |
| `Workers Builds: tcc-application` vermelho nos PRs | Integração antiga da Cloudflare apontando para um Worker que não existe | Não vem do repositório; desconectar no painel da Cloudflare. Não bloqueia merge |

## 8. Decisões do autor (não reabrir sem motivo)

Deploy do backend e do motor **manual** (`deploy.sh` no VPS, sem chave SSH no GitHub); SSH na porta 22 com `ufw limit` e `fail2ban`;
três papéis de banco; Vultr em São Paulo; backup no Cloudflare R2; imagens no GHCR privado; Caddy em produção; sem Sentry por enquanto;
preço do PRO R$ 9,90 mensal e R$ 89,90 anual; app nativo congelado, PWA como canal mobile; **cobrança real ligada em 2026-10-12 sem
contador**, a regularizar quando houver receita.

## 9. Riscos aceitos e lembretes de manutenção

- **Fiscal e jurídico:** Termos mostram só o nome do autor, sem CPF e endereço (Decreto 7.962/2013 pede nome, CPF ou CNPJ e endereço em
  venda online). Obrigações tributárias sobre a receita. Guardar os extratos do Stripe desde o primeiro dia.
- **Não há deploy sem interrupção:** backend e motor são singletons; a API cai por alguns segundos a cada deploy (de 15 a 60 s com o boot).
- **`docker` = root:** o usuário `deploy` no grupo `docker` equivale a root no servidor. Proteja a chave SSH e a conta GitHub.
- **Datas para lembrar:**
  - o **token do GHCR** no servidor (`read:packages`) foi criado com validade de **1 ano**: renovar antes de vencer, senão o `pull` falha;
  - **faixas de IP da Cloudflare** no `Caddyfile`: conferir a cada trimestre (https://www.cloudflare.com/ips/);
  - **domínio** no Registro.br: renovação anual;
  - **DMARC** está em `p=none` (só monitora); endurecer depois que o envio estiver estável;
  - reinício do servidor por atualização de kernel, quando o alerta pedir (de madrugada, pelo painel ou console da Vultr).

## 10. A confirmar (não consegui verificar daqui)

Itens que o autor informou ou que dependem de painéis que não vejo; confirmar e riscar:
- [ ] `selucra.com.br` e `www` ativos no projeto `selucra-landing`, com `www` redirecionando para a raiz.
- [ ] Check do healthchecks.io do **host** e a `HOST_MONITOR_URL` em `/etc/selucra/host-health.env` (no console, como root).
- [ ] A compra real aparece em `/admin/assinaturas` como **não sandbox**.
- [ ] Domínio verificado no Stripe e no RevenueCat para o checkout web (LW.4.3).
- [ ] Restauração **do zero e cronometrada** (meta: menos de 2 horas) a partir só da chave principal e do runbook.

## 11. Se for preciso refazer tudo (resumo)

Ordem: domínio e Cloudflare, VPS, `bootstrap.sh`, copiar `docker-compose.*` e `infra/` para `/opt/selucra/`, `docker network create
selucra-edge`, `init-env.sh` para os dois ambientes, login no GHCR, subir **staging**, Caddy, seeds, Pages, Resend, produção, backup e
timers, monitores, Google, cobrança. Passo a passo detalhado: `runbook-operacao.md` seção 2 e `pendencias-externas-lancamento.md`.
Em desastre, a restauração dos dados vem do R2 com a **chave `age` principal** (guardada fora do servidor): sem ela, não há restauração.
