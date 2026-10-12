# Checklist: atualizar o app em produção

Passo a passo curto para publicar uma versão nova (backend, motor e frontend). Detalhes e o que fazer quando algo falha estão em
`runbook-operacao.md` (seções 3 e 4). Este arquivo é só o roteiro de todo dia.

**Ideia central:** o código só chega a produção depois de passar pelo **staging**, com o **mesmo SHA** (o identificador de 40 caracteres
do commit). O `deploy.sh` recusa promover para produção um SHA que não esteja no staging.

Substitua `<SHA>` pelo SHA completo (40 caracteres) em todos os comandos.

---

## 1. Antes de começar (no seu computador)

- [ ] O PR foi mesclado na `main` (merge commit).
- [ ] No GitHub, aba **Actions**, os workflows da `main` estão verdes: **Imagens**, **Backend CI**, **Engine CI**, **Frontend CI**.
- [ ] Pegue o SHA da `main`:
  ```
  cd ~/WorkSpace/tcc-aplication
  git fetch origin
  git rev-parse origin/main
  ```
  A saída é o `<SHA>`. Confira que o workflow **Imagens** terminou verde **para esse commit** (sem a imagem publicada, o deploy falha no `pull` e não muda nada).
- [ ] Confira se algo de infra mudou desde a versão que está no ar (comparando com o SHA atual de produção, que o passo 2 mostra):
  ```
  git diff --stat <SHA-ATUAL-EM-PRODUCAO> <SHA> -- infra docker-compose.prod.yml docker-compose.edge.yml
  ```
  Se a saída estiver **vazia**, nada a copiar. Se tiver arquivos, faça o passo 1b.

### 1b. Só se a infra mudou: copiar os arquivos para o servidor

O destino é **obrigatório** no fim da linha, com `deploy@...:/opt/selucra/` (sem ele, o `rsync` sobrescreve um arquivo seu).

```
cd ~/WorkSpace/tcc-aplication
rsync -av -e "ssh -i ~/.ssh/selucra_vps" docker-compose.prod.yml docker-compose.edge.yml infra deploy@216.128.172.57:/opt/selucra/
```

Se um arquivo `.env` precisar de variável nova, edite com `nano` no servidor (veja o `infra/env/*.example`) **antes** do deploy.

## 2. Entrar no servidor e ver o que está no ar

```
ssh -i ~/.ssh/selucra_vps deploy@216.128.172.57
cd /opt/selucra
./infra/deploy/deploy.sh staging status
./infra/deploy/deploy.sh prod status
```

Anote a "versão no .env" de produção: é o SHA para onde voltar se algo der errado.

## 3. Staging primeiro

- [ ] Publicar no servidor:
  ```
  ./infra/deploy/deploy.sh staging <SHA>
  ```
  O script baixa as imagens, sobe e espera tudo ficar saudável. Se falhar, ele **volta sozinho** para a versão anterior.
- [ ] Atualizar o frontend do staging (no seu computador):
  ```
  git push origin origin/main:refs/heads/staging
  ```
  O Cloudflare Pages (`selucra-staging`) publica sozinho. Espere o deploy terminar no painel.
- [ ] Testar em `https://staging.selucra.com.br` (você entra com o Access): login, abrir uma lição, abrir `/planos`, e o que a mudança mexeu.
- [ ] `curl -s https://api-staging.selucra.com.br/health/ready | head -c 120` deve dar `"status":"ok"`.

## 4. Produção

- [ ] **Horário:** o script recusa entre **18h e 23h** (São Paulo), porque a API fica fora do ar por alguns segundos e depois leva o tempo do boot (15 a 60 s). Prefira a madrugada ou o fim da manhã. Em emergência, acrescente `--allow-peak` ao comando.
- [ ] Publicar:
  ```
  ./infra/deploy/deploy.sh prod <SHA>
  ```
  O script faz, nesta ordem: **backup**, `pull`, `up`, espera a saúde, e **volta sozinho** se falhar. Se o backup falhar, ele aborta sem mudar nada.
- [ ] O frontend de produção publica sozinho quando a `main` muda (`selucra-app`). Confirme no painel do Pages que o último deploy terminou.

## 5. Conferir depois do deploy (2 minutos)

- [ ] `curl -s https://api.selucra.com.br/health/ready | head -c 150` deve dar `"status":"ok"`.
- [ ] Abra `https://app.selucra.com.br` em janela anônima, entre, e passe pelo que a versão mudou.
- [ ] No UptimeRobot, os 3 monitores continuam **Up**.
- [ ] Olhe os logs por erros (os `400`, `401` e `500` do webhook aparecem aqui):
  ```
  PROD="docker compose -p selucra-prod --env-file /opt/selucra/prod.env -f /opt/selucra/docker-compose.prod.yml"
  $PROD logs --since 15m backend | grep -E '"level":"(error|warn)"|status":(4|5)[0-9][0-9]' | tail -20
  ```
- [ ] Se a versão mexeu em **cobrança**, no RevenueCat (Webhooks) as entregas recentes devem estar com **200**.

## 6. Se algo deu errado

| Situação | O que fazer |
|---|---|
| O `deploy.sh` falhou e avisou que voltou a versão anterior | Nada no servidor. Veja a mensagem e os logs, corrija, e repita pelo staging. |
| Subiu, mas há um problema que o script não pegou | `./infra/deploy/deploy.sh prod rollback` (volta ao SHA anterior, sem novo backup). |
| O frontend quebrou | No Cloudflare Pages, projeto `selucra-app`, **Deployments**, escolha o anterior, **Rollback to this deployment**. |
| A versão nova trazia uma **migração de banco** e a antiga não funciona com o schema novo | Não faça rollback de imagem. Restaure do backup tirado no início do deploy: `runbook-operacao.md` seção 3 ("Restauração real"). |
| Não consegue entrar no servidor | Console da Vultr (root). Veja a seção 2 do runbook. |

## 7. Regras para não errar

- Nunca use a palavra `latest`: sempre o SHA de 40 caracteres.
- Nunca pule o staging (`--skip-staging-check` é só para emergência, e anote o motivo).
- Mudança de **backend + frontend juntas**: publique o backend primeiro (compatível com o frontend antigo) e o frontend depois.
- Mudança que apaga ou reescreve dado: confirme antes que o backup do início do deploy existe (o log do `deploy.sh` mostra).
- O `.env` de produção tem o `SIMULATION_SEED`, que **nunca** muda. Nunca refaça o `prod.env` com `--force`.
