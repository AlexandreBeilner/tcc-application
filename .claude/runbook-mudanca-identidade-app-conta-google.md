# Runbook — mudar o identificador do app ou de conta/projeto Google (login)

Documento operacional (não é decisão de produto/arquitetura fechada como os outros arquivos de
`.claude/` — é um checklist de "quando X acontecer, faça Y"), criado depois da tarefa 3.1 do
`backlog-app-mobile.md` (identificadores técnicos + client IDs OAuth no Google Cloud Console).
Cobre os dois gatilhos que o autor pediu pra deixar documentado: renomear o app e trocar de conta
Google. Ler antes de mexer em qualquer um dos dois, porque as duas coisas têm efeito cascata em
lugares não óbvios (Console, `.env` não versionado, dois arquivos de build nativo).

## 0. Antes de tudo — três client IDs diferentes, três papéis diferentes

O projeto usa (ou vai usar, task 3.2 do backlog-app-mobile ainda não implementada) **três** client
IDs OAuth do Google, todos no mesmo projeto do Google Cloud Console:

| Client ID | Tipo no Console | Onde vive | Pra que serve |
|---|---|---|---|
| Web application | já existe hoje | `backend/.env` (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`), `.env.example` documenta as chaves | Login web por redirect (`GET /auth/google` → `/auth/google/callback`), rota já implementada |
| Android | criado na tarefa 3.1 | `mobile/.env.debug`/`mobile/.env.release` (`GOOGLE_ANDROID_CLIENT_ID`) | Autoriza o app Android nativo a falar com o SDK do Google (`@react-native-google-signin/google-signin`, tarefa 3.3) — amarrado a `applicationId` + SHA-1 do keystore |
| iOS | criado na tarefa 3.1 | `mobile/.env.debug`/`mobile/.env.release` (`GOOGLE_IOS_CLIENT_ID`) | Mesma função do Android, amarrado ao bundle identifier |

**Achado importante, ainda não coberto na implementação (relevante pra quando a tarefa 3.2 do
backlog-app-mobile for executada):** o `idToken` que `@react-native-google-signin/google-signin`
devolve pro app **não** tem como `audience` (`aud`) o client ID Android nem o iOS — ele tem o
**client ID Web** passado como `webClientId` na configuração do SDK
(`GoogleSignin.configure({ webClientId: <Web client ID> })`, exigido pela lib pra sequer devolver
um `idToken`). Isso é o padrão documentado do próprio Google Sign-In nativo (Android
`requestIdToken(serverClientId)`/iOS equivalente): os client IDs Android/iOS só autenticam o
*aplicativo* (pacote+SHA-1, bundle ID) junto ao Google; quem aparece dentro do token verificável
no backend é sempre o client ID Web. Confirmado contra o código real que já existe
(`backend/src/modules/auth/infrastructure/google/googleIdentityProviderAdapter.ts`): o fluxo web
atual já faz exatamente isso — `client.verifyIdToken({ idToken, audience: config.clientId })`,
onde `config.clientId` é o **Web** client ID. A tarefa 3.2 do `backlog-app-mobile.md`, ao descrever
`verifyIdToken(idToken)` novo, precisa usar **o mesmo `GOOGLE_CLIENT_ID` (Web) já existente** como
`audience` — não os client IDs Android/iOS da 3.1. Os client IDs Android/iOS continuam necessários
(sem eles o SDK nativo nem consegue autenticar o app junto ao Google pra começo de conversa), só
não são o valor de `audience` na verificação do backend.

## 1. Fora de escopo deste runbook

- **Login por e-mail/senha** não usa nada disto — é só um `POST` JSON, não depende de client ID
  nenhum.
- **Nome de exibição do app** (o que o usuário vê na tela inicial do celular) é **outra coisa**,
  sem relação com autenticação — ver seção 3, só pra evitar confundir os dois.

## 2. Cenário A — mudar `applicationId` (Android) / bundle identifier (iOS)

Quando isso se aplica: trocar o identificador técnico do pacote (hoje `com.investimenta` nos dois,
decidido na tarefa 3.1) — não o nome visível, isso é o Cenário B.

### 2.1 Arquivos do projeto

- `mobile/android/app/build.gradle`: `applicationId` (e `namespace`, só se decidir também mudar o
  pacote Java — nesse caso as pastas `mobile/android/app/src/main/java/com/investimenta/` precisam
  ser movidas pro novo pacote e a linha `package com.investimenta` em `MainActivity.kt`/
  `MainApplication.kt` atualizada; `applicationId` sozinho, sem mudar `namespace`, **não** exige
  isso — são coisas independentes no Gradle moderno).
- `mobile/ios/Investimenta.xcodeproj/project.pbxproj`: `PRODUCT_BUNDLE_IDENTIFIER`, aparece **duas
  vezes** (config `Debug` e `Release`) — trocar as duas, ou editar via Xcode (que já propaga pras
  duas configs sozinho).
- Se a tarefa 3.3 (SDK nativo de login Google) já estiver implementada: o Info.plist do iOS ganha
  um URL scheme com o "reversed client ID" do client iOS (`com.googleusercontent.apps.<ID>` —
  formato padrão da lib `@react-native-google-signin/google-signin`) — se o bundle ID mudar e por
  isso o client ID iOS for recriado (não só editado), esse URL scheme precisa ser atualizado com o
  novo reversed client ID.

### 2.2 Google Cloud Console

- Client ID **Android**: o Console permite **editar** o "Nome do pacote" de um client ID Android já
  existente sem precisar recriar (o SHA-1 não muda — é do keystore de debug/release, não do
  `applicationId`, então não precisa mexer nele). Se preferir não editar o existente, criar um novo
  e apagar o antigo depois.
- Client ID **iOS**: mesma lógica, editar o "Bundle ID" do client existente ou recriar.
- **O client ID Web não é afetado** por essa mudança — ele não tem pacote/bundle ID associado.

### 2.3 Variáveis de ambiente

- Só precisa mudar `GOOGLE_ANDROID_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID` em `mobile/.env.debug` e
  `mobile/.env.release` **se** os client IDs forem recriados (edição no Console mantém o mesmo
  valor de client ID, só troca o pacote/bundle associado a ele).

### 2.4 Checklist

- [ ] `applicationId`/`PRODUCT_BUNDLE_IDENTIFIER` atualizados nos dois lugares do iOS.
- [ ] Se o `namespace` Java mudou junto: pastas + `package` de `MainActivity.kt`/
      `MainApplication.kt` atualizados, projeto builda (`npx react-native run-android`).
- [ ] Client ID Android/iOS no Console apontando pro pacote/bundle novo.
- [ ] `GOOGLE_ANDROID_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID` atualizados nos dois `.env.*` do mobile, se
      os client IDs foram recriados.
- [ ] Login Google testado de ponta a ponta de novo no emulador (não assumir que só porque o
      client ID existe no Console o fluxo funciona).

## 3. Cenário B — mudar o nome de exibição do app (não é autenticação)

Incluído aqui só pra registrar que **isso não tem nenhum efeito no login** — nome de exibição é
puramente cosmético, tarefa 4.1 do `backlog-app-mobile.md`:

- Android: `mobile/android/app/src/main/res/values/strings.xml` (`app_name`).
- iOS: `CFBundleDisplayName`/`CFBundleName` no `Info.plist` (ou via Xcode, aba General).
- `mobile/app.json` (`name`/`displayName`, usado pelo Metro/bundler, não pela loja).

Nenhum desses três precisa de mudança em Console, client ID ou `.env`.

## 4. Cenário C — trocar de conta/projeto Google Cloud

Quando isso se aplica: os client IDs OAuth atuais (Web/Android/iOS) passam a viver num projeto do
Google Cloud diferente do de hoje — ex. sair de um projeto pessoal do autor pra um projeto
institucional, ou qualquer outro motivo de troca de titularidade.

### 4.1 O que precisa existir no projeto novo, antes de tocar em qualquer `.env`

1. **Tela de consentimento OAuth** configurada (nome do app, e-mail de suporte, escopos
   `openid`/`email`/`profile` — os três já usados pelo fluxo web atual). Se o projeto novo nascer
   em modo **"Testing"** (não publicado), só e-mails cadastrados como "test users" conseguem
   logar — **inclui o e-mail que vai validar o login depois da troca**, senão a própria validação
   trava com erro de app não verificado.
2. **Três client IDs recriados no projeto novo**, com os mesmos dados de hoje:
   - Web application: mesmo(s) `redirect URI` autorizado(s) (`GOOGLE_REDIRECT_URI` atual, ex.
     `http://localhost:8000/auth/google/callback` em dev, o domínio real de produção quando existir).
   - Android: mesmo pacote (`com.investimenta` ou o que estiver valendo no momento da troca) + mesmo
     SHA-1 de debug (**o SHA-1 não muda com a troca de conta Google** — é do keystore local, roda
     `keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey
     -storepass android -keypass android` de novo só se o keystore em si tiver sido regerado).
   - iOS: mesmo bundle identifier atual.

### 4.2 O que muda em `.env` (nenhuma linha de código)

- `backend/.env` (**não versionado** — só existe local/produção, nunca commitar): `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` do client Web novo.
- `mobile/.env.debug` **e** `mobile/.env.release`: `GOOGLE_ANDROID_CLIENT_ID`,
  `GOOGLE_IOS_CLIENT_ID` dos client IDs novos (estes dois arquivos **são** versionados — client ID
  OAuth de app nativo é identificador público, não segredo, diferente do `GOOGLE_CLIENT_SECRET`
  acima).
- `.env.example` na raiz já documenta os nomes das variáveis do client Web — não precisa mudar,
  só o valor real em `backend/.env` de cada ambiente.

**Decisão registrada (confirmada com o autor em 2026-09-12):** `mobile/.env.debug`/
`mobile/.env.release` continuam versionados como estão hoje, sem gitignore/`.example` — diferente
do `.gitignore` da raiz, que ignora `.env`/`.env.local` (onde moram os segredos de verdade do
backend: `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `POSTGRES_PASSWORD`). O motivo é categórico, não um
descuido: nenhum dos dois arquivos do mobile guarda segredo — client ID OAuth de app nativo
(Android/iOS) não tem contrapartida de `client secret`, é um identificador público que vai parar
dentro do binário do app de qualquer forma (mesmo padrão de projetos versionarem
`google-services.json`/`GoogleService-Info.plist`). Versionar dá build reproduzível sem passo
manual extra. Se um segredo real algum dia precisar entrar em config do mobile, ele **não** deve ir
pra esses dois arquivos — precisa de um mecanismo separado (ex. arquivo próprio gitignored), essa
decisão vale só enquanto o conteúdo continuar sendo só identificador público.

### 4.3 Ordem seguro de corte (evita janela sem login funcionando)

1. Criar tudo no projeto novo primeiro (consent screen + 3 client IDs) **sem apagar nada do projeto
   antigo ainda**.
2. Atualizar as variáveis de ambiente em todos os ambientes de uma vez — `backend/.env` (local e
   qualquer ambiente de produção que já exista) e os dois `mobile/.env.*` **precisam trocar
   juntos**: os três client IDs de um mesmo login (web/Android/iOS) têm que vir do **mesmo**
   projeto Google Cloud, porque a tela de consentimento e o status de verificação são por projeto —
   misturar client Web do projeto A com client Android do projeto B ainda funciona tecnicamente
   (são credenciais independentes), mas não faz sentido operacional e complica revogar acesso depois.
3. Validar login web (redirect) e login Google no app (se a tarefa 3.3 já existir) de ponta a ponta
   contra os client IDs novos.
4. Só depois de validado, revogar/apagar os client IDs do projeto antigo.

### 4.4 Checklist

- [ ] Tela de consentimento OAuth do projeto novo configurada (nome, e-mail de suporte, escopos).
- [ ] Se em modo "Testing": e-mail de quem vai validar cadastrado como test user.
- [ ] 3 client IDs recriados (Web/Android/iOS) com os mesmos dados de pacote/bundle/redirect URI de
      hoje.
- [ ] `backend/.env` atualizado (`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`).
- [ ] `mobile/.env.debug` e `mobile/.env.release` atualizados (`GOOGLE_ANDROID_CLIENT_ID`/
      `GOOGLE_IOS_CLIENT_ID`).
- [ ] Login web e login Google no app (quando existir) testados de ponta a ponta contra os client
      IDs novos antes de apagar os antigos.
- [ ] Client IDs do projeto antigo revogados só depois da validação acima.

## 5. Referência rápida — onde cada coisa mora

| O quê | Onde |
|---|---|
| `applicationId` Android | `mobile/android/app/build.gradle` |
| Bundle identifier iOS | `mobile/ios/Investimenta.xcodeproj/project.pbxproj` (`PRODUCT_BUNDLE_IDENTIFIER`, 2 configs) |
| SHA-1 do keystore de debug | gerado com `keytool -list -v -keystore mobile/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android` |
| Client ID Web (login web) | `backend/.env` → `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` (não versionado) |
| Client ID Android (login nativo) | `mobile/.env.debug` / `mobile/.env.release` → `GOOGLE_ANDROID_CLIENT_ID` |
| Client ID iOS (login nativo) | `mobile/.env.debug` / `mobile/.env.release` → `GOOGLE_IOS_CLIENT_ID` |
| Nome de exibição Android | `mobile/android/app/src/main/res/values/strings.xml` (`app_name`) — não é autenticação |
| Nome de exibição iOS | `Info.plist` (`CFBundleDisplayName`) — não é autenticação |
| `audience` aceito na verificação do `idToken` nativo (3.2, ainda não implementada) | tem que ser o **client ID Web**, não o Android/iOS — ver seção 0 |
