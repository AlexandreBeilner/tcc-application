# Backlog — App Mobile (React Native + WebView)

Backlog executável derivado de `.claude/arquitetura-app-mobile-react-native-webview.md` (análise +
decisões tomadas em 2026-09-09/10) — mesma relação que `backlog-engajamento-gamificacao.md` tem com
`proposta-engajamento-licoes.md`: aquele documento é o "porquê" e o registro das decisões já
tomadas (URL hospedada em vez de build empacotado, login Google via SDK nativo, pasta `mobile/`
sem container, identidade visual e iOS deixados por último); este arquivo quebra isso em tarefas
executáveis, uma por sessão.

**Como usar este arquivo** — mesma disciplina dos outros dois backlogs:

1. Siga a ordem das fases (1 → 4) e, dentro de cada fase, a ordem numérica — as dependências reais
   estão listadas em cada tarefa, mas a ordem já resolve a maioria delas sozinha.
2. Cada tarefa é escopo de uma sessão. Não empacote várias tarefas numa sessão só — o ambiente
   nativo (emulador Android, Gradle, logs de dispositivo) já consome contexto sozinho; misturar
   duas tarefas é o caminho mais curto pra uma sessão perder o fio e cometer erro bobo.
3. Ao concluir uma tarefa, verifique os critérios de aceite antes de considerar pronta, e marque
   ✅ + acrescente um bullet de Entregável (mesmo padrão dos outros backlogs).
4. **1.1 é pré-requisito de tudo** — sem o toolchain (Android Studio/SDK, JDK, emulador) rodando de
   verdade, nenhuma outra tarefa tem como ser validada. Se essa tarefa travar por ambiente (SDK
   faltando, versão de JDK errada, emulador não abre), resolver isso é o próprio conteúdo da
   sessão — não pule pra frente sem o emulador rodando.
5. **3.2 toca `backend/`** — passa pelo checklist obrigatório do `CLAUDE.md` inteiro (porta nova em
   `application/ports/`, adapter em `infrastructure/`, Zod na borda HTTP, teste no mesmo commit,
   `.docs/backend/auth.md` atualizado, lint/build/test, `docker compose up`). Nenhuma outra tarefa
   deste backlog toca `backend/` ou `engine/`.
6. Nenhuma regra crítica do `CLAUDE.md` é reaberta aqui, e a rota web de login Google existente
   (`GET /auth/google`, `GET /auth/google/callback`) **não é removida nem alterada** por nenhuma
   tarefa — tudo que este backlog adiciona é aditivo, pensado especificamente pro app.
7. Escopo confirmado como fora deste backlog por ora (ver arquitetura-app-mobile, seção 1 e
   registro de decisões): push notification (proposta, ainda não amadurecida o suficiente pra virar
   tarefa), deep linking pra conteúdo específico, widgets, modo offline real de dados.

---

## Fase 1 — Fundação do app (toolchain, casca WebView, navegação)

Objetivo da fase: sair de "nada existe" pra um app Android que abre, carrega o SPA de verdade
contra o backend local (`docker compose up`), navega como um app (não como um browser solto) e
não trava numa tela branca se a rede cair. Sem nenhuma peça de autenticação especial ainda — login
por e-mail/senha já é suficiente pra validar tudo desta fase, porque é só um POST JSON (não passa
pelo Google, não esbarra no bloqueio de WebView da Fase 3).

### 1.1 · Bootstrap do projeto React Native ✅

- **Entregável:** `mobile/` criado na raiz do monorepo via
  `npx @react-native-community/cli@latest init Selucra --directory mobile --pm npm`
  (RN 0.87.1, template TypeScript, New Architecture default). AVD `Pixel_Test_API35` (API 35,
  x86_64) criado e validado ponta a ponta: `npx react-native run-android` builda (Gradle 9.4.1,
  ~13min na primeira vez por download de dependência) e instala `com.selucra` no emulador;
  Metro precisou ser iniciado manualmente em background (`npx react-native start`) porque o
  ambiente headless não tem terminal pra CLI abrir sozinha — sessões futuras que rodarem
  `run-android` neste ambiente devem fazer o mesmo. Tela padrão do template ("Welcome to React
  Native") confirmada via screenshot do emulador. `.gitignore` gerado pelo template já cobre
  `android/app/build/`, `ios/Pods/` e `*.keystore` (com exceção do `debug.keystore`) sem
  necessidade de ajuste manual. Nenhum arquivo fora de `mobile/` foi alterado.
- **Descrição:** criar o projeto RN "puro" (sem Expo) que vai virar a casca do app, e confirmar que
  o toolchain nativo funciona de ponta a ponta antes de escrever qualquer lógica. Esta tarefa é
  deliberadamente separada de "adicionar o WebView" (1.2) — problema de ambiente (SDK do Android,
  JDK, emulador) é a causa mais comum de sessão travada em projeto RN, e isolar isso aqui evita que
  uma sessão futura misture "o emulador não abre" com "o WebView não carrega".
- **O que fazer:**
  - `npx @react-native-community/cli@latest init` dentro de `mobile/` (raiz do monorepo, irmã de
    `backend/`, `engine/`, `frontend/`, `gateway/` — já registrado como exceção não containerizada
    na tabela "Arquitetura — resumo rápido" do `CLAUDE.md`), template TypeScript.
  - Confirmar `android/` (Gradle) gerado; **não** se preocupar com `ios/` ainda de verdade além de
    existir (Fase 4 é quem valida iOS, por decisão do autor).
  - Rodar o app default (tela de boas-vindas do template) no emulador Android local — só isso já
    prova que Android Studio/SDK/JDK/emulador estão funcionando.
  - `.gitignore` do projeto RN cobrindo `android/app/build/`, `ios/Pods/`, `*.keystore` (nenhum
    keystore de assinatura real deve ser commitado — o de debug gerado pelo próprio Gradle é
    aceitável, é sempre o mesmo hash conhecido publicamente).
- **Critérios de aceite:** `mobile/` existe na raiz do monorepo; `npx react-native run-android`
  builda e abre a tela padrão do template no emulador sem erro; nada de `frontend/`/`backend/`/
  `engine/` foi tocado.
- **Referências:** arquitetura-app-mobile §3 (onde o projeto vive), §4 (setup/versão do RN).
- **Dependências:** nenhuma.

### 1.2 · WebView real: variantes de build, rede e login e-mail/senha ponta a ponta ✅

- **Entregável:** `react-native-webview`/`react-native-config` instalados; `App.tsx` troca a tela de
  template por um `WebView` único apontando pra `Config.APP_WEB_URL` (`domStorageEnabled`,
  `javaScriptEnabled`, `mixedContentMode="never"`). Duas variantes via `.env.debug`/`.env.release`
  mapeadas em `android/app/build.gradle` (`project.ext.envConfigFiles`, sem product flavor
  nenhum): debug aponta pro **dev server do Vite** (`http://10.0.2.2:5173`, não o gateway direto —
  o gateway só serve API/JSON, quem serve o HTML do SPA é o Vite; achado desta sessão, corrige uma
  imprecisão do texto original da tarefa/arquitetura), release aponta pra um placeholder de URL de
  produção documentado (`.env.release`). `network_security_config.xml` em `android/app/src/debug/`
  libera cleartext só pra `10.0.2.2` (WebView) **e** `localhost` (cliente de dev embutido do RN que
  busca o bundle JS via Metro/`adb reverse`, canal totalmente separado do WebView — sem essa segunda
  entrada o app builda mas trava em "Unable to load script." assim que abre); manifest debug-only
  referencia o XML, manifest principal/release nunca tem essa possibilidade. Corrigido também um bug
  de edge-to-edge descoberto ao validar: `App.tsx` original não repassava `useSafeAreaInsets()` pro
  WebView, então a TopBar ficava atrás da status bar e a TabBar do próprio SPA ficava exatamente sob
  a barra de navegação 3-botões do Android, tornando-a impossível de tocar — corrigido com
  `paddingTop`/`paddingBottom` dos insets no container do WebView.
  Validado ponta a ponta no emulador (AVD API 35) contra `docker compose up` local (gateway) +
  `vite --host 0.0.0.0` (frontend): cadastro de usuário novo por e-mail/senha funciona (rota already
  existente, sem depender da Fase 3), trilha completa (33 lições) carrega com dado real do backend,
  navegação por 3+ telas (onboarding → trilha → lição → volta) e pela TabBar funciona, `docker compose`
  precisou de `FRONTEND_URL=http://10.0.2.2:5173` (CORS bate com a origem que o WebView apresenta,
  arquitetura-app-mobile seção 6). Sessão sobrevive a `am force-stop` + reabertura (prova de
  `domStorageEnabled` funcionando). Build de release inspecionado (manifest mesclado) confirma
  `android:usesCleartextTraffic="false"` e nenhuma referência a `networkSecurityConfig` — sem
  possibilidade de cleartext. `__mocks__/react-native-config.js` e `__mocks__/react-native-webview.js`
  adicionados pro Jest (ambos os pacotes publicam entry point ESM/nativo que quebra o parser sem
  mock).
- **Descrição:** esta é a tarefa que faz o app deixar de ser um template e passar a carregar o
  produto de verdade. Cobre três coisas que só fazem sentido resolvidas juntas (todas são
  pré-requisito umas das outras pra sequer conseguir ver a tela de login): a lib de WebView com as
  props corretas, a separação de ambiente dev/prod (senão não tem URL nenhuma pra carregar), e a
  liberação de tráfego não-criptografado só no ambiente de dev (senão o Android bloqueia a chamada
  antes de chegar no gateway).
- **O que fazer:**
  - Instalar `react-native-webview` (versão atual só suporta New Architecture — já é o padrão do
    template desde a 1.1, então não há conflito) e `react-native-config`.
  - Duas variantes de ambiente: **debug** apontando pro gateway local (`http://10.0.2.2:8000` no
    emulador Android — não `localhost`, que resolve pra dentro do próprio emulador) e **release**
    apontando pra um placeholder de URL de produção (a URL real de hosting ainda não existe —
    arquitetura-app-mobile §2/§15 —, então usar uma env var vazia/placeholder documentada é
    aceitável por ora, só não deixar hardcoded no código).
  - `network_security_config.xml` liberando cleartext **só pro host de dev**, referenciado **só**
    pelo manifest da variante debug (`android/app/src/debug/`, nunca no manifest principal/release)
    — a variante release nunca deve sequer ter a possibilidade de cleartext liberado.
  - `WebView` com `source={{ uri: <URL do ambiente ativo> }}` e, no mínimo, `domStorageEnabled=true`
    (sem isso o `localStorage` não funciona no Android e o login não persiste — é o bug mais fácil
    de não perceber num teste rápido, porque a primeira sessão "funciona"), `javaScriptEnabled=true`
    (default, mas deixar explícito), `mixedContentMode="never"`.
  - Validar contra o `docker compose up` local: abrir o app no emulador, fazer login por e-mail/
    senha (rota já existe, não depende de nada da Fase 3), navegar por 2-3 telas, **matar o
    processo do app** (não só colocar em background) e reabrir — precisa continuar logado, prova
    de que `domStorageEnabled` está de fato funcionando.
- **Critérios de aceite:** app no emulador carrega o SPA de verdade (não a tela de template);
  login por e-mail/senha funciona ponta a ponta contra o backend local; sessão sobrevive a matar e
  reabrir o processo do app; build de release não contém nenhuma configuração de cleartext (inspeção
  do manifest gerado, não só do arquivo fonte).
- **Referências:** arquitetura-app-mobile §5 (props do WebView), §6 (rede/cleartext/CORS), §11
  (variáveis de ambiente/build variants).
- **Dependências:** 1.1.

### 1.3 · Navegação nativa (botão voltar Android, gesto iOS, links externos) ✅

- **Entregável:** `App.tsx` ganhou `BackHandler` (`hardwareBackPress`) lendo `canGoBack` do último
  `onNavigationStateChange` via `ref` (não `state`, pra não reregistrar o listener a cada navegação);
  se `true`, chama `webviewRef.current.goBack()` e consome o evento; se `false`, devolve `false` e
  deixa o comportamento padrão do Android fechar a activity — sem diálogo de confirmação (decisão do
  autor, 2026-09-10). `allowsBackForwardNavigationGestures` (iOS, não testável neste ambiente Linux —
  Fase 4) e `originWhitelist` (regex derivado de `Config.APP_WEB_URL`, escapando os caracteres
  especiais da URL) + `onShouldStartLoadWithRequest` (abre `http`/`https` fora da origem via
  `Linking.openURL`, bloqueia o carregamento dentro do WebView) também adicionados. Descoberto durante
  a tarefa: `react-native-webview@14.0.1` publica a entrada `"typings"` do `package.json` apontando
  pro `index.d.ts` legado da raiz (classe genérica `WebView<P = undefined>`, de antes do componente
  virar forwardRef) — usar `ref` nesse tipo colapsa toda prop pra `never` (erro de overload do JSX); o
  par correto do runtime atual (`lib/WebView.{android,ios}.d.ts`) por sua vez tipa o ref como
  `RefAttributes<unknown>`, sem os métodos imperativos. Corrigido com um `types/react-native-webview.d.ts`
  local (módulo de augmentation com o shape real: props das 3 plataformas + um `WebViewHandle` com só
  os métodos que o app chama) e `paths` no `tsconfig.json` redirecionando `react-native-webview` pra
  esse arquivo — não muda o bundle (Metro continua resolvendo o pacote real via `node_modules`), só a
  lente de type-checking do `tsc`. Validado ponta a ponta no emulador (AVD API 35) contra
  `docker compose up` + `vite --host 0.0.0.0`: navegação em 2+ níveis (Trilha → menu do avatar →
  Configurações, URL real muda pra `/configuracoes` conforme log do gateway) e botão físico de voltar
  volta a SPA passo a passo (Configurações → Trilha) sem fechar o app; voltar de novo na Trilha (raiz)
  fecha a activity direto pro launcher, sem diálogo, confirmado via `dumpsys activity activities`
  (processo do app permanece vivo, só sai de foreground). `npx tsc --noEmit`, `npm run lint` e
  `npm test` passam.
  **Correção pós-merge (revisão da Fase 1, PR #20):** o `originWhitelist` descrito acima — regex
  montada na mão escapando `Config.APP_WEB_URL` — não funcionava: `react-native-webview` escapa a
  entrada inteira de novo antes de expandir `*` pra `.*` (`WebViewShared.tsx`,
  `originWhitelistToRegex`), então uma entrada já escapada por nós sofria duplo escape e não batia
  nem com a própria origem do app. Efeito: toda navegação top-level (inclusive same-origin) caía no
  ramo de "fora do whitelist" da lib e ia pro browser externo via `Linking.openURL`, e o
  `onShouldStartLoadWithRequest` do app virava código morto — mascarado porque a validação manual
  desta tarefa só exercitou navegação client-side (`pushState`) do SPA, que nunca passa por esse
  código. `isWithinAppOrigin` também tinha um `startsWith(APP_WEB_URL)` enganável por um host com a
  origem legítima como prefixo literal (ex. `.../5173.evil.com`). Ambos corrigidos: `ORIGIN_WHITELIST`
  agora é a URL crua com um `*` literal (formato que a lib já espera, sem escape manual);
  `isWithinAppOrigin` compara `URL.origin` exato. Testes de regressão adicionados em
  `__tests__/App.test.tsx` (antes só havia um smoke test de render) — um deles replica o algoritmo
  real de compilação do `originWhitelist` da lib pra travar a regressão sem emulador.
- **Descrição:** sem isso, o app "funciona" mas se comporta como um navegador solto, não como um
  app — o botão físico de voltar do Android sai do app em vez de navegar o SPA pra trás, e qualquer
  link que o SPA abrir (ex. termos de uso) fica preso dentro do próprio WebView em vez de abrir o
  navegador do celular.
- **O que fazer:**
  - `BackHandler` (RN core) escutando `onNavigationStateChange` do `WebView`: se `canGoBack`, chama
    `webviewRef.current.goBack()`; senão, **sai do app direto, sem tela de confirmação** (decisão do
    autor, 2026-09-10).
  - `allowsBackForwardNavigationGestures={true}` (iOS) — equivalente ao botão de voltar, gesto de
    arrastar da borda.
  - `originWhitelist` restrito ao domínio do frontend (+ domínio do gateway, se for host diferente)
    e `onShouldStartLoadWithRequest` abrindo qualquer navegação fora desse whitelist via
    `Linking.openURL` (navegador do sistema) em vez de deixar carregar dentro do WebView — sem isso
    o app vira um "navegador disfarçado" (risco de phishing e motivo real de rejeição na Apple,
    Guideline 4.2, ver Fase 4).
- **Critérios de aceite:** navegar 2-3 níveis dentro do SPA e apertar voltar no Android retorna
  passo a passo (não fecha o app); apertar voltar na tela inicial da trilha fecha o app direto,
  sem diálogo; um link externo (ex. abrir a política de privacidade, quando existir — Fase 4)
  abre no navegador do celular, não dentro do app.
- **Referências:** arquitetura-app-mobile §5.
- **Dependências:** 1.2.

### 1.4 · Tela nativa de erro/sem conexão ✅

- **Entregável:** `App.tsx` ganhou `renderError` no `WebView`: uma tela nativa simples ("Sem conexão" +
  "Tentar novamente", tokens dark de `identidade-visual-tokens.md`) que chama `webviewRef.current.reload()`
  no botão. Achado ao validar: `react-native-webview` renderiza o retorno de `renderError` como
  **irmão** do WebView nativo dentro do mesmo container flex (`{webView}{otherView}`,
  `WebView.android.tsx`), não como substituto — sem `position: 'absolute'` cobrindo 100% da área
  (mesmo padrão que a própria lib usa no seu `defaultRenderError`, `WebView.styles.ts`), a tela custom
  aparecia empilhada ABAIXO da página de erro nativa do Android/Chromium ("Webpage not available",
  branca) em vez de escondê-la — o engine trata esse interstitial como conteúdo "carregado com
  sucesso" e nenhum callback da lib consegue suprimi-lo, só cobrir por cima. Corrigido com
  `position: 'absolute'` + `width`/`height: '100%'` no container da tela de erro. Validado ponta a
  ponta no emulador (AVD API 35): matar o `vite` (não `docker compose stop` — o WebView aponta pro
  dev server do Vite, não pro gateway direto, mesma correção de entendimento já registrada na 1.2) e
  reabrir o app mostra só a tela nativa de erro, sem nenhum pixel da página de sistema; religar o
  Vite e apertar "Tentar novamente" carrega a Trilha normalmente sem reiniciar o processo do app
  (confirmado sem `am force-stop` entre o retry e a tela carregada). `npx tsc --noEmit`,
  `npm run lint` e `npm test` passam.
- **Descrição:** hoje, se a rede cair ou o backend estiver fora do ar, um WebView sem tratamento
  mostra uma tela de erro genérica do sistema (ou branca) — ruim pra qualquer app, e citado
  explicitamente como parte do que a Apple espera de um WebView "não preguiçoso" (Guideline 4.2,
  Fase 4).
- **O que fazer:** `onError`/`renderError` do `react-native-webview` cobrindo falha de carregamento
  com uma tela nativa simples ("Sem conexão — Tentar novamente"), botão de retry que recarrega o
  `WebView` (`reload()`). Não precisa de detecção proativa de rede (`@react-native-community/netinfo`)
  nesta tarefa — reagir à falha de carregamento já cobre o caso principal; adicionar detecção
  proativa é melhoria futura, não bloqueante.
- **Critérios de aceite:** desligar o backend local (`docker compose stop`) e abrir o app mostra a
  tela nativa de erro, não uma tela branca/erro de sistema; religar o backend e apertar "Tentar
  novamente" carrega o app normalmente, sem precisar reiniciar o processo do app.
- **Referências:** arquitetura-app-mobile, checklist item 10 da seção 14; §12 (risco de rejeição
  Apple).
- **Dependências:** 1.2.

---

## Fase 2 — Sessão e recursos que o SPA já tem mas o WebView não dá de graça

Objetivo da fase: fechar os gaps reais entre "rodar num navegador desktop" e "rodar dentro de um
WebView" pras três features do SPA que dependem de comportamento de navegador que WebView não
replica sozinho — persistência de sessão robusta, upload de arquivo e download de arquivo. Nenhuma
depende de login Google (Fase 3) — todas são validáveis com o login por e-mail/senha que já
funciona desde a 1.2.

### 2.1 · Ponte de sessão segura (Keychain/Keystore) ✅

- **Entregável:** `react-native-keychain@10` instalado. `sessionBridge.ts` novo (funções puras/
  testáveis, sem efeito colateral): `buildAuthWatcherScript()` — `injectedJavaScript` que instala
  um `setInterval` de 1s lendo `localStorage.getItem('tcc.auth.token')` e faz `postMessage` só
  quando o valor muda (login ou logout) — poll em vez de `onNavigationStateChange` porque o React
  Router navega via `pushState`, que não dispara esse callback do lado nativo de forma confiável;
  `buildAuthTokenReinjectionScript(token)` — `injectedJavaScriptBeforeContentLoaded` que reescreve a
  mesma chave de `localStorage` a partir do valor salvo no Keychain antes do SPA montar (string
  vazia quando não há token salvo); `parseAuthTokenChangedMessage(data)` — parser defensivo do
  payload de `onMessage`. `App.tsx`: `AUTH_KEYCHAIN_SERVICE` (`br.com.selucra.auth`, exportada
  pra teste) escopando as credenciais; efeito no mount lê `Keychain.getGenericPassword` (token vira
  state `authToken`); `<WebView>` só monta depois que essa leitura resolve (`isSessionReady`) — sem
  esse gate, o primeiro carregamento usaria um script de reinjeção "vazio" antes do Keychain
  responder; `handleMessage` grava (`setGenericPassword`) ou limpa (`resetGenericPassword`) o
  Keychain conforme o token da mensagem, espelhando em `authToken` pro próximo reload reinjetar o
  valor certo. `types/react-native-webview.d.ts` ganhou `WebViewMessageEvent` no re-export (mesmo
  padrão de augmentation da tarefa 1.3, só faltava esse tipo). Dois mocks manuais novos pro Jest
  (mesma mecânica de `__mocks__/react-native-config.js`): `react-native-keychain.js` (stubs
  `jest.fn()`) e `react-native-safe-area-context.js` (reexporta o mock oficial da lib,
  `react-native-safe-area-context/jest/mock` — sem ele `<SafeAreaProvider>` não resolve métricas
  iniciais em ambiente Jest e nunca renderiza os filhos; achado desta sessão, nenhum teste anterior
  havia inspecionado a árvore renderizada de `<AppContent>` de verdade). `sessionBridge.test.ts`
  (script do watcher executado como JS puro contra um `localStorage`/`window` simulados, sem
  emulador) e testes novos em `App.test.tsx` (leitura/gravação/limpeza do Keychain via o `<WebView>`
  mockado) — 19 testes no total, `npx tsc --noEmit`, `npm run lint` e `npm test` passam.
  Validado ponta a ponta no emulador (AVD API 35) contra `docker compose up` + `vite --host
  0.0.0.0`: cadastro de conta nova grava o token no Keychain (arquivo `RN_KEYCHAIN.preferences_pb`
  criado no instante do cadastro, confirmado via `run-as`); logout dentro do app limpa a sessão
  (reabrir mostra a tela de login, não a Trilha); com o usuário logado, apagar só o diretório
  `app_webview/Default/Local Storage` do app via `run-as` (mesma classe de perda de dados do WebView
  descrita na arquitetura pro iOS, simulável no Android apagando o diretório) sem tocar no Keychain,
  e reabrir o app — a sessão foi restaurada (tela pós-login, não a de login) e o gateway registrou
  `GET /auth/me` retornando `200` logo na largada, confirmando que o token reinjetado era válido, não
  sobra de estado antigo.
- **Descrição:** mesmo com `domStorageEnabled=true` (1.2), o `localStorage` de um WebView é mais
  frágil que o de um navegador desktop — em especial no iOS, que pode liberar espaço em disco
  apagando dados de WebView sob pressão de armazenamento, deslogando o usuário sem motivo aparente.
  Decisão do autor (2026-09-10): implementar a mitigação de mercado, não só documentá-la.
- **O que fazer:**
  - Instalar `react-native-keychain`.
  - Capturar o JWT assim que o login resolve dentro do WebView. Forma recomendada, **sem exigir
    nenhuma mudança no `frontend/`**: depois de cada `onNavigationStateChange` (ou em um timer curto
    após o carregamento inicial), rodar um `injectedJavaScript` que lê
    `localStorage.getItem('tcc.auth.token')` (mesma chave de `AuthContext/index.tsx`) e, se mudou
    desde a última leitura, manda pro lado nativo via `window.ReactNativeWebView.postMessage(...)`.
  - No `onMessage` do lado nativo, gravar o token em `react-native-keychain`.
  - Em todo carregamento novo do `WebView` (`injectedJavaScriptBeforeContentLoaded`, que roda antes
    do SPA montar), reinjetar `localStorage.setItem('tcc.auth.token', '<valor do Keychain>')` se
    houver um token salvo — isso é o que garante que uma sessão sobrevive mesmo que o iOS tenha
    limpado o `localStorage` por baixo.
  - Ao fazer logout dentro do SPA (token removido do `localStorage`), o mesmo mecanismo de leitura
    precisa detectar a remoção e limpar o Keychain também — senão um logout no app não desloga de
    verdade na próxima abertura (a reinjeção traria o token de volta).
- **Critérios de aceite:** logar, forçar o app a recarregar o `WebView` do zero (não só reabrir o
  app — recarregar a instância, ex. via um botão de debug temporário ou reiniciando o app) e
  confirmar que a sessão persiste mesmo simulando perda do `localStorage` (ex. limpando os dados do
  app via configurações do Android e confirmando que, **sem** essa ponte, o app deslogaria, e
  **com** ela, não); fazer logout dentro do app e reabrir confirma que a sessão não volta sozinha.
- **Referências:** arquitetura-app-mobile §8.
- **Dependências:** 1.2.

### 2.2 · Upload de avatar dentro do WebView ✅

- **Entregável:** nenhuma mudança de código — a tarefa se confirmou 100% validação, como a descrição
  já antecipava. Investigado o source do `react-native-webview@14` (`RNCWebChromeClient.java`,
  `RNCWebViewModuleImpl.java`): `onShowFileChooser` já é implementado incondicionalmente pela lib
  (não depende de nenhuma prop do componente `<WebView>`) e monta o intent de seleção com
  `Intent.ACTION_GET_CONTENT` + `CATEGORY_OPENABLE` (`getFileChooserIntent`) — isso delega a seleção
  pro seletor do sistema via Storage Access Framework, que roda em processo próprio e devolve só uma
  `content://` URI com permissão de leitura escopada ao app chamador. Esse caminho **nunca precisou**
  de `READ_MEDIA_IMAGES`/`READ_EXTERNAL_STORAGE` em nenhuma API level — a permissão de mídia só é
  necessária pra quem consulta o `MediaStore` diretamente, não pra quem usa
  `ACTION_GET_CONTENT`/`ACTION_OPEN_DOCUMENT`. Confirmado contra o manifest real do projeto
  (`android/app/src/main/AndroidManifest.xml`): só `INTERNET` declarado, nenhuma permissão de
  mídia/câmera — e o fluxo funcionou sem nenhum prompt de permissão em tempo de execução. Também
  verificado `needsCameraPermission()`: como o manifest não declara `CAMERA`, a lib nem tenta pedir
  permissão de câmera, só oferece "Camera"/"Media picker" no chooser nativo (a opção de câmera some
  sozinha se a permissão fosse declarada e negada, nenhum código do app precisa tratar esse caso).
  Validado ponta a ponta no emulador (AVD API 35, `targetSdkVersion 36`/API 36) contra
  `docker compose up` + `vite --host 0.0.0.0`, com uma imagem de teste indexada no MediaStore do
  emulador (`adb push` + broadcast de `MEDIA_SCANNER_SCAN_FILE`): Configurações → "Alterar foto" abre
  o chooser nativo do Android (Camera / Media picker) sem nenhum diálogo de permissão → "Media
  picker" abre o **Photo Picker do sistema** (`com.android.providers.media.module`, o seletor
  scoped-storage moderno, texto "This app can only access the photos you select") → selecionar a
  imagem fecha o picker e a tela de Configurações já mostra o avatar novo (no header e no card de
  perfil) sem reload. Log do gateway confirma `POST /me/avatar` → `200` seguido de
  `GET /avatars/<uuid>.png` → `200` com o tamanho exato do arquivo de teste enviado (913 bytes) — a
  imagem persistida bate com a enviada, não é cache/estado velho. `adb logcat` sem nenhum
  `FATAL EXCEPTION`/crash durante todo o fluxo.
- **Descrição:** a tela de Configurações (`Configuracoes/index.tsx`) já tem
  `<input type="file" accept="image/jpeg,image/png,image/webp">` pra trocar a foto de perfil.
  Versões atuais do `react-native-webview` já interceptam esse seletor nativamente (Android via
  `onShowFileChooser`, iOS via WKWebView desde a versão 13) — o trabalho real aqui é permissão e
  validação manual, não código de ponte.
- **O que fazer:**
  - Confirmar no `AndroidManifest.xml` a permissão de mídia certa pro `targetSdkVersion` escolhido
    (ex. `READ_MEDIA_IMAGES` em API 33+; versões mais novas do seletor de fotos do sistema podem
    dispensar permissão explícita — verificar contra o `targetSdkVersion` real do projeto, não
    assumir).
  - Testar no emulador: abrir Configurações → "Alterar foto" → escolher uma imagem da galeria do
    emulador → confirmar que o upload chega no backend (`POST /me/avatar`) e a foto aparece
    atualizada na tela.
- **Critérios de aceite:** fluxo completo de troca de avatar funciona no emulador Android, do clique
  em "Alterar foto" até a imagem nova aparecer; nenhum crash nem permissão negada silenciosamente.
- **Referências:** arquitetura-app-mobile §9 (parte de upload).
- **Dependências:** 1.2, 2.1 (precisa estar logado pra chegar em Configurações).

### 2.3 · Ponte de download (exportação de dados LGPD) ✅

- **Entregável:** `downloadBridge.ts` novo (mesmo padrão de `sessionBridge.ts`, tarefa 2.1 — funções
  puras/testáveis, efeito colateral fica em `App.tsx`): `buildDownloadInterceptorScript()` —
  `injectedJavaScript` que instala um listener de `click` em **fase de captura** no `document`
  (roda antes de qualquer handler do SPA, inclusive o `link.click()` disparado por
  `PrivacidadeLgpd.handleExport`), detecta `event.target.closest('a[download]')` com `href`
  começando em `blob:`, chama `preventDefault`/`stopImmediatePropagation`, busca o próprio blob via
  `fetch` (mesma origem, já em memória) e converte pra base64 via `FileReader.readAsDataURL`, então
  `postMessage` pro nativo; `parseFileDownloadMessage(data)` — parser defensivo do payload,
  mesma disciplina de `parseAuthTokenChangedMessage`. `App.tsx`: os dois scripts injetados (ponte de
  sessão da 2.1 + ponte de download desta tarefa) concatenados numa constante de módulo
  `INJECTED_JAVASCRIPT` (cada um com seu próprio guard de idempotência); `handleMessage` agora tenta
  parsear como mensagem de auth primeiro, senão como mensagem de download.
  **Desvio deliberado da sugestão original do backlog, com achado desta sessão:** investigado
  `Share.js` do próprio núcleo do React Native — no Android, `Share.share()` **descarta silenciosamente
  o campo `url`** antes de chamar o módulo nativo (`newContent = { title, message }`, sem `url`; o
  comentário da própria lib já documenta `url` como "(iOS)" apenas) — ou seja, a sugestão original
  ("gravar em disco com react-native-fs/blob-util, abrir `Share.share({ url: 'file://...' })`") não
  funcionaria no Android de jeito nenhum, o arquivo nunca chegaria no share sheet. Substituído por
  `react-native-share` (mantido ativamente, última publicação às vésperas desta sessão, com
  `codegenConfig` próprio — compatível com New Architecture): `Share.open({ url:
  'data:<mime>;base64,<base64>', filename, type, useInternalStorage: true, failOnCancel: false })`
  materializa o arquivo sozinho (cache **interno** do app — `useInternalStorage: true`, nenhuma
  permissão de storage envolvida) e monta um `Intent.ACTION_SEND` de verdade com `FileProvider`
  próprio da lib (`RNShareFileProvider`, autoridade `<package>.rnshare.fileprovider`, já registrado
  no manifest da própria AAR — nada pra configurar no app) — abordagem estritamente melhor que
  gravar à mão com `react-native-fs`/`react-native-blob-util` (que exigiria configurar um
  `FileProvider` próprio) e que a única alternativa cogitada com `react-native-blob-util` sozinho
  (`android.actionViewIntent`, `Intent.ACTION_VIEW`) — essa última é "abrir com", não "compartilhar
  com", e depende de existir um app instalado que trate o mime type como visualização. Nenhuma
  dependência de `react-native-fs`/`react-native-blob-util` foi instalada. `__mocks__/react-native-
  share.js` novo (mesma mecânica de mock manual dos outros pacotes nativos) e `downloadBridge.test.ts`
  (script executado como JS puro contra `document`/`fetch`/`FileReader` simulados, sem emulador,
  mesma mecânica de `sessionBridge.test.ts`) + testes novos em `App.test.tsx` cobrindo a mensagem de
  download chamando `Share.open` com os parâmetros certos e um cancelamento/erro do share sheet não
  derrubando o app — 29 testes no total, `npx tsc --noEmit`, `npm run lint` e `npm test` passam.
  Validado ponta a ponta no emulador (AVD API 35) contra `docker compose up` + `vite --host
  0.0.0.0`: Privacidade e LGPD → "Exportar dados" intercepta o clique (nenhum comportamento de
  browser/tela branca), abre o share sheet nativo do Android (`Intent.ACTION_SEND`, confirmado —
  ver nota abaixo) e o arquivo `meus-dados.json` foi conferido via `run-as` diretamente no
  armazenamento privado do app (`cache/Download/meus-dados.json`), com o JSON completo e correto
  (usuário, progressão, lições, conquistas — dados reais da conta de teste, não vazio/corrompido).
  **Limitação do ambiente, não do app:** este AVD (imagem mínima, sem Gmail/Drive/WhatsApp/Bluetooth)
  não tem nenhum app instalado que aceite `ACTION_SEND` de `application/json` — o share sheet abre e
  mostra "No apps can perform this action", que é a resposta padrão do `ResolverActivity` do Android
  quando o Intent é válido mas zero apps o resolvem, não um erro do app (mesma classe de limitação
  que a tarefa 2.2 teria enfrentado com `react-native-blob-util`/`ACTION_VIEW`). Um dispositivo/AVD
  com qualquer app de compartilhamento real completaria o fluxo sem nenhuma mudança de código — a
  gravação do arquivo com conteúdo correto e o `Intent.ACTION_SEND` corretamente montado (confirmado
  via `run-as`) são a evidência disponível de que a ponte funciona ponta a ponta até o limite do que
  este ambiente consegue exercitar.
- **Descrição:** o gap mais real e menos óbvio da análise. A tela de Privacidade/LGPD
  (`PrivacidadeLgpd/index.tsx:45-49`, requisito formal RNF04) gera o arquivo de exportação via
  `Blob` + `URL.createObjectURL` + `<a download>` clicado por script — um `<a download>` com URL
  `blob:` **não dispara download nenhum** dentro de um WebView, nem Android nem iOS. Sem esta
  tarefa, o botão "baixar meus dados" simplesmente não faz nada dentro do app.
- **O que fazer:**
  - Instalar `react-native-fs` (ou `react-native-blob-util`) pra gravação de arquivo, e usar
    `Share` (RN core) pro compartilhamento/salvamento final.
  - **Sem modificar o `frontend/`:** injetar, via `injectedJavaScript`, um listener global de
    `click` que detecta cliques em elementos `<a>` com atributo `download` e `href` começando com
    `blob:`; ao detectar, previne o comportamento padrão, faz `fetch(href)` pro próprio blob,
    converte pra base64 (`FileReader.readAsDataURL` ou equivalente) e manda pro lado nativo via
    `postMessage` (nome do arquivo + conteúdo base64).
  - No `onMessage` do lado nativo, decodificar o base64, gravar em disco (diretório temporário do
    app) com o nome de arquivo recebido, e abrir `Share.share({ url: 'file://...' })` pra o usuário
    escolher onde salvar/enviar.
- **Critérios de aceite:** dentro do app, ir em Privacidade/LGPD → exportar dados → o share sheet
  nativo abre com o arquivo `meus-dados.json` de verdade (conteúdo correto, não vazio) — validar
  abrindo o arquivo salvo depois e conferindo que é JSON válido com os dados esperados.
- **Referências:** arquitetura-app-mobile §9 (parte de download) — descrito lá como "a parte
  obrigatória, não nice-to-have", por ser requisito formal (RNF04).
- **Dependências:** 1.2, 2.1.

---

## Fase 3 — Login Google nativo

Objetivo da fase: o login social funcionando dentro do app, via SDK nativo (decisão do autor,
2026-09-10) — não o redirect atual, que o Google bloqueia dentro de WebView desde 2021
(`disallowed_useragent`). É a fase que toca `backend/`.

### 3.1 · Identificadores técnicos + Google Cloud Console (Android/iOS) ✅

- **Entregável:** `applicationId`/`namespace` Android já existiam como `com.selucra`
  (`android/app/build.gradle`, gerado desde a 1.1); bundle identifier iOS trocado do placeholder do
  template RN (`org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)`) pra `com.selucra`
  (`ios/Selucra.xcodeproj/project.pbxproj`, `PRODUCT_BUNDLE_IDENTIFIER`, configs Debug e
  Release) — mesmo valor do Android, por consistência, já que ambos são só identificador técnico
  interno por ora. Fingerprint SHA-1 do keystore de debug extraído de
  `mobile/android/app/debug.keystore` (não `~/.android/debug.keystore` — o keystore vive dentro do
  próprio projeto, achado desta sessão): `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`.
  Dois client IDs OAuth novos criados pelo autor no Google Cloud Console (Android: pacote
  `com.selucra` + SHA-1 acima; iOS: bundle ID `com.selucra`), sem mexer no client ID "Web
  application" existente. Documentados como `GOOGLE_ANDROID_CLIENT_ID`/`GOOGLE_IOS_CLIENT_ID` em
  `mobile/.env.debug` **e** `mobile/.env.release` (react-native-config) — não são segredo (client ID
  OAuth de app nativo é identificador público, diferente do client secret do fluxo web, que
  permanece intocado), então commitá-los nesses arquivos já versionados segue a mesma disciplina do
  resto do projeto. `.env.release` documenta explicitamente que o client ID Android ali reaproveita
  o mesmo valor amarrado ao SHA-1 de **debug** por ora — login Google em build de release só
  funciona de verdade depois que existir keystore de release e (outro client ID ou) um segundo
  fingerprint cadastrado nele, trabalho da tarefa 4.3. `npx tsc --noEmit`, `npm run lint` e
  `npm test` seguem passando; nenhum arquivo fora de `mobile/` tocado.
- **Descrição:** pré-requisito silencioso do login Google — mesmo que ícone/nome/splash finais do
  app fiquem pra Fase 4 (decisão do autor), o **identificador técnico** do app precisa existir
  antes, porque o Google exige um client ID OAuth por plataforma amarrado a esse identificador.
- **O que fazer:**
  - Definir `applicationId` (Android, `android/app/build.gradle`) e bundle identifier (iOS) — pode
    ser um placeholder interno (ex. `br.com.selucra.app`); trocar depois é possível, só exige
    recriar o client ID e reassinar.
  - Gerar/confirmar o keystore de debug (o próprio Gradle já cria um em `~/.android/debug.keystore`
    na primeira build) e extrair o fingerprint SHA-1 dele (`keytool -list -v -keystore
    ~/.android/debug.keystore`).
  - No Google Cloud Console (console.cloud.google.com → APIs & Services → Credentials), criar dois
    client IDs OAuth novos **além** do "Web application" que já existe (`.env.example`,
    `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, não mexer nele): um tipo "Android" (pacote +
    fingerprint SHA-1 de debug) e um tipo "iOS" (bundle ID) — mesmo sem poder testar iOS ainda
    (Fase 4), o client ID pode ser criado agora, é só cadastro.
  - Documentar os client IDs novos como variáveis de ambiente do projeto mobile (nunca hardcoded no
    código nativo) e anotar o client ID Android (o que a 3.2 vai precisar como "audience" aceito no
    backend).
- **Critérios de aceite:** `applicationId`/bundle ID definidos no projeto; client ID Android e iOS
  existem no Google Cloud Console, amarrados ao pacote/SHA-1 e bundle ID corretos; nenhum segredo
  novo commitado no repo (mesma disciplina do `.env.example` já existente).
- **Referências:** arquitetura-app-mobile §7 (dependência cruzada), §10 (identificador técnico vs.
  identidade visual).
- **Dependências:** 1.1.

### 3.2 · Backend: endpoint de troca de idToken Google por JWT ✅

- **Entregável:** implementado exatamente como desenhado (arquivos já existentes, sem reescrita).
  `GoogleIdentityProvider` (porta) ganhou `verifyIdToken(idToken): Promise<GoogleProfile>`.
  `googleIdentityProviderAdapter.ts`: lógica de "verificar idToken + montar `GoogleProfile`" extraída
  pra uma função interna (`verifyAndBuildProfile`) compartilhada por `exchangeCode` (fluxo web) e
  pelo novo `verifyIdToken` (fluxo nativo) — **os dois usam `audience: config.clientId` (client ID
  Web)**, achado já registrado em `runbook-mudanca-identidade-app-conta-google.md` seção 0 e
  corrigido nesta mesma sessão antes de implementar (o texto original desta tarefa dizia Android/iOS,
  estava errado). `createDisabledGoogleIdentityProvider` ganhou o mesmo `verifyIdToken` que lança o
  erro claro de configuração ausente. `LoginWithGoogleInput` virou união
  `{ code: string } | { idToken: string }`; `execute` despacha por `'code' in input` — todo o resto
  do método (achar/criar usuário e identidade, capital inicial RNF06) inalterado. Rota nova
  `POST /auth/google/token` em `authRouter.ts` (schema `googleTokenBodySchema` novo em
  `schemas.ts`, `idToken: string` não-vazio): `400` se ausente, `401` com log de erro se
  `LoginWithGoogleUseCase` lançar (idToken inválido/expirado/audience errada), `200` com
  `{ token, user }` no mesmo formato de `/auth/login`/`/auth/register` em caso de sucesso. Rotas
  `GET /auth/google`/`GET /auth/google/callback` inalteradas. Testes novos nos três níveis
  (`fakeGoogleIdentityProvider.verifyIdToken`, caso de uso, adapter real com mock de
  `google-auth-library` cobrindo sucesso/payload incompleto/erro de assinatura-expiração propagado,
  router via supertest cobrindo sucesso/400/401) — 10 testes novos, 570 no total no módulo
  `backend/`, todos passando. `npm run build`, `npm run lint` e `npm test` passam.
  `.docs/backend/auth.md` documenta a rota nova, incluindo a nota sobre `audience` ser o client ID
  Web. Validado via `docker compose up --build backend`: `POST /auth/google/token` sem `idToken` →
  `400`; com um idToken qualquer → `401` (log do container confirma o motivo real: login Google
  segue **desabilitado** neste ambiente por não haver `backend/.env` com credenciais reais — esta
  sessão não tem acesso a um idToken genuíno nem ao client secret Web pra validar contra o Google de
  verdade). Validação completa com um idToken real do SDK fica condicionada à tarefa 3.3 existir e
  `backend/.env` estar configurado, exatamente como o critério de aceite desta tarefa já previa.
- **Descrição:** o SDK nativo (`@react-native-google-signin/google-signin`, integrado na 3.3)
  devolve um `idToken` assinado direto no app, sem passar pelo redirect `/auth/google` atual. O
  backend precisa de uma porta de entrada nova pra validar esse `idToken` e emitir o JWT da própria
  aplicação — **reaproveitando quase tudo que já existe**, não uma reescrita.
- **O que muda no código (grounded no que já existe em `backend/src/modules/auth/`):**
  - `application/ports/googleIdentityProvider.ts` já declara `GoogleIdentityProvider` com
    `buildAuthUrl`/`exchangeCode` (usados pelo fluxo web atual). Adicionar um método novo à mesma
    interface: `verifyIdToken(idToken: string): Promise<GoogleProfile>` — devolve o mesmo formato
    `GoogleProfile` (`providerAccountId`/`email`/`name`) que `exchangeCode` já devolve, então nada
    consumidor dessa interface downstream precisa mudar de shape.
  - `infrastructure/google/googleIdentityProviderAdapter.ts` já usa `google-auth-library`
    (`OAuth2Client`) pro fluxo web — **a mesma lib expõe `OAuth2Client.verifyIdToken({ idToken,
    audience })`**, então não é preciso nenhuma dependência nova, só um método a mais no adapter
    real. **Correção registrada em `runbook-mudanca-identidade-app-conta-google.md` (seção 0):** o
    `audience` aceito aqui é o **client ID Web** (o mesmo `config.clientId`/`GOOGLE_CLIENT_ID` já
    usado por `exchangeCode` acima), **não** os client IDs Android/iOS da 3.1 — o
    `@react-native-google-signin/google-signin` emite o `idToken` com `aud` = o `webClientId`
    passado em `GoogleSignin.configure()` (padrão documentado do Google Sign-In nativo), os client
    IDs Android/iOS só autenticam o app nativo junto ao Google (pacote+SHA-1/bundle ID), não aparecem
    como `audience` no token verificado pelo backend.
  - `application/useCases/loginWithGoogle.ts` (`LoginWithGoogleUseCase`) hoje recebe
    `{ code: string }` e chama `googleIdentityProvider.exchangeCode(code)`. Generalizar
    `LoginWithGoogleInput` pra uma união (`{ code: string } | { idToken: string }`) e, dentro de
    `execute`, chamar `exchangeCode` ou `verifyIdToken` conforme o campo presente — **todo o resto
    do método (achar/criar usuário, achar/criar identidade, emitir token) continua idêntico**, é a
    mesma lógica de "achar ou criar a partir de um `GoogleProfile`" já escrita, só a origem do
    profile muda.
  - `interfaces/http/authRouter.ts` ganha uma rota nova (`POST /auth/google/token`, ou nome
    equivalente), com schema Zod em `schemas.ts` validando `{ idToken: string }`, chamando o mesmo
    `LoginWithGoogleUseCase` com o input `{ idToken }`. As rotas existentes (`GET /auth/google`,
    `GET /auth/google/callback`) não mudam.
  - `test/fakes/fakeGoogleIdentityProvider.ts` ganha `verifyIdToken` fake; teste do caso de uso
    cobrindo o novo branch; teste do adapter real (`googleIdentityProviderAdapter.test.ts`) cobrindo
    `verifyIdToken`; teste do router via supertest cobrindo a rota nova (sucesso e idToken
    inválido/expirado).
- **Critérios de aceite:** todo o checklist obrigatório do `CLAUDE.md` pra `backend/` (regra de
  negócio em `domain`/`application`, porta/adapter, Zod na borda, teste no mesmo commit, lint/
  build/test passando); `.docs/backend/auth.md` documentando a rota nova (payload, sucesso, erros —
  incluindo o caso de `idToken` inválido/expirado, que a lib de verificação já rejeita antes de
  chegar no caso de uso); `docker compose up` validando a rota nova com um `idToken` real gerado
  por um teste manual do SDK (pode ser feito só depois da 3.3 existir, mas a rota em si é testável
  isoladamente com um `idToken` de teste/mock de integração).
- **Referências:** arquitetura-app-mobile §7, `runbook-mudanca-identidade-app-conta-google.md`
  seção 0 (por que o `audience` é o client ID Web, não Android/iOS). Arquivos citados acima já
  existem no código — conferir contra o estado atual antes de assumir, como qualquer tarefa de
  `backend/`.
- **Dependências:** nenhuma de verdade sobre o `audience` (o client ID Web já existe desde antes da
  3.1) — mantida como dependência da 3.1 só porque a validação via `docker compose up` desta tarefa
  usa um `idToken` real, que só dá pra gerar depois que o SDK nativo (3.3) estiver configurado com
  os client IDs Android/iOS da 3.1.

### 3.3 · Mobile: SDK nativo de login Google ponta a ponta ✅ (código completo; login com conta real pendente — ver nota)

- **Entregável:** `@react-native-google-signin/google-signin@16.1.5` instalado. `GoogleSignin.configure()`
  chamado uma vez em `App.tsx` (module scope), com `webClientId` = `GOOGLE_WEB_CLIENT_ID` (client ID
  **Web**, novo em `mobile/.env.debug`/`.env.release` — confirmado com o autor que é o mesmo já usado
  pelo backend, não um client novo) e `iosClientId` = `GOOGLE_IOS_CLIENT_ID` (da 3.1); guardado atrás
  de um `if (GOOGLE_WEB_CLIENT_ID)` pra não derrubar o app num ambiente sem essa env var (mesmo
  princípio de `createDisabledGoogleIdentityProvider` no backend). UI 100% dentro do SPA — decisão
  desta sessão, entre as duas opções que a tarefa deixava em aberto: `googleSignInBridge.ts` novo
  (mesmo padrão de `sessionBridge.ts`/`downloadBridge.ts` — funções puras/testáveis, efeito colateral
  fica em `App.tsx`) intercepta o clique no link "Entrar com Google" já existente
  (`frontend/src/pages/Login/index.tsx`, **sem nenhuma mudança no frontend/**) comparando o `pathname`
  resolvido do `href` contra `/auth/google` (funciona com o link relativo ou absoluto, indiferente de
  `VITE_GATEWAY_URL`), e avisa o nativo via `postMessage`. `App.tsx.signInWithGoogle` (novo):
  `GoogleSignin.hasPlayServices()` → `GoogleSignin.signIn()` → se `type !== 'success'` (cancelamento),
  retorna sem fazer nada → `POST ${API_BASE_URL}/auth/google/token` (3.2) com o `idToken` → grava o JWT
  recebido no Keychain (mesmo serviço da 2.1) → **reinjeta e recarrega a sessão já em execução**
  (`webviewRef.current.injectJavaScript(buildAuthTokenReinjectionScript(token) +
  'window.location.reload();true;')`, reaproveitando a função de reinjeção da 2.1) — necessário porque
  o `AuthContext` do SPA só lê `localStorage` uma vez, no mount; sem o reload, o token ficaria salvo
  mas a tela de login não perceberia a sessão nova. Qualquer falha (Play Services ausente, cancelamento
  tratado à parte, backend rejeitando o idToken) cai num `catch` único que mostra `Alert.alert` nativo
  ("Não foi possível entrar com o Google — Tente novamente em instantes"), sem crashar o app. `API_BASE_URL`
  novo em `.env.debug`/`.env.release` (origem do gateway pra chamada HTTP nativa, fora do WebView — não
  confundir com `APP_WEB_URL`, a origem da página).
  `__mocks__/@react-native-google-signin/google-signin.js` novo; `__mocks__/react-native-webview.js`
  evoluiu de `WebView = View` pra um `forwardRef`+`useImperativeHandle` com os métodos imperativos
  (`injectJavaScript` etc.) como `jest.fn()` de módulo — sem isso `webviewRef.current` no teste seria a
  instância crua da View, sem esses métodos. **Achado de teste (não numérico/de produto, só de
  ferramenta):** `jest.requireMock('react-native-webview')` cria uma instância de mock ISOLADA da que o
  `import` estático de `App.tsx` usa (jest.fn()s diferentes, mesmo módulo) — corrigido usando
  `import * as WebviewModule` (mesmo mecanismo de resolução que `App.tsx`) com cast de tipo, não
  `jest.requireMock`. `googleSignInBridge.test.ts` novo (interceptor + parser, mesma mecânica sem
  emulador de `downloadBridge.test.ts`) e testes novos em `App.test.tsx` (sucesso completo grava
  Keychain+reinjeta+recarrega; cancelamento não chama backend; idToken rejeitado mostra alerta sem
  derrubar o app) — 41 testes no total no módulo mobile, `npx tsc --noEmit`, `npm run lint` e
  `npm test` passam. `./gradlew :app:assembleDebug` builda limpo com a dependência nova (só um aviso
  benigno da própria lib sobre atributo `package` no manifest dela, não nosso código).
  **Validação no emulador (AVD `Pixel_Test_API35`, imagem "Default"/AOSP, sem Google Play — confirmado
  via `adb shell pm list packages`, nenhum pacote `gms`/`vending`):** perguntado ao autor se queria criar
  um AVD com Google Play pra validar com conta real agora ou deixar pra depois — resposta: deixar pra
  depois. Dentro do que este AVD permite, a validação foi completa: `docker compose up --build backend`
  com credenciais reais do Google (client ID/secret que o autor forneceu) confirma o backend rejeitando
  um idToken forjado através da biblioteca real do Google (`google-auth-library`) contra a infraestrutura
  real do Google (progressão de erros observada: "Wrong number of segments" → "No pem found for envelope",
  a segunda exige uma consulta de verdade às chaves públicas do Google, não é mais o fallback
  "desabilitado" da 3.2); app instalado e aberto no emulador sem crash com `GoogleSignin.configure()`
  ativo (sessão restaurada de uma validação anterior carregou normalmente, sem regressão); app deslogado
  (`pm clear`) mostra a tela de login; tocar "Entrar com Google" intercepta o clique (sem navegação de
  browser/tela branca), chama `hasPlayServices()`, que rejeita de verdade
  (`GooglePlayServicesUtil: com.selucra requires the Google Play Store, but it is missing` no
  logcat) e o app mostra o alerta nativo de erro tratado, sem crashar — prova de que o `catch` único
  cobre esse caminho de erro real, não só em teste unitário. **O que fica pendente, explicitamente por
  decisão do autor:** login de ponta a ponta com uma conta Google real exige um AVD com imagem
  `google_apis_playstore` (ou dispositivo físico) e uma conta de teste — nenhuma mudança de código
  esperada pra essa validação, só ambiente. Sessão também criou `.env` na raiz (gitignored, mesma
  disciplina de `backend/.env`) com as credenciais reais fornecidas, pra deixar o `docker compose`
  local já configurado quando essa validação acontecer.
- **Descrição:** fecha o ciclo — o app obtém o `idToken` nativo, troca pelo JWT da aplicação (3.2),
  e aplica esse JWT pela mesma ponte de sessão da 2.1 (não é um mecanismo novo, é o mesmo).
- **O que fazer:**
  - Instalar `@react-native-google-signin/google-signin`. `GoogleSignin.configure()` precisa do
    **`webClientId`** (o client ID **Web** já existente, mesmo valor de `GOOGLE_CLIENT_ID` do
    backend — é isso que faz o SDK emitir um `idToken` verificável, ver
    `runbook-mudanca-identidade-app-conta-google.md` seção 0); os client IDs Android/iOS da 3.1
    também entram na configuração (a lib os detecta via `google-services.json`/
    `GoogleService-Info.plist` ou explicitamente, conforme a doc da lib), mas servem só pra
    autenticar o app nativo junto ao Google, não aparecem como `audience` do token.
  - Botão "Continuar com Google" na tela nativa (ou um gatilho a partir de um botão equivalente
    dentro do próprio WebView via `postMessage`, se preferir manter a UI de login 100% dentro do
    SPA — qualquer uma das duas funciona, mas **a chamada ao SDK do Google em si tem que ser
    nativa**, nunca dentro do WebView) → obtém o `idToken` → chama `POST /auth/google/token` (3.2)
    → recebe `{ user, token }` → aplica o `token` exatamente como a 2.1 aplica um token de
    login por e-mail/senha (grava no Keychain, injeta no `localStorage` do WebView, deixa o
    `AuthContext` do SPA seguir seu fluxo normal a partir daí).
- **Critérios de aceite:** login com Google funciona ponta a ponta no emulador Android (conta de
  teste real ou de desenvolvimento no Google); usuário cai logado no app exatamente como cairia no
  fluxo web; sessão sobrevive a matar/reabrir o app (mesmo teste da 1.2, agora cobrindo também o
  caminho de login Google).
- **Referências:** arquitetura-app-mobile §7.
- **Dependências:** 2.1, 3.1, 3.2.

---

## Fase 4 — Identidade, publicação e iOS

Deixados por último por decisão explícita do autor (2026-09-10) — nada aqui bloqueia o app
funcionar e ser testado localmente em Android; esta fase só importa quando a intenção virar
"publicar de verdade". Ordem interna ainda importa (4.1/4.2 são pré-requisito de 4.3/4.4).

### 4.1 · Identidade visual final do app

- **Descrição:** ícone, splash de produção, nome de exibição definitivo, versionamento — tudo que
  foi propositalmente adiado desde a 3.1 (que só cuidou do identificador técnico).
- **O que fazer:** ícone em todas as resoluções (`@bam.tech/react-native-make` ou geração manual),
  splash nativa (`react-native-bootsplash` ou equivalente) refletindo o tema dark padrão do produto
  (`data-theme="dark"`, `frontend/index.html`), nome de exibição, `versionName`/`versionCode`
  (Android) e `CFBundleShortVersionString`/`CFBundleVersion` (iOS).
- **Critérios de aceite:** app instalado no emulador mostra ícone/splash/nome finais, não os
  placeholders da 1.1/3.1.
- **Referências:** arquitetura-app-mobile §10.
- **Dependências:** 3.1 (o identificador técnico já existe, isso só substitui o visual por cima).

### 4.2 · Política de privacidade pública ✅ (conteúdo com placeholders do autor)

- **Entregável:** rota pública `/privacidade` (fora do `ProtectedRoute`, `frontend/src/pages/PoliticaPrivacidade/`)
  com política no padrão LGPD art. 9º: controlador, tabela de dados com finalidade e base legal, dados não
  coletados, compartilhamento, cookies/armazenamento, retenção (anonimização do `DELETE /me`), segurança,
  direitos (art. 18) com ponte pro fluxo in-app de exportar/excluir, menores e contato. Tabela vira blocos
  empilhados em mobile. Link na tela de Login (substituiu a menção a "Termos de Uso", que não existem). Dados que
  só o autor sabe (controlador, e-mail do encarregado, hospedagem, idade mínima, data) ficam como
  `[PREENCHER ...]` em `policyConfig.ts`: lista e passo a passo em `.claude/politica-privacidade-placeholders.md`.
  A tarefa só fica pronta pra publicar quando `grep -rn "PREENCHER" frontend/src` voltar vazio.
- **Descrição:** as lojas exigem uma URL pública (não autenticada) de política de privacidade. A
  tela de LGPD do produto (`pages/PrivacidadeLgpd`) hoje vive atrás de login — não serve como está.
  Confirmado pelo autor (2026-09-10) como trabalho a fazer, não um lembrete condicional.
- **O que fazer:** página estática nova, pública, fora do app autenticado (ex. rota do próprio
  `frontend/` acessível sem login, ou uma página hospedada à parte), com conteúdo adaptado da tela
  de LGPD existente pra quem nunca criou conta.
- **Critérios de aceite:** URL pública, sem exigir login, com o conteúdo de privacidade completo —
  a mesma URL que vai ser colada no formulário da Google Play/App Store.
- **Referências:** arquitetura-app-mobile §12.
- **Dependências:** nenhuma (independente do resto do app mobile — é conteúdo web público).

### 4.3 · Publicação no Google Play

- **Descrição:** processo de submissão em si.
- **O que fazer:** conta de desenvolvedor Google Play (US$ 25); confirmar `targetSdkVersion` 36
  (Android 16 — obrigatório pra apps novos desde 31/08/2026, checado na análise); formulário de
  segurança de dados (Data Safety) e política de privacidade (4.2); assinatura via Google Play App
  Signing.
- **Critérios de aceite:** app publicado (ao menos em faixa de teste interno) na Google Play
  Console.
- **Referências:** arquitetura-app-mobile §12.
- **Dependências:** 4.1, 4.2, e todas as Fases 1-3 concluídas.

### 4.4 · Validação e publicação iOS (CI macOS em nuvem + App Store)

- **Descrição:** todo o trabalho de compensar não ter Mac/iPhone localmente. Decisão do autor
  (2026-09-10): deixar pra quando chegar aqui — inclui decidir **qual** caminho de CI/nuvem macOS
  bancar (GitHub Actions `macos-latest`, Codemagic, Bitrise, ou Mac emprestado), o que ainda não foi
  escolhido.
- **O que fazer:** pipeline de CI com runner macOS gerando e assinando o build iOS, publicando no
  TestFlight; conta Apple Developer Program (US$ 99/ano); atenção ao risco de rejeição Guideline 4.2
  (Minimum Functionality) — confirmar que a casca nativa (Fases 1-2: splash, tela de erro/offline,
  navegação nativa) está de fato presente no build antes de submeter, já que é exatamente o que
  evita o enquadramento como "lazy wrapper". Push notification (candidata mais provável pra reforçar
  isso, sinalizada pelo autor como "boa ideia" mas ainda não escopada) pode entrar aqui como tarefa
  nova, se for decidida antes da submissão.
- **Critérios de aceite:** build iOS rodando de verdade (via TestFlight, testado por quem tiver um
  iPhone disponível) antes de qualquer submissão pública à App Store.
- **Referências:** arquitetura-app-mobile §12, §13.
- **Dependências:** 4.1, 4.2, e todas as Fases 1-3 concluídas (o app precisa estar completo em
  Android antes de valer a pena gastar o esforço de CI macOS).

---

## Resumo de contagem

| Fase | Nº de tarefas |
|---|---|
| 1 — Fundação do app | 4 |
| 2 — Sessão, upload, download | 3 |
| 3 — Login Google nativo | 3 |
| 4 — Identidade, publicação, iOS | 4 |
| **Total** | **14** |
