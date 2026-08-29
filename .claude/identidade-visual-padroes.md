# Identidade Visual — Padrões de Composição

> Complementa `.claude/identidade-visual-tokens.md` (tarefa 1.0). Tokens = vocabulário (cor,
> tipografia, espaçamento, raio). Este documento é a gramática: como compor uma tela pra que
> ela pareça uma plataforma financeira com identidade própria — não mais um dashboard genérico
> de IA. Resultado da sessão de redesenho das telas-âncora (pós-tarefa 6.4/6.5, antes da
> implementação real do Mercado). Toda tela nova, e qualquer redesign de tela existente, segue
> os padrões daqui antes de inventar solução nova.

## 0. Referência viva

Mapa da Trilha e Detalhe de Ativo + Confirmação de Ordem foram prototipados — mobile e desktop,
clicáveis — e fixam o padrão que este documento descreve:
https://claude.ai/code/artifact/b3c04cbc-2185-4165-a8d8-eff0cadf1ccf

Sempre que uma dúvida de composição não estiver resolvida aqui, comparar contra esse mockup
antes de decidir algo novo. Ele é a prova de que os tokens (seção 1 do doc de tokens:
"sobriedade na base, energia nos acentos") se traduzem em UI de verdade — os tokens sozinhos não
garantem identidade, a composição é que garante.

## 1. Princípio geral

A identidade nasce de tomar emprestada a linguagem visual real de mercado (home broker) nas
telas de dado sério, e reservar o "teatro" de gamificação pros momentos de recompensa — nunca
espalhar os dois igualmente pela tela inteira. Uma tela de decisão financeira (comprar/vender,
ver indicadores) fica sóbria; a energia dourada some, aparece na sequência (modal de sucesso,
badge, XP), não durante a decisão.

## 2. Motivos visuais obrigatórios (linguagem "home broker")

- **Sparkline** em todo card com valor monetário ou com métrica de progresso (XP, rentabilidade)
  — nunca decorativo puro, sempre no card certo.
- **Grid de fundo tipo "papel de gráfico"** atrás de qualquer visualização de série temporal
  (preço de ativo, progressão da trilha) — linhas 1px, opacidade baixíssima (~0.035), nunca
  chapada.
- **Números financeiros como protagonistas**: `font-variant-numeric: tabular-nums` (já é regra
  do doc de tokens, seção 3) + peso/tamanho de destaque — preço, saldo e total de ordem nunca
  competem em hierarquia com texto de apoio ao redor.
- **Price-flash**: qualquer ação do usuário que muda um valor monetário em tela (mudar
  quantidade, por exemplo) dispara uma transição rápida de fundo (~300–400ms, cor do token
  `--color-gamify-100`/`500` a baixa opacidade) — nunca uma atualização silenciosa de número.
- **Marcação "você está aqui"**: linha-guia tracejada + etiqueta, no estilo do indicador de
  preço atual de um gráfico de home broker — reaproveitável em qualquer "ponto atual" da
  aplicação (preço de um ativo, posição na trilha).

## 3. Convenção sólido vs. tracejado

Sólido + área preenchida = já aconteceu, já é seu. Tracejado + sem preenchimento = projeção,
ainda não aconteceu, ou bloqueado. Vale pra qualquer visualização de progressão (trilha, metas,
missões futuras), não só pra gráfico de preço.

Nunca preencher a parte "ainda não conquistada" de uma visualização, mesmo que pareça mais
bonito — o objetivo é não ensinar visualmente o usuário a contar como seu algo que ainda não
aconteceu (mesmo raciocínio de não confundir preço marcado com lucro realizado, que é conteúdo
da trilha).

## 4. Linhas de progressão têm altos e baixos — nunca uma reta

Qualquer linha que represente evolução ao longo do tempo (trilha de lições, XP semanal, e
qualquer gráfico futuro de "sua jornada") **nunca é uma reta nem uma curva perfeitamente
monotônica**. Ela tem ruído de curto prazo — pequenas quedas e subidas locais — com tendência de
alta no longo prazo (cada marco real acima do anterior, mesmo que o caminho até lá suba e desça).

Motivo:
- Uma reta perfeita entrega o truque visual — só o ruído faz a linha ler como um gráfico de
  ativo de verdade, não como uma barra de progresso disfarçada.
- Reforça pedagogicamente o conteúdo da própria trilha: crescimento real nunca é linear, nem em
  investimento nem em aprendizado.

Regra prática: entre dois marcos reais (duas lições, por exemplo), inserir pelo menos 2–3 pontos
de inflexão de ruído no path — sempre mantendo o marco seguinte acima do anterior. O trecho
tracejado/projetado (seção 3) pode ter ruído mais discreto que o trecho sólido, já que é só uma
expectativa, não um histórico.

## 5. Cor — reforço da regra de não-sobreposição (tokens, seção 2.3)

Ação de UI (toggle Comprar/Vender, botão genérico) **nunca** reaproveita verde/vermelho de
ganho/perda, mesmo sendo convenção comum em outros apps de mercado (comprar=verde,
vender=vermelho). Aqui o toggle fica neutro (azul de marca), porque o doc de tokens já reserva
verde/vermelho exclusivamente pra dado financeiro real — resultado de query, não estado de UI.

## 6. Teatro de recompensa

Energia visual de gamificação (dourado, glow, animação de entrada) fica reservada pro momento de
recompensa em si — modal de sucesso pós-ordem, popup de XP, reveal de conquista. Nunca decora a
tela de decisão/dado sério: painel de compra, indicadores fundamentalistas, fluxo de confirmação
ficam neutros (azul/superfície) até a ação se completar.

## 7. Responsividade — 3 breakpoints obrigatórios, desktop com composição própria

Breakpoints já fixados em `CLAUDE.md`: mobile `< 768px` · tablet `768–1023px` · desktop
`≥ 1024px`. Reforço específico desta sessão — **desktop não é mobile esticado com espaço morto
nas laterais**, precisa de composição própria:

| Elemento | Mobile | Tablet | Desktop |
|---|---|---|---|
| Navegação primária (TabBar) | barra fixa inferior | barra horizontal abaixo da TopBar | barra horizontal abaixo da TopBar |
| Layout de conteúdo | coluna única | coluna única, cards em grid 2 colunas onde já valia (`NetWorthCards`) | grid 2 colunas quando fizer sentido: coluna principal + painel lateral fixo/sticky |
| Confirmação de ação importante | bottom sheet subindo de baixo | bottom sheet | modal central — nunca bottom sheet em tela larga |

Exemplos fixados nas telas-âncora: Trilha desktop = gráfico maior + sidebar de evolução/próxima
lição; Detalhe de Ativo desktop = conteúdo principal + **ticket de ordem fixo na lateral**
(padrão real de home broker — o painel de compra/venda não fica embaixo do fold em tela larga).

## 8. Tipografia — pendência a fechar antes de qualquer tela nova

`Inter`/`Sora` estão nos tokens desde a tarefa 1.0 mas hoje caem no fallback `system-ui`
(`frontend/src/index.css` nunca carregou a fonte — pendência da seção 7 do doc de tokens). Boa
parte da identidade depende da tipografia real: carregar via Google Fonts ou self-host é
pré-requisito, não um nice-to-have, antes de qualquer tela nova ser considerada "seguindo este
documento".

## 9. Ícones

SVG inline estilo `lucide-react` (stroke-based, grid 24, `stroke-width` ~1.6–2.5,
`stroke-linecap`/`stroke-linejoin: round`) — nunca emoji, nunca dingbat. Consistente com o que já
é usado no projeto (`lucide-react`, tarefa da migração de ícones).

## 10. Telas-âncora

Mapa da Trilha e Detalhe de Ativo + Confirmação de Ordem são as telas-âncora (backlog) que fixam
este padrão. Qualquer tela nova compara contra elas — e contra o mockup da seção 0 — antes de
divergir. Se uma tela nova genuinamente não se encaixa em nenhum padrão daqui, isso é decisão de
produto: parar e perguntar (regra geral do `CLAUDE.md`), e documentar a decisão de volta neste
arquivo.
