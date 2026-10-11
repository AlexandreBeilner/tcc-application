# Arquitetura do app mobile (React Native + WebView)

Análise pedida pelo autor em 2026-09-09: o que precisa ser feito pra embrulhar o
frontend web já existente (`frontend/`, React + Vite) dentro de um app React
Native "puro" (**sem Expo**, CLI/community template) rodando o SPA inteiro
dentro de um `WebView`, publicável em Android e iOS. **O ambiente de
desenvolvimento não tem Mac nem dispositivo iOS** — isso molda várias decisões
abaixo (principalmente CI/CD e teste) e é tratado explicitamente em cada seção
onde importa.

Este documento é análise + plano, não decisão fechada como os outros arquivos
de `.claude/` — ele levanta as decisões que precisam ser tomadas pelo autor
(marcadas em **Decisão necessária**) e o que já é factual/obrigatório dado como
a plataforma já existe hoje (marcado **Já é assim no código**, com referência
de arquivo).

## 1. Escopo da abordagem

O app RN **não reimplementa nenhuma tela**. Ele é uma casca nativa fina:

- Uma única `WebView` ocupando a área de conteúdo, carregando o SPA já
  existente (`frontend/`) por baixo de uma `TopBar`/`TabBar` que **continuam
  sendo as do próprio SPA** (renderizadas dentro do WebView) — o app nativo não
  desenha UI de produto, só o que o navegador não dá de graça: splash nativo,
  status bar, botão de voltar do Android, ponte de login/upload/download, tela
  de erro de rede.
- Tudo que hoje é HTTP entre `frontend` e `gateway` continua sendo HTTP —
  muda só de onde a requisição parte (dentro do WebView em vez de um
  navegador desktop), o que tem implicações reais de CORS e rede (seção 6).

Fora de escopo de implementação nesta fase, mas cada um seria uma tarefa
própria depois que a casca WebView estiver funcionando: deep linking pra
conteúdo específico de dentro de outro app, widgets, modo offline real
(cache de dados, não só a UI). **Push notification é diferente** — o autor
sinalizou em 2026-09-10 que é uma boa candidata (streak/missões diárias já
pedem por isso, e reduz o risco de rejeição da Apple, seção 12), mas ainda
não é tarefa aberta de backlog, só um "provavelmente sim" a amadurecer —
mesmo status de `estrategia-monetizacao.md`: proposta, não decisão fechada.

## 2. De onde o WebView carrega o conteúdo — decidido: Opção A (URL hospedada)

**Decisão tomada pelo autor em 2026-09-10:** entrega via URL, não build
empacotado no app — a mesma URL de produção que atende usuário de navegador
desktop/Chrome é a que o WebView do app carrega. **Isso não é má prática —
é exatamente o padrão de mercado da Opção A abaixo, e é a forma certa de
fazer**: um app WebView "bem feito" não duplica a aplicação, ele reaponta pra
mesma origem que já serve todo mundo. A alternativa (empacotar os arquivos
dentro do app, Opção B) é que seria a exceção, usada só quando offline real é
requisito — não é o caso aqui (seção 6: o produto já é 100% dependente de
API, não existe hoje nenhum caminho que funcione sem rede).

Consequência prática: **não existe origem "de mobile"** — `FRONTEND_URL`
(CORS, `backend/src/app.ts:407`) continua sendo uma única URL, e essa URL
vale tanto pra quem abre no Chrome quanto pra quem abre pelo app. Nenhuma
configuração de CORS nova é necessária por causa do mobile.

Ainda em aberto (mas isso é decisão de produto geral, não específica do
mobile — o app só herda o que for decidido aqui): **onde essa URL de
produção vai estar hospedada de fato**, já que hoje ela não existe (sem
Dockerfile de frontend por regra do `CLAUDE.md`, sem `netlify.toml`/
`vercel.json`, sem workflow de deploy do frontend em `.github/workflows/`).
Duas opções de mercado, mantidas como registro pra quando essa decisão for
tomada:

### Opção A — apontar pra uma URL hospedada (escolhida)

`WebView` carrega uma URL `https://` real, exatamente como um navegador
desktop carrega `vite build`/`vite preview` hoje. O app nativo não empacota
HTML/JS/CSS nenhum.

Vantagens:
- **Reaproveita o CORS atual sem mudança nenhuma** — `FRONTEND_URL`
  (`backend/src/app.ts:407`, `.env.example`) já é pensado como "uma origem só,
  fixa" (`app.use(cors({ origin: frontendUrl }))`); a origem que o WebView
  apresenta é a mesma URL https, então o gateway não precisa saber que existe
  um app nativo.
- **Atualiza o produto sem re-publicar nas lojas** — dado que o projeto ainda
  está em semanas de backlog ativo (`.claude/backlog-plataforma-investimentos.md`),
  cada deploy do frontend já atualiza os dois apps instantaneamente. Isso
  também reduz o atrito de review da Apple (rebuild só quando a *casca*
  nativa muda, não a cada tela nova).
- WebView em modo hospedado é o padrão usado por apps híbridos de mercado
  bem estabelecidos (ex: apps que envelopam PWA).

Falta apenas o hosting em si pra servir `vite build` por HTTPS — **isso ainda
não existe no projeto** (não há Dockerfile de frontend por regra do
`CLAUDE.md`, não há `netlify.toml`/`vercel.json`/workflow de deploy do
frontend em `.github/workflows/`, só `backend-ci.yml` e `engine-ci.yml`), mas
é um trabalho de infraestrutura geral do produto, não algo que o mobile
precisa resolver sozinho — o app só consome a URL que resultar dessa decisão.
Como o `gateway/` já é Nginx (`gateway/nginx.conf`) e hoje só faz proxy
reverso pro backend, a extensão mais natural é servir os arquivos estáticos
do `vite build` a partir do próprio Nginx do gateway (uma `location /` nova
servindo os arquivos, mantendo `location /health`, `/auth`, etc. como proxy
pro backend) — isso também resolve CORS de graça, porque frontend e API
passam a ser a mesma origem. Alternativas: Netlify/Vercel/Cloudflare Pages
(mais simples de configurar, mas frontend some do Compose que já sobe tudo
mais). Qualquer uma que for escolhida ainda respeita a regra do `CLAUDE.md`
("frontend nunca containerizado") só se a build estática for gerada fora do
Compose e só *servida* por um container que já existe (o gateway) — vale
confirmar essa leitura com o autor antes de mexer no Nginx.

### Opção B — empacotar os assets estáticos dentro do app

`vite build` vira parte do bundle do app (Android:
`android/app/src/main/assets/www`, servido via `WebViewAssetLoader` com
origem sintética `https://appassets.androidplatform.net`; iOS: pasta em
`Resources`, servida via `loadFileURL` ou um servidor HTTP local embutido,
ex: `react-native-static-server`).

Vantagens: funciona sem internet pra carregar a *casca* (as chamadas de API
continuam precisando de rede), sem depender de hosting externo.

Desvantagens (por isso não é a recomendação): toda mudança de frontend exige
recompilar e reenviar os dois apps pras lojas (voltando ao ciclo lento que a
opção A evita); a origem sintética (`appassets.androidplatform.net` no
Android, um domínio local diferente no iOS) **não bate com um único
`FRONTEND_URL` simples** — o CORS do backend precisaria aceitar essas origens
sintéticas além da web normal, ou o app precisaria ir sempre direto no
gateway sem passar pelo conceito de "origem do frontend"; mais peças móveis
de build (asset loader, versionamento de assets, invalidação de cache).

**Recomendação:** Opção A. Ela também é a única que faz sentido dado que o
produto já é 100% orientado a API (não há nenhum caminho hoje que funcione
sem rede — ver seção 6), então o argumento "funciona offline" da opção B não
se sustenta na prática.

O resto deste documento assume a Opção A, mas a maioria das seções (auth,
upload, download, rede, lojas) vale igual pra opção B.

## 3. Onde o projeto RN vive no monorepo (decidido)

**Confirmado pelo autor em 2026-09-10:** novo diretório de topo `mobile/`,
irmão de `backend/`, `engine/`, `frontend/`, `gateway/`, **sem
containerização** — mesma exceção do frontend. Ferramentas de build mobile
(Gradle, Xcode) não rodam dentro de Docker Compose de forma útil — Xcode em
particular **não roda em Linux de jeito nenhum**, containerizado ou não. Essa
exceção já foi registrada na tabela "Arquitetura — resumo rápido" do
`CLAUDE.md`, na mesma sessão desta decisão.

## 4. Setup do projeto (React Native CLI, sem Expo)

- `npx @react-native-community/cli@latest init` (template TypeScript, que já
  vem por padrão). Versão estável atual: **React Native 0.87** (checado nesta
  sessão) — a New Architecture (Fabric + TurboModules + JSI) é **obrigatória**
  desde a 0.76 e a arquitetura antiga (bridge) foi desativada de vez a partir
  da 0.82, então não há "escolha" a fazer aqui, só usar o template atual.
- Fluxo normal do CLI cria `android/` (Gradle) e `ios/` (Xcode project +
  Podfile/CocoaPods) na raiz de `mobile/`.
- Node/TypeScript, ESLint+Prettier vêm no template — manter (não trocar por
  `oxlint` só porque o resto do frontend usa; é convenção do `frontend/`, não
  uma regra geral do `CLAUDE.md` pra qualquer código TS do repo).

## 5. Biblioteca de WebView e configuração base

`react-native-webview` é o pacote padrão de mercado (sucessor do `WebView`
que já saiu do core do React Native). Ponto de atenção grande, checado nesta
sessão: **as versões atuais do `react-native-webview` só suportam a New
Architecture** (dropparam suporte à arquitetura antiga) — reforça que não há
como escapar da New Architecture citada na seção 4.

Props que precisam estar setadas explicitamente (nenhuma é o default "óbvio"):

| Prop | Valor | Por quê |
|---|---|---|
| `source={{ uri: PRODUCTION_FRONTEND_URL }}` | URL https da seção 2 | — |
| `domStorageEnabled` | `true` | **Sem isso, `localStorage` não funciona no Android** — o token de sessão (`TOKEN_STORAGE_KEY`, `AuthContext/index.tsx:12`) e o tema (`THEME_STORAGE_KEY`, `ThemeContext/index.tsx:15`) simplesmente não persistem, e o app desloga sozinho a cada abertura. É o bug mais fácil de não perceber em teste rápido (o app "funciona" na primeira sessão) e o mais crítico de não esquecer. |
| `javaScriptEnabled` | `true` (default) | Óbvio, mas confirmar — é uma SPA React |
| `originWhitelist` | domínio do frontend + domínio do gateway (se forem hosts diferentes) | Sem isso, qualquer link que o SPA abrir (ex. suporte, termos de uso) é carregado dentro do próprio WebView, criando um "navegador disfarçado de app" — risco de phishing e motivo real de rejeição na Apple (seção 12) |
| `onShouldStartLoadWithRequest` | abrir fora do whitelist via `Linking.openURL` (navegador/app do sistema) | Complementa o item acima — qualquer navegação pra fora do domínio do app vira uma saída explícita pro navegador do celular, nunca fica presa dentro do WebView |
| `allowsBackForwardNavigationGestures` | `true` (iOS) | Equivalente ao botão físico de voltar do Android — sem isso o gesto de "arrastar da borda" do iOS não navega o histórico do SPA |
| `sharedCookiesEnabled` / `mixedContentMode` | `false` (cookies) / `"never"` (mixed content) | O backend não usa cookie de sessão (é Bearer token, `AuthContext`), então nada de cookies deveria trafegar; mixed content bloqueado por padrão é postura de segurança, e se tudo for https (seção 6) nunca deveria disparar mesmo |

Botão físico de voltar do Android precisa de `BackHandler` (RN core)
escutando `onNavigationStateChange` do WebView: se `canGoBack`, chama
`webviewRef.current.goBack()`; senão (**decidido em 2026-09-10**), sai do
app direto — sem tela de confirmação.

## 6. Rede: cleartext, ATS e apontar pra API certa em cada ambiente

- **Android 9+ (API 28+) bloqueia tráfego HTTP puro por padrão.** Enquanto o
  ambiente de desenvolvimento local for `http://localhost:8000` (gateway sem
  TLS, como é hoje via `docker-compose.yml`), o app de debug precisa de um
  `network_security_config.xml` liberando cleartext **só pro host de dev**
  (IP da máquina/emulador), nunca em build de release — build de release deve
  sempre falar com o gateway de produção por `https://` (o que também é
  exigido pela Apple, ver abaixo, então essa parte "resolve os dois lados"
  quando o backend de produção tiver TLS).
- **iOS (App Transport Security) exige HTTPS por padrão desde sempre**, mais
  rígido que o Android nesse ponto. Dev local com `http://` exige uma exceção
  pontual em `NSAppTransportSecurity`/`Info.plist` escopada ao domínio de dev
  — nunca uma exceção geral (`NSAllowsArbitraryLoads: true`), que é motivo de
  rejeição na App Store.
- **Emulador Android alcança `localhost` da máquina host como `10.0.2.2`**,
  não `localhost` — isso muda a URL de dev do WebView. Simulador iOS, ao
  contrário, alcança `localhost` diretamente (mesma máquina). Dispositivo
  físico (Android ou, futuramente, iPhone de terceiro pra teste) precisa do
  IP de LAN da máquina rodando o `docker compose up`, ou de `adb reverse
  tcp:8000 tcp:8000` no caso do Android.
- **CORS (`FRONTEND_URL`, `backend/src/app.ts:407`) precisa bater exatamente
  com a origem que o WebView apresenta.** Com a Opção A da seção 2 (URL
  hospedada), isso é transparente — a origem é a mesma URL https de sempre.
  Se em algum momento o app apontar pro ambiente de dev local, `FRONTEND_URL`
  do `.env` local também precisa refletir a origem real usada (inclusive
  `http://10.0.2.2:...` se for esse o caso no emulador Android), senão toda
  chamada de API quebra por CORS **silenciosamente só dentro do app** (o
  mesmo backend, testado num navegador desktop comum, continua funcionando).

## 7. Autenticação — login com Google via SDK nativo (decidido)

**Ponto crítico, fácil de descobrir tarde:** desde 2021 o Google bloqueia
ativamente o fluxo de OAuth/login dentro de WebViews embarcadas (detecção por
User-Agent; erro `disallowed_useragent`). Ou seja, **o fluxo atual
(`googleLoginUrl()` → redirect completo de página pro Google →
`/auth/google/callback` → volta com `#token=` no fragmento, ver
`services/auth/index.ts` e `pages/AuthCallback/index.tsx`) não funciona
dentro do `react-native-webview` como está hoje.** Login por e-mail/senha
continua funcionando normalmente (é só um POST JSON, não passa pelo Google).

**Decisão tomada pelo autor em 2026-09-10: SDK nativo**
(`@react-native-google-signin/google-signin`), não o atalho de abrir o
navegador do sistema + deep link de volta. O SDK devolve um `idToken` direto
no app, sem WebView nem redirect nenhum — é a solução mais robusta/madura de
mercado, mas é trabalho real de backend, não só mobile. Duas peças novas que
essa escolha exige:

- **Endpoint novo no backend** (ex.: `POST /auth/google/token`), seguindo a
  arquitetura DDD lite já em vigor (`.claude/arquitetura-backend-ddd-lite.md`):
  o caso de uso `loginWithGoogle` já existe e resolve "achar ou criar usuário
  a partir dos dados do Google" — o que falta é uma **porta nova**
  (`application/ports/`) pra verificar/decodificar o `idToken` assinado que o
  app manda (ex. usando a biblioteca oficial do Google pra validar contra as
  chaves públicas do Google), implementada em `infrastructure/`, e um router
  novo validando o payload com Zod antes de chamar o caso de uso — mesmo
  checklist obrigatório de qualquer rota de `backend/` (teste do caso de uso
  com fake da porta nova, teste do adapter real, teste do router via
  supertest, documentar em `.docs/backend/auth.md`). O redirect atual
  (`/auth/google`, `/auth/google/callback`) não precisa ser removido — ele
  continua servindo o login web por navegador normal; o endpoint novo é
  aditivo, só pro app.
- **OAuth client ID separado por plataforma** no Google Cloud Console (hoje
  só existe um "Web application", `.env.example`) — um Android (nome do
  pacote + fingerprint SHA-1 de assinatura) e um iOS (bundle ID). **Isso cria
  uma dependência que atravessa a seção 10:** mesmo que ícone/splash/nome
  final do app fiquem pra depois, o **identificador técnico** (`applicationId`
  Android + bundle ID iOS, e o SHA-1 do keystore de debug) precisa existir
  *antes* de conseguir testar o login do Google no app, mesmo em
  desenvolvimento — não dá pra deixar isso pro final junto com o resto da
  identidade visual.

## 8. Sessão: ponte de token pra storage nativo seguro (decidido: implementar)

Mesmo com `domStorageEnabled=true` (seção 5), duas fragilidades reais que não
existem hoje num navegador desktop:

- **iOS pode liberar espaço em disco apagando dados de WebView sob pressão de
  armazenamento** (diferente de app nativo usando Keychain, que o sistema não
  toca). Resultado prático: usuário é deslogado sem motivo aparente, sem ter
  desinstalado nada.
- Um JWT sentado em `localStorage` é o mesmo padrão de risco que já existe
  hoje no navegador (exposto a qualquer XSS do próprio SPA) — WebView não
  piora isso, mas também não resolve.

**Decisão do autor em 2026-09-10: implementar** a recomendação de mercado, não
só documentá-la. O app nativo captura o JWT assim que o login resolve (via
`postMessage` do SPA pro RN, ou lendo o mesmo `localStorage` por
`injectedJavaScript`) e guarda a cópia autoritativa em armazenamento seguro
nativo (`react-native-keychain` — Keychain no iOS, Keystore/EncryptedSharedPreferences
no Android), **reinjetando** esse token no `localStorage` do WebView via
`injectedJavaScriptBeforeContentLoaded` toda vez que uma nova instância do
WebView carrega. Isso não é uma reescrita do `AuthContext` — o React continua
lendo `localStorage` exatamente como faz hoje (`AuthContext/index.tsx:17`);
o app nativo só garante que aquele valor nunca se perde de verdade.

## 9. Upload de arquivo (avatar) e download (exportação LGPD)

Duas features já existentes no SPA que dependem de comportamento de
navegador que WebView não dá de graça:

**Upload (`Configuracoes/index.tsx`, `<input type="file" accept="image/jpeg,image/png,image/webp">`,
tarefa 6.10.8):** `react-native-webview` recente já intercepta o seletor de
arquivo nativamente (Android via `onShowFileChooser`, iOS via WKWebView desde
iOS 13). Não tem `capture="camera"` no input hoje, então abre direto a
galeria de fotos, não a câmera — mais simples. Ainda assim, Android precisa
da permissão de mídia certa no manifest dependendo da versão-alvo
(`READ_MEDIA_IMAGES` em API 33+, ou o seletor de fotos do sistema que dispensa
permissão em versões mais novas do Android — variando com o `targetSdkVersion`
escolhido, seção 12).

**Download (`PrivacidadeLgpd/index.tsx:45-49`, exportação de dados RNF04, via
`Blob` + `URL.createObjectURL` + `<a download>`):** este é o gap mais real e
menos óbvio encontrado nesta análise. `<a download>` com URL `blob:` **não
dispara download nenhum por padrão em WebView** — nem Android nem iOS tratam
isso como um navegador desktop trataria. `onFileDownload` do
`react-native-webview` só recebe a *URL* do blob, não o conteúdo, então
sozinho não resolve. A solução de mercado é uma ponte explícita: interceptar
o clique no SPA (ou um listener injetado), ler o `Blob` como base64
(`FileReader.readAsDataURL`), mandar pro lado nativo via `postMessage`, e o
app nativo grava o arquivo (`react-native-fs`/`react-native-blob-util`) e abre
o share sheet do sistema (`Share.share`) pra o usuário salvar/enviar onde
quiser. **Sem esse trabalho extra, o botão "baixar meus dados" da tela de
LGPD simplesmente não faz nada dentro do app** — vale tratar como parte
obrigatória do trabalho, não um nice-to-have, já que é um requisito formal
(RNF04) e não uma tela qualquer.

## 10. Identidade do app, ícone, splash, versionamento

**Decisão do autor em 2026-09-10: deixar por último** — ícone final,
splash "bonito", nome de exibição definitivo e a submissão nas lojas não
bloqueiam o trabalho de fazer a casca WebView funcionar. Ressalva já
levantada na seção 7: o **identificador técnico** do app (não o ícone/nome
visível) é um pré-requisito silencioso do login Google nativo, então não dá
pra empurrar tudo desta seção igualmente pro final:

- **Cedo, não no final:** `applicationId` (Android,
  `android/app/build.gradle`, ex. `br.com.selucra.app`, pode ser um
  placeholder interno — trocar depois é possível, só exige atualizar o client
  ID do Google e a assinatura de novo) + bundle identifier (iOS) + SHA-1 do
  keystore de debug gerado pelo próprio RN CLI. Sem isso, a seção 7 (login
  Google) não tem como ser testada, nem em desenvolvimento.
- **De fato por último, sem risco de retrabalho:** nome de exibição
  definitivo, ícone em todas as resoluções, splash screen "de produção"
  (`react-native-bootsplash` ou equivalente — uma splash de placeholder
  simples já é suficiente enquanto isso não vem), e versionamento
  (`versionName`/`versionCode` Android,
  `CFBundleShortVersionString`/`CFBundleVersion` iOS) — só passam a importar
  quando o app for de fato submetido nas lojas (seção 12).
- Ícone/splash finais devem refletir o tema dark por padrão
  (`data-theme="dark"`, `frontend/index.html:2`), já que é o tema default do
  produto hoje — mas isso é detalhe de quando essa etapa chegar, não agora.

## 11. Variáveis de ambiente / build variants

Usar `react-native-config` (ou `.xcconfig`/`buildConfigField` manuais) pra
separar pelo menos dois ambientes:

- **Debug**: aponta pro gateway local (`10.0.2.2`/IP de LAN conforme seção 6),
  cleartext liberado só aqui.
- **Release**: aponta pra URL de produção (https) escolhida na seção 2,
  cleartext bloqueado, `FRONTEND_URL` do backend batendo com essa origem.

Nenhuma URL de API deveria ficar hardcoded no código nativo — mesma lição já
aplicada no frontend hoje (`VITE_GATEWAY_URL`, `vite.config.ts`).

## 12. Publicação nas lojas

### Google Play

- Conta de desenvolvedor (US$ 25, pagamento único).
- **`targetSdkVersion` obrigatório checado nesta sessão: apps novos precisam
  mirar Android 16 (API 36) a partir de 31/08/2026** (com possibilidade de
  extensão até 01/11/2026 se pedida) — isso já está valendo na data de hoje
  (09/09/2026), então não dá pra mirar uma API antiga "só pra simplificar".
- Formulário de segurança de dados (Data Safety), política de privacidade
  pública obrigatória — o produto já tem uma tela de LGPD
  (`pages/PrivacidadeLgpd`) que pode virar a base do texto exigido, mas a
  *URL* pública apontada no formulário da loja precisa existir de verdade
  (hospedada, não só uma rota protegida por login). **Confirmado pelo autor
  em 2026-09-10: já registrar isso como trabalho a fazer** (não é só um
  lembrete condicional) — vira uma página estática pública nova
  (`/politica-de-privacidade` ou similar, fora do app autenticado), com o
  mesmo conteúdo da tela de LGPD adaptado pra quem nunca criou conta.
- Assinatura via Google Play App Signing (recomendado, Google guarda a chave
  de assinatura final).

### App Store

- **Precisa de conta Apple Developer Program (US$ 99/ano) e de um Mac com
  Xcode pra gerar o build/arquivo `.ipa` final** — não existe forma de
  compilar iOS sem macOS em algum ponto da cadeia (nuvem ou local, seção 13).
- **Risco real e concreto, checado nesta sessão: a Apple rejeita
  explicitamente apps que são só "um site dentro de um WebView" sob a
  Guideline 4.2 (Minimum Functionality)** — a distinção que a própria Apple
  usa é entre um "lazy wrapper" (WebView cru, tela branca se a internet cai,
  zero integração com o SO) e um app com camada nativa de verdade em volta do
  WebView. Pra não cair nessa rejeição, a casca nativa deste projeto **precisa
  entregar, no mínimo**: splash nativo (seção 10), tratamento de estado
  offline (tela nativa de erro/sem conexão, item 10 do checklist na seção
  14), botão de voltar/gesto nativo (seção 5), e idealmente
  pelo menos um recurso nativo real. **O autor sinalizou em 2026-09-10 que
  push notification é a candidata mais provável** (streak/missões diárias já
  pedem por isso) — ainda não é tarefa aberta de backlog (nem o gatilho de
  quais eventos disparariam notificação foi desenhado), mas passa a ser o
  plano mais provável pra resolver este ponto quando a fase de submissão
  chegar, em vez de um "talvez" genérico.
- TestFlight pra distribuição de beta antes de submissão pública — útil
  justamente pra compensar a ausência de ambiente de teste local (seção 13).

## 13. Testes — o que dá pra fazer sem Mac, o que não dá

Esta seção existe porque o autor confirmou não ter Mac nem iPhone disponível.
**Decisão do autor em 2026-09-10: deixar a validação de iOS (build, CI em
nuvem, TestFlight) pro final** — o trabalho começa e evolui inteiramente
validado no Android local; nada nas seções anteriores depende de iOS
funcionar antes do fim. A tabela abaixo continua valendo como registro do que
precisa existir quando essa etapa chegar.

| Nível | Android | iOS |
|---|---|---|
| Build/compilação | Local, normal (Gradle) | **Precisa de macOS** (Xcode) — impossível localmente aqui |
| Emulador/simulador | Local, normal | Simulador só roda em macOS — impossível localmente aqui |
| Testes unitários (Jest, lógica de bridge/deep link) | Local, normal, independe de plataforma | idem — código TS puro roda em qualquer SO |
| E2E (Detox) | Viável localmente contra o emulador Android | Inviável localmente; precisaria rodar inteiramente em CI com runner macOS |
| Teste manual em dispositivo real | Físico Android disponível, normal | Só via nuvem (ver abaixo) ou pedindo pra alguém com iPhone testar via TestFlight |

**Caminho recomendado pra compensar a ausência de Mac/iPhone:** usar um
serviço de CI em nuvem com runner macOS só pra iOS — GitHub Actions
(`macos-latest`, pago por minuto além da cota gratuita) ou um serviço
dedicado tipo Codemagic/Bitrise (têm plano gratuito com minutos limitados,
mais focado em mobile que o GitHub Actions genérico). O fluxo: cada push
gera um build iOS na nuvem, assinado com certificado/provisioning profile
guardado como secret, publicado direto no TestFlight — o autor (ou alguém
que ele peça) testa via app TestFlight no iPhone, sem nunca precisar de um
Mac físico. Alternativa complementar pra um smoke test visual sem depender
de ninguém: serviços tipo BrowserStack App Live (tem teste gratuito limitado)
dão acesso remoto a um iPhone real só pra abrir o app e conferir que carrega.

**Isso não é opcional pra "ter iOS de verdade"** — sem algum desses (nuvem
paga ou emprestada), o build iOS deste projeto nunca roda em lugar nenhum, só
compila (ou nem isso, já que compilar também exige macOS). Vale confirmar com
o autor qual desses caminhos ele está disposto a bancar/usar antes de
declarar "suporte a iOS" como entregue.

## 14. Checklist consolidado

Ordem sugerida (cada bloco pressupõe o anterior funcionando), já refletindo
as decisões da sessão de 2026-09-10 — foco em Android funcionando de ponta a
ponta primeiro, identidade visual e iOS por último:

1. [ ] `npx @react-native-community/cli init` em `mobile/` (sem
   containerização, exceção já registrada no `CLAUDE.md`), New Architecture
   (vem por padrão).
2. [ ] Definir `applicationId` Android (pode ser placeholder interno) + gerar
   SHA-1 do keystore de debug — pré-requisito silencioso do login Google
   (seção 7), mesmo sendo nome/ícone/versão "de verdade" (seção 10) uma
   etapa final.
3. [ ] `react-native-webview` apontando pra URL de produção do frontend
   (seção 2 — mesma origem que atende Chrome hoje), configurado com as props
   da seção 5 (`domStorageEnabled` é o item que mais silenciosamente quebra
   sessão se for esquecido).
4. [ ] Botão de voltar Android + gesto de voltar iOS.
5. [ ] Rede: `network_security_config`/ATS pro ambiente de dev, variáveis de
   ambiente por build variant (debug vs. release), confirmar CORS batendo em
   cada um (origem única, `FRONTEND_URL`, sem mudança pro mobile).
6. [ ] Implementar login Google via SDK nativo (seção 7): endpoint novo no
   backend (`POST /auth/google/token`, DDD lite completo — porta, caso de
   uso, router, testes, `.docs/backend/auth.md`) + client ID Android/iOS no
   Google Cloud Console.
7. [ ] Ponte de persistência de token pra storage nativo seguro (seção 8).
8. [ ] Upload de avatar validado dentro do WebView (permissões de mídia por
   versão de Android).
9. [ ] Ponte de download pro fluxo de exportação LGPD (seção 9) — sem isso é
   um requisito formal (RNF04) quebrado silenciosamente dentro do app.
10. [ ] Tela nativa de erro/sem conexão quando o WebView falha ao carregar.
11. [ ] Hosting de produção do frontend resolvido de vez (se ainda não
    estiver, decisão de infra geral do produto, não só do mobile — seção 2).
12. [ ] **Por último:** identidade do app — ícone final, splash de produção,
    nome de exibição, versionamento (seção 10); contas de desenvolvedor
    (Google Play + Apple), `targetSdkVersion` 36 conferido, política de
    privacidade pública, formulário de dados (seção 12); pipeline de CI em
    nuvem com runner macOS pro build/assinatura/TestFlight de iOS — única
    forma de validar iOS sem Mac local (seção 13).

## 15. Decisões já tomadas (registro) e o que ainda depende de infraestrutura geral

Decisões da sessão de 2026-09-10, por referência rápida:

- **URL vs. build empacotado:** URL — a mesma origem de produção que atende
  o navegador desktop, sem hosting separado pro mobile (seção 2).
- **Login Google:** SDK nativo, com endpoint novo no backend (seção 7).
- **Ponte de token pra storage nativo seguro (Keychain/Keystore):**
  implementar, não deixar só como recomendação (seção 8).
- **Botão de voltar do Android sem histórico:** sai do app direto, sem
  confirmação (seção 5).
- **Recurso nativo real pra reduzir risco de rejeição na Apple (Guideline
  4.2):** push notification é a candidata mais provável, mas ainda não é
  tarefa aberta de backlog — decisão de *rumo*, não de implementação ainda
  (seção 12).
- **Política de privacidade pública (URL não-autenticada) exigida pelas
  lojas:** confirmado como trabalho a fazer, não só um lembrete condicional
  — precisa de uma página estática nova fora do app autenticado (seção 12).
- **Identidade do app (ícone/splash/nome/versionamento) e submissão nas
  lojas:** deixados por último — só o identificador técnico
  (`applicationId`/bundle ID + SHA-1 de debug) precisa vir cedo, por causa do
  login (seção 10).
- **Pasta `mobile/`:** criada na raiz do monorepo, sem containerização,
  exceção já registrada na tabela do `CLAUDE.md` (seção 3).
- **Validação de iOS (build, CI em nuvem, TestFlight):** deixada por último
  — o trabalho evolui todo validado em Android local até lá; qual serviço de
  CI/nuvem macOS bancar segue em aberto pra quando essa fase chegar
  (seção 13).

O único item que segue genuinamente em aberto, e que não é uma decisão
específica do mobile: **onde a build de produção do frontend vai ser
hospedada de fato** (Nginx do próprio gateway vs. serviço externo) — o app
mobile só consome o resultado dessa decisão, não precisa disparar ela.
