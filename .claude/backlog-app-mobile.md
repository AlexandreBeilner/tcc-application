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
  `npx @react-native-community/cli@latest init Investimenta --directory mobile --pm npm`
  (RN 0.87.1, template TypeScript, New Architecture default). AVD `Pixel_Test_API35` (API 35,
  x86_64) criado e validado ponta a ponta: `npx react-native run-android` builda (Gradle 9.4.1,
  ~13min na primeira vez por download de dependência) e instala `com.investimenta` no emulador;
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

### 1.3 · Navegação nativa (botão voltar Android, gesto iOS, links externos)

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

### 1.4 · Tela nativa de erro/sem conexão

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

### 2.1 · Ponte de sessão segura (Keychain/Keystore)

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

### 2.2 · Upload de avatar dentro do WebView

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

### 2.3 · Ponte de download (exportação de dados LGPD)

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

### 3.1 · Identificadores técnicos + Google Cloud Console (Android/iOS)

- **Descrição:** pré-requisito silencioso do login Google — mesmo que ícone/nome/splash finais do
  app fiquem pra Fase 4 (decisão do autor), o **identificador técnico** do app precisa existir
  antes, porque o Google exige um client ID OAuth por plataforma amarrado a esse identificador.
- **O que fazer:**
  - Definir `applicationId` (Android, `android/app/build.gradle`) e bundle identifier (iOS) — pode
    ser um placeholder interno (ex. `br.com.investimenta.app`); trocar depois é possível, só exige
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

### 3.2 · Backend: endpoint de troca de idToken Google por JWT

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
    real, usando o(s) client ID(s) Android/iOS da 3.1 como `audience` aceito.
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
- **Referências:** arquitetura-app-mobile §7. Arquivos citados acima já existem no código —
  conferir contra o estado atual antes de assumir, como qualquer tarefa de `backend/`.
- **Dependências:** 3.1 (precisa do client ID como `audience`).

### 3.3 · Mobile: SDK nativo de login Google ponta a ponta

- **Descrição:** fecha o ciclo — o app obtém o `idToken` nativo, troca pelo JWT da aplicação (3.2),
  e aplica esse JWT pela mesma ponte de sessão da 2.1 (não é um mecanismo novo, é o mesmo).
- **O que fazer:**
  - Instalar `@react-native-google-signin/google-signin`, configurar com o client ID Android/iOS
    da 3.1.
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

### 4.2 · Política de privacidade pública

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
