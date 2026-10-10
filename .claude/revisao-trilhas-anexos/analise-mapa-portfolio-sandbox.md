# Análise: Mapa da Trilha, Distribuição (donut), cards Sandbox e varredura de UI

Somente leitura. Validação visual NÃO feita: o app exige login e digitar senha é proibido para o agente; todo o diagnóstico vem de leitura de código e geometria. Itens marcados (hipótese) precisam de confirmação no navegador.

Caminhos relativos a `frontend/src/`.

## 1. Mapa da Trilha: "Você está aqui" sob um nó

### Diagnóstico
- Causa certa do texto coberto: `components/organisms/TrackPath/index.tsx:110-114` renderiza `.hereMarker` como irmão do SVG, ANTES dos nós no DOM (nós em 116+). Em `index.module.css:225-244` o marcador é `position:absolute; left:0; right:0; justify-content:flex-end`, ou seja, a etiqueta fica SEMPRE encostada na borda direita do canvas, em `top = currentPoint.y`. Sem `z-index`, os nós (`.nodeWrap`, 249) pintam por cima (ordem de DOM).
- O zigue-zague (`features/lessons/trackPathLayout/index.ts:26,37-48`) põe os nós ímpares-pares em `x = 150 ± 90` (de 300 virtuais, convertidos em `left: %` em `index.tsx:24,127`). A lição de índice 1 (1.2) e 5, 9... ficam em 80% da largura. Em mobile (canvas ~328px): nó 242-282px (mais anel pulsante `scale(1.35)`, `module.css:296-316`), etiqueta ~100px de largura ocupa ~228-328px. Sobreposição certa. Em desktop (canvas 720px, `TrackMap/index.module.css:121`) a folga é de uns 20px, então toca com anel/zoom. Tablet usa a largura toda, sem `max-width`, e depende do viewport.
- Fundo quadriculado: pelo código ele cobre a altura inteira. O `<rect>` tem `height={layout.height}` (`index.tsx:83`), o `<svg>` tem `height={layout.height}` e `.canvas` tem `style={{height: layout.height}}`. Não achei limitação de altura por construção. Pontos frágeis (hipótese para o que o autor vê):
  1. O traço é `rgba(255,255,255,0.035)` fixo (`index.tsx:80`): praticamente invisível, e no tema claro (`index.css:106`, superfície branca) é invisível de fato. Pode parecer que "a grade acaba".
  2. `preserveAspectRatio="none"` (`index.tsx:75`) estica o padrão de 28 unidades só no eixo X (x escala por largura/300, y por 1), então as células ficam retangulares e desiguais entre breakpoints.
  3. `id="trackPathGrid"` global: duas instâncias do componente no DOM colidiriam (hoje só uma).
- Conclusão: o "fundo limitado" é percepção do contraste do traço; a causa real do bug visível é o marcador alinhado à direita e abaixo dos nós.

### Correção proposta (robusta)
1. Marcador "Você está aqui" como filho do nó atual (dentro do `.nodeWrap` do `target`), não mais posicionado por `top` isolado:
   - `.hereTag { position:absolute; bottom: 30px (desktop 34px); left:0; transform: translateX(-50%); z-index:2; pointer-events:none; white-space:nowrap }`. Centrada sobre o nó, acima dele. Nós em 20%/50%/80% de 328px ficam sempre dentro do canvas (etiqueta ~100px). Para x=20% (65px) a etiqueta vai de 15 a 115px, OK; sem risco de cortar.
   - Garantir que o título do nó (`nodeMeta`, centralizado verticalmente, ~3 linhas) não colide: a etiqueta fica acima do círculo e o meta é lateral.
   - Manter a linha tracejada guia como `::before` do `.nodeWrap` do alvo (ou `.hereMarker` sem etiqueta) com `z-index:0`, `.nodeWrap` com `z-index:1`.
   - Rolagem inicial (`index.tsx:59`) continua centrando o `currentNodeRef`.
2. Grade via CSS no `.canvas`, não SVG: `background-image: linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px); background-size: 28px 28px;` com token `--grid-line` (dark `rgba(255,255,255,0.05)`, light `rgba(0,0,0,0.05)`) em `index.css`. Cobre sempre a altura do `.canvas` (que é `layout.height`), quadriculado quadrado, sem `id` global. Remover `<defs>`/`<rect>` do SVG. Registrar o token em `.claude/identidade-visual-tokens.md`.
3. Opcional: trocar `preserveAspectRatio="none"` por manter, aceitando que o traço do caminho distorce só em X (hoje já é assim); documentar.

### Testes (vitest/RTL)
- `TrackPath/index.test.tsx`: etiqueta "Você está aqui" é descendente do nó `available` (`within(nodeWrap).getByText`), existe uma só, e não existe quando não há `available` (trilha concluída/toda bloqueada).
- Teste de regressão: para lições com `available` em índices 0,1,2,3,5, a etiqueta está dentro do wrap do alvo (lógica independente de x).
- `trackPathLayout/index.test.ts`: `height` cresce linearmente com N (2, 4, 15) e todos os `x` ficam em [60, 240].
- jsdom não mede layout; cobrir sobreposição com teste de CSS/classe (etiqueta usa `.hereTag` dentro de `.nodeWrap`) e verificação manual/Playwright em 360, 768, 1280px (checar `getBoundingClientRect` da etiqueta vs. nós, interseção vazia).

## 2. Donut de Distribuição com valor em R$

### Estado atual
- `components/organisms/DistributionChart/index.tsx:39-61`: anel `conic-gradient` em `div role="img"` único (nenhuma fatia é elemento, impossível hover/foco por fatia). Legenda mostra só `%` (linha 55). `slice.value` já existe em `features/portfolio/distribution/index.ts:83-91` (R$), então não precisa de backend.
- RNF09 não bloqueia: é patrimônio do próprio usuário.
- Bug mecânico relacionado: `groupPositionsByCategory` (`distribution/index.ts:70-92`) NÃO filtra `isSandbox`; SAND3 (tipo `acao`) e SANDPRE entram no donut do Mercado Ao Vivo. Corrigir já na mesma tarefa (filtrar `!position.isSandbox`).
- Inconsistência a decidir: o donut usa custo (`quantity*averagePrice`, `distribution/index.ts:65-69,76`), enquanto os cards de patrimônio usam `markPrice` (`accountTotals/index.ts:22`). O R$ do tooltip não vai bater com "Investido" do card. Corrigir usando `markPrice ?? averagePrice` (mesma função) para fechar a soma das fatias = "Investido" do card.

### Proposta de componente
- Trocar `conic-gradient` por SVG de arcos (`<circle>` com `stroke-dasharray` ou `<path>` por fatia; sem lib nova), uma fatia por `<path tabIndex=0 role="button"|"img">`.
- Interação: desktop hover (`onMouseEnter/Move/Leave`) mostra tooltip flutuante; mobile toque/clique fixa; teclado Tab/Enter/Space abre, Esc fecha, setas ←/→ navegam fatias (roving tabindex).
- Tooltip: `Ações · R$ 1.234,56 · 40,0%`, usando `formatCurrency` + `formatPercentage`. Mesmo conteúdo no centro do donut (furo) como alternativa sem popup e fallback para toque: o furo mostra a fatia selecionada ou o total investido por padrão. Isso resolve mobile sem popup flutuante e é mais robusto.
- Legenda vira lista de botões com a mesma ação (hover/foco em item de legenda destaca a fatia e preenche o furo) e coluna de valor em R$ ao lado de %. Sempre visível, então a informação nunca depende de hover.
- A11y: `role="img"` com `aria-label` do resumo textual (todas as fatias, "Ações 40% R$ ..."), fatias com `aria-label` próprio, tooltip `role="tooltip"` + `aria-describedby`, `aria-live="polite"` no furo, foco visível (token de focus), `prefers-reduced-motion` sem transição de destaque, contraste do tooltip nos dois temas (usar `--color-bg-surface-elevated`).
- Novo molecule `ChartTooltip`/hook `useChartSelection` em `features/portfolio/` (estado: `activeCategory`, pointer vs. fixo).

### Testes
- `features/portfolio/distribution`: exclui sandbox; soma dos `value` == `liveInvested`; usa `markPrice`.
- `DistributionChart/index.test.tsx`: legenda mostra `formatCurrency(value)` e `%`; `userEvent.hover` na fatia mostra tooltip com R$; `click` fixa e `Escape` fecha; teclado (`Tab`, `Enter`, setas) navega e anuncia; centro mostra total quando nada selecionado; `aria-label` de cada fatia contém R$; uma só fatia (100%) renderiza círculo completo.
- `pages/Portfolio/index.test.tsx`: donut exibe R$ coerente com card "Investido".

## 3. Cards "Mercado Ao Vivo" e "Sandbox" (Portfólio, rota `/`)

### O que é o Sandbox de fato
- Engine: `engine/internal/domain/sandbox/sandbox.go`. Ativos fictícios `is_sandbox` com roteiro fixo por ticker; hoje só 2 existem (`SAND3` ação e `SANDPRE` tesouro prefixado sandbox da lição 1.7; `engine/cmd/seed/main.go:775,799`). Preço/taxa vêm de roteiro por "dia desde a primeira operação" (não o mercado global), idêntico para todo usuário (RNF08). Opera nas mesmas tabelas, funciona com mercado fechado (fim de semana simulado), não entra no ranking nem no patrimônio do ranking (`ranking/getNetWorth`), nem no donut (deveria; ver bug acima).
- Frontend: o card só soma `isSandbox` em `features/portfolio/accountTotals/index.ts:21-28`; mostra "R$ X" e "Não conta pro ranking" (`NetWorthCards/index.tsx:48-62`). Ambos os cards fazem `navigate('/extrato')` (linhas 26 e 50): é a mesma tela. Para quem nunca operou sandbox o card exibe R$ 0,00 com mesmo peso visual (mesma grade 1fr/1fr, `module.css:69-79`).
- Mercado Ao Vivo: patrimônio (caixa + investido a mercado), conta pro ranking, saldo R$ 10.000 inicial, `liveTag`.

### Decisões fechadas encontradas (não remover sem confirmar)
- Spec 3.1 (`especificacao...md:57-60`): "O Portfólio distingue visualmente saldo/posições de sandbox das de mercado ao vivo". Spec linha 428 (frontend: "distinção visual sandbox vs. mercado ao vivo"). Inventário 2.1 (`inventario...md:99`): "Card separado, visualmente distinto (selo modo aprendizado)... reforça a separação exigida na seção 3.1". RF12/RNF08 e backlog 4.11 (`...:356`: contrato "filtrar sandbox fora do ranking, preparando a separação visual da tela 2.1").
- Portanto remover o card contraria spec + inventário: é PONTO A CONFIRMAR com o autor (registrar em `.claude/pontos-em-aberto-decisao-produto.md` caso a decisão mude a spec; nenhum documento diz que o card precisa ser "destacado" nem do mesmo tamanho do card principal).

### Opções
| Opção | Descrição | Prós | Contras |
|---|---|---|---|
| A | Remover o card | Tela mais limpa | Contraria spec 3.1/inventário 2.1; perde o reforço "não conta pro ranking" |
| B | Rebaixar: card principal ocupa largura total; Sandbox vira faixa compacta (uma linha: ícone, "Modo Aprendizado", valor, "Não conta pro ranking", chevron), só aparece se houver posição sandbox (`sandboxInvested>0` ou posição `isSandbox`); senão nada | Cumpre a distinção visual exigida; destaque proporcional ao uso; mobile mais curto | Esconde descoberta do Sandbox para quem nunca usou (mitigável via lição/Mercado) |
| C | Um card único com seletor (Ao vivo / Aprendizado) | Compacto | Esconde a separação, risco de confundir o que vale para o ranking |
| D | Mover para o Extrato/Mercado (seção "Ativos de prática") | Sandbox onde é usado | Tira da Portfólio: contraria inventário 2.1 |

### Recomendação: B
Mantém a decisão da spec (distinção visual + selo) sem dar peso igual ao que é limitado. Detalhes:
- Mercado Ao Vivo ocupa a linha; faixa Sandbox abaixo, `--color-brand-100` já usado (`module.css:89-92`), sem número grande.
- Estado vazio: sem posição sandbox, esconder a faixa (ou uma linha de texto discreta "Pratique sem risco no Modo Aprendizado" com link para a lição/ativo SAND3, se a lição liberar).
- Cada card deve ir a destinos diferentes: Ao vivo `/extrato`; Sandbox `/extrato?escopo=aprendizado` (filtro novo; hoje o Extrato já carrega ativos sandbox, `Statement/index.tsx:28`) ou ao ativo sandbox. Hoje a duplicidade confunde.
- Desktop: ao liberar a largura (ver 4.1), card ao vivo + donut lado a lado, faixa sandbox sob eles.
- Ponto a confirmar com o autor: A (remover) vs. B; e se a faixa some quando valor 0.

### Testes
- `NetWorthCards`: sem posições sandbox não renderiza a faixa; com posição renderiza valor e "Não conta pro ranking"; clique em cada card navega ao destino correto (`MemoryRouter` + `useNavigate` mock); `aria-label` distintos.
- `accountTotals`: já cobre soma; adicionar caso com `markPrice` sandbox ausente.

## 4. Varredura de UI (por código; hipóteses a validar no navegador)
1. **Portfólio sem composição desktop**: `pages/Portfolio/index.module.css:5-11` fixa `max-width:720px` e coluna única em todos os breakpoints, contra a regra "desktop não é mobile esticado" (CLAUDE.md, `identidade-visual-padroes.md`). Outras telas (Market 1080, Classificacao 1080, AssetDetail 2 colunas) têm. Proposta: ≥1024px grid 2 colunas (cards de patrimônio + donut à esquerda; missões + retomar lição à direita).
2. **Donut + sandbox misturados** (bug, seção 2): `distribution/index.ts:73` sem filtro `isSandbox`.
3. **Donut x cards usam bases diferentes** (custo vs. marcação a mercado).
4. **Donut pequeno e legenda sem R$**: `DistributionChart/index.module.css:69-75` fixo 140px sem escalar; o `.wrapper` com `flex-wrap` deixa legenda sobrando abaixo do anel em mobile sem alinhamento.
5. **Dois cards com densidade diferente**: Ao vivo tem 3 linhas + tag; Sandbox 1 linha, sem altura mínima; `NetWorthCards` alinha por `grid` mas não por conteúdo (altura igual só por stretch). Em sandbox vazio é R$ 0,00 em fonte 3xl (estado vazio fraco).
6. **Clique no card sem affordance**: `NetWorthCards/index.tsx:26,48` Card clicável sem seta/hover indicado; ambos vão ao mesmo lugar.
7. **Cabeçalho do Portfólio**: `.headerRight` `align-items:flex-end` com `flex-wrap` (`Portfolio/index.module.css:13-31`): em mobile o resumo de progressão e salário vão alinhados à direita sob o título, deixando buraco à esquerda (hipótese).
8. **Estado de carregamento**: "Carregando…" textual em 3 pontos do Portfólio (linhas 52 e 62), sem skeleton, causando salto de layout (CLS) quando os cards chegam.
9. **Trilhas / Mapa**: grade invisível no tema claro (`TrackPath/index.tsx:80`); `.hint` de nó bloqueado (`index.module.css:413-421`) fica na coluna de 168px e pode empurrar altura do meta e sobrepor nó seguinte (nós a 220px, hint longo + flag expandida chega perto) (hipótese).
10. **Nó concluído `color: var(--color-bg-base)`** sobre `--accent`: checar contraste por trilha nos dois temas.
11. Cards de `TrackCard`/`AchievementsGrid` com alturas fixas pontuais (`TrackCard/index.module.css:109,133`, `AchievementsGrid:63`): verificar texto longo em 360px.
12. Páginas em 720px sem ganho desktop: `Statement`, `Conquistas`/`Amigos` (têm 1024), `Lesson` (leitura, aceitável). Statement 720px com filtros em linha: validar.

## 5. Quebra em tarefas (uma sessão cada)

**T1. Corrigir marcador "Você está aqui" e grade do Mapa**
- Escopo: mover etiqueta para dentro do `.nodeWrap` do alvo, z-index, grade CSS com token `--grid-line` dark/light, remover SVG pattern; atualizar `identidade-visual-tokens.md`.
- Aceite: nos 3 breakpoints (360/768/1280) etiqueta nunca intersecta nó/título (verificação por `getBoundingClientRect` no Playwright ou manual); grade visível e cobre o canvas inteiro em trilhas de 2, 4 e 15 lições, tema claro e escuro; testes de 1 acima passam; lint/build/test ok.

**T2. Corrigir dados do donut (mecânico)**
- Filtrar `isSandbox`; base `markPrice ?? averagePrice`; testes.
- Aceite: soma das fatias == `liveInvested` do card; nenhum ticker SAND no donut.

**T3. DistributionChart interativo com R$**
- SVG de arcos, tooltip/furo, legenda com R$, teclado e aria (seção 2). Sem libs novas.
- Aceite: hover (desktop), toque/clique (mobile), Tab/Enter/setas/Esc funcionam; R$ e % corretos em cada fatia; furo mostra total por padrão; sem informação só em hover; testes RTL de 2 passam; 3 breakpoints.

**T4. Reorganizar cards de patrimônio/Sandbox (depende de confirmação do autor: opção A/B)**
- Implementar opção B (ou outra aprovada), destinos distintos, estado vazio sem R$ 0,00 gigante; registrar decisão em `pontos-em-aberto-decisao-produto.md` e ajustar inventário 2.1 + spec 3.1 se mudar.
- Aceite: com e sem posição sandbox; tela mais curta em mobile; testes de 3.

**T5. Composição desktop do Portfólio**
- Grid 2 colunas ≥1024px, skeletons nos cards, cabeçalho mobile alinhado (itens 1, 7, 8 da varredura).
- Aceite: três breakpoints sem espaço morto lateral; sem salto de layout; testes de renderização condicional.

**T6. Varredura visual com navegador (itens 9-12)**
- Rodar o app logado em 360/768/1280, tema claro e escuro; abrir tarefas específicas para o que for confirmado.
- Aceite: lista validada com capturas, itens confirmados no backlog.

Ordem sugerida: T2, T1, T3, (confirmar com o autor) T4, T5, T6.

## 6. Pontos a confirmar com o autor
- Remover/rebaixar o card Sandbox (spec 3.1, inventário 2.1, RF12): opção B recomendada.
- Donut a custo ou a mercado (recomendado: mercado, igual aos cards).
- O Sandbox sem posição some da Portfólio ou mantém uma dica de descoberta?
