# Política de privacidade pública: o que o autor precisa preencher

Tarefa 4.2 de `backlog-app-mobile.md`. A página `/privacidade` (`frontend/src/pages/PoliticaPrivacidade/`)
é pública, sem login, e é a URL a colar nos formulários da Google Play e da App Store.

O texto segue o padrão de mercado da LGPD (art. 9º): controlador, dados e base legal, compartilhamento,
cookies, retenção, segurança, direitos do titular, menores, alterações e contato. Os valores que o código
não tem como saber ficam em **um único arquivo**:

`frontend/src/pages/PoliticaPrivacidade/policyConfig.ts`

Todo valor que começa com `[PREENCHER` é placeholder. Pra conferir o que falta:

```
grep -rn "PREENCHER" frontend/src
```

Sem resultado = pronta pra publicar.

## Campos a preencher

| Campo | O que colocar | Por quê |
|---|---|---|
| `controllerName` | Seu nome completo (pessoa física) ou razão social | Controlador, LGPD art. 5º, VI |
| `contactEmail` | E-mail real, monitorado, pra titulares | Canal do encarregado, art. 41; as lojas pedem contato |
| `dpoName` | Seu nome (pode ser o mesmo do controlador) | Encarregado, art. 41 |
| `hostingProvider` | ✅ **Vultr** (decisão do autor, 2026-10-12; datacenter em São Paulo) | Operador, art. 5º, VII |
| `hostingCountry` | País do datacenter | Se for fora do Brasil, há transferência internacional (art. 33) |
| `minimumAge` | Idade mínima que você quer adotar (ex: 13 ou 18) | Menores de 18 exigem responsável legal, art. 14 |
| `lastUpdated` | Data por extenso (ex: "10 de outubro de 2026") | Atualizar a cada mudança de conteúdo |

`responseDeadline` já vem com 15 dias (prazo legal do art. 19), não é placeholder.

## Afirmações do texto que você deve confirmar

O texto foi escrito a partir do código. Confira se continuam verdadeiras antes de publicar:

- **Sem analytics/cookies de terceiros** (seção 6). Verificado: não há Google Analytics, Sentry nem similar no `frontend/`.
  Se adicionar algum, atualize a seção 6 e a tabela da seção 3.
- **Registros técnicos com IP** (tabela da seção 3). O IP é usado pelo rate limit e aparece no log do gateway nginx. Se
  você descartar logs antes do prazo do Marco Civil (6 meses, art. 15), ajuste a seção 7.
- **Keystore/Keychain no app:** não se aplica (app nativo adiado, lançamento só na web).
- **Anonimização ao excluir conta** (seção 7). Descreve `DELETE /me` (`.docs/backend/auth.md`).
- **Termos de Uso:** já existem (`/termos`, `/reembolso`, lançamento web de 2026-10-11); o Login cita os dois.
- **Cópias de segurança:** a seção 5 cita, sem dar nome, o armazenamento de nuvem das cópias criptografadas (2026-10-12). Quando
  você escolher Backblaze B2 ou Cloudflare R2, troque a frase pelo nome do provedor e confira a região.
- **Revisão jurídica.** O texto é um modelo de mercado, não parecer. Se o app for publicado de verdade, vale uma
  leitura de advogado.

## Depois de preencher

1. Troque os valores em `policyConfig.ts` e rode `grep -rn "PREENCHER" frontend/src` (deve vir vazio).
2. A URL final é `<URL de produção do frontend>/privacidade`.
3. Cole essa URL na Google Play Console (Política de privacidade e Data Safety) e no App Store Connect.
