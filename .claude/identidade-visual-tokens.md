# Identidade Visual — Tokens de Design

> Resultado da tarefa 1.0 do backlog. Documento de tokens, não mockups — define o vocabulário visual que toda tela (semana 6) e todo componente devem seguir. Qualquer estilização de tela deve referenciar este documento antes de inventar valor novo.

## 1. Princípios

Direção definida com o autor: **meio-termo entre dark-mode-first e fintech sóbrio** — sério como uma corretora, mas com cores fortes reservadas para os momentos de gamificação (XP, streak, conquistas, progressão de nível). Marca em azul cobalto elétrico — deliberadamente autêntico, não uma adaptação de paleta de concorrente (roxo Nubank, laranja Inter, verde PicPay/Next já são "tomados"); a saturação mais alta que o azul-de-banco tradicional é o que dá o ar de energia/gamificação sem depender de outra cor além dos acentos de XP e conquista.

- **Dark mode é o tema padrão** (`data-theme="dark"`), como em apps de trading — não é um extra opcional. Light mode existe como alternativa completa, não como o tema "principal" com um dark mode chapado por cima.
- **Sobriedade na base, energia nos acentos.** Superfícies, texto e bordas ficam em uma escala neutra (grafite/preto azulado). Cor forte é usada com intenção: marca (azul cobalto), gamificação (dourado) e semântica financeira (verde/vermelho) — nunca para decoração.
- **Alertas discretos, nunca agressivos.** Perda financeira é informação, não pânico. Vermelho de perda é dessaturado o suficiente para não disparar reação de aversão à perda — nada de vermelho neon piscando. Isso é decisão de produto (bem-estar financeiro do usuário), não só estética.
- **Não sobrepor semânticas.** "Ganho financeiro" (verde) e "conquista/lição concluída" (dourado) usam cores diferentes de propósito — ver seção 2.4. Se os dois usassem verde, o usuário confundiria "lucrei" com "completei uma lição".

## 2. Cores

Valores em hex, formato token CSS custom property. Prefixo `--color-`.

### 2.1 Marca (primária)

Azul cobalto elétrico — mais saturado que o azul de banco tradicional (Banco do Brasil, Santander, Neon), o que carrega parte do papel "enérgico" sem depender de roxo ou verde, já associados a concorrentes diretos. Usado em CTAs primários, links, indicador de nível/progresso da trilha, foco de inputs.

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-brand-500` | `#2F6FED` | `#2F6FED` | Ação primária (botões, links, foco) |
| `--color-brand-600` | `#1D4FC4` | `#1D4FC4` | Hover/active de ação primária |
| `--color-brand-300` | `#93B4FF` | `#1B3F94` | Texto/ícone sobre fundo de marca, destaque leve |
| `--color-brand-100` | `#0E1E42` | `#E8EFFE` | Fundo suave de elemento relacionado à marca (badge, chip) |

### 2.2 Neutros (superfícies e texto)

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-bg-base` | `#0E0F13` | `#F7F7F9` | Fundo da página |
| `--color-bg-surface` | `#16181D` | `#FFFFFF` | Cards, painéis |
| `--color-bg-surface-elevated` | `#1E2129` | `#FFFFFF` | Modais, dropdowns, elementos "acima" da superfície |
| `--color-border` | `#2A2E38` | `#E4E5EA` | Bordas, divisores |
| `--color-border-strong` | `#3A3F4C` | `#CBCDD6` | Bordas com mais ênfase (inputs em foco, cards selecionados) |
| `--color-text-primary` | `#F5F6F8` | `#14161B` | Texto principal |
| `--color-text-secondary` | `#9BA1AE` | `#5B6270` | Texto de apoio, labels |
| `--color-text-muted` | `#6B7280` | `#8A8F9A` | Texto desabilitado, metadados de baixa prioridade |

Sombra é evitada no dark mode (não lê bem sobre fundo escuro) — elevação é comunicada por diferença de `--color-bg-surface*` + borda de 1px. No light mode, elevação usa sombra suave (`box-shadow: 0 2px 8px rgba(20, 22, 27, 0.08)`).

### 2.3 Semânticas financeiras (ganho/perda)

Deliberadamente dessaturadas em relação ao vermelho/verde "puro" — sério, não alarmante.

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-gain-500` | `#34C77B` | `#1E9E5A` | Rentabilidade positiva, variação de preço para cima |
| `--color-gain-100` | `#0F2B1E` | `#E3F7EC` | Fundo suave (chip de variação positiva) |
| `--color-loss-500` | `#E5484D` | `#C4313A` | Rentabilidade negativa, variação de preço para baixo |
| `--color-loss-100` | `#2E1416` | `#FCE9EA` | Fundo suave (chip de variação negativa) |
| `--color-neutral-value` | `--color-text-secondary` | `--color-text-secondary` | Variação zero/estável |

Regra de uso: cor de ganho/perda só se aplica a **dados financeiros** (variação de preço, rentabilidade, saldo). Nunca reaproveitar para status de UI genérico (sucesso/erro de formulário usam tokens de feedback separados — seção 2.4a).

### 2.3a Feedback de formulário (erro de validação)

Resolvido na tarefa 6.2 (login/cadastro, primeira tela com formulário validado — pendência da seção 7 original). Mesmo hue do vermelho financeiro (sobriedade da paleta, seção 1), mas em token à parte — nunca reaproveitar `--color-loss-*` num erro de formulário, mesmo com o valor idêntico, pra manter a semântica separada (seção 2.3). Só erro foi necessário até agora; sucesso/aviso ficam pra quando um formulário precisar deles de fato.

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-feedback-error-500` | `#E5484D` | `#C4313A` | Texto de erro inline (credencial inválida, conflito de cadastro) |
| `--color-feedback-error-100` | `#2E1416` | `#FCE9EA` | Fundo suave da mensagem de erro |

### 2.4 Gamificação (XP, streak, conquistas)

Dourado/âmbar — intencionalmente fora da paleta verde/vermelho financeira, para que "progredi no jogo" nunca seja lido como "ganhei dinheiro".

| Token | Dark | Light | Uso |
|---|---|---|---|
| `--color-gamify-500` | `#F0A202` | `#B8790A` | XP, streak (chama), badge de conquista, nível |
| `--color-gamify-100` | `#332405` | `#FDF2DB` | Fundo suave (card de conquista, barra de XP) |

### 2.5 Estados da trilha (bloqueio/desbloqueio)

Reaproveitado em qualquer nó de progressão (trilha de lições, telas âncora 6.4):

| Estado | Estilo |
|---|---|
| Bloqueado | `--color-bg-surface` + ícone/texto em `--color-text-muted`, borda tracejada `--color-border`, sem sombra/glow |
| Disponível (próximo passo) | Borda sólida `--color-brand-500`, ícone em `--color-brand-300` |
| Concluído | Preenchido com `--color-gamify-500` (dourado — reforça "conquista", não "lucro") + ícone de check |

## 3. Tipografia

Duas famílias, papéis bem separados — evita depender de cor sozinha pra diferenciar "dado sério" de "elemento de jogo".

- **Corpo, dados financeiros, formulários:** `Inter` — alta legibilidade, ótimo suporte a números tabulares (essencial pra tabelas de preço/saldo não "dançarem" ao atualizar).
- **Títulos, headings, elementos de gamificação (XP, nível, badges, CTAs de destaque):** `Sora` — geométrica, um pouco mais expressiva que Inter, dá o toque "lúdico" sem virar infantil.
- Fallback: `system-ui, sans-serif` para ambas.

### Escala (razão ~1.25, base 16px)

| Token | px / rem | Uso |
|---|---|---|
| `--font-size-xs` | 12px / 0.75rem | Metadados, legendas |
| `--font-size-sm` | 14px / 0.875rem | Texto de apoio, labels |
| `--font-size-base` | 16px / 1rem | Corpo padrão |
| `--font-size-lg` | 18px / 1.125rem | Corpo destacado |
| `--font-size-xl` | 20px / 1.25rem | Subtítulo |
| `--font-size-2xl` | 24px / 1.5rem | Título de seção |
| `--font-size-3xl` | 30px / 1.875rem | Título de tela |
| `--font-size-4xl` | 36px / 2.25rem | Números de destaque (saldo total, nível) |
| `--font-size-5xl` | 48px / 3rem | Hero (onboarding, tela de resultado de missão) |

Pesos: `400` (corpo), `500` (labels/ênfase leve), `600` (subtítulos), `700` (títulos, números de destaque). Dados numéricos financeiros sempre com `font-variant-numeric: tabular-nums`.

## 4. Espaçamento

Grid de 4px. Escala usada em padding, gap, margin — sempre um múltiplo destes valores, nunca valor arbitrário:

`--space-1: 4px` · `--space-2: 8px` · `--space-3: 12px` · `--space-4: 16px` · `--space-6: 24px` · `--space-8: 32px` · `--space-12: 48px` · `--space-16: 64px` · `--space-24: 96px`

## 5. Raio de borda e elevação

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | 6px | Inputs, chips pequenos |
| `--radius-md` | 10px | Botões, cards padrão |
| `--radius-lg` | 16px | Cards grandes, modais |
| `--radius-full` | 9999px | Badges de XP/streak, avatares, pills |

Cantos arredondados o bastante pra soar amigável (linha com o "lúdico"), mas sem exagero tipo balão infantil — nada acima de `--radius-lg` em elementos grandes.

## 6. CSS custom properties (referência direta pro frontend)

```css
:root[data-theme="dark"] {
  --color-bg-base: #0E0F13;
  --color-bg-surface: #16181D;
  --color-bg-surface-elevated: #1E2129;
  --color-border: #2A2E38;
  --color-border-strong: #3A3F4C;
  --color-text-primary: #F5F6F8;
  --color-text-secondary: #9BA1AE;
  --color-text-muted: #6B7280;

  --color-brand-500: #2F6FED;
  --color-brand-600: #1D4FC4;
  --color-brand-300: #93B4FF;
  --color-brand-100: #0E1E42;

  --color-gain-500: #34C77B;
  --color-gain-100: #0F2B1E;
  --color-loss-500: #E5484D;
  --color-loss-100: #2E1416;

  --color-gamify-500: #F0A202;
  --color-gamify-100: #332405;

  --color-feedback-error-500: #E5484D;
  --color-feedback-error-100: #2E1416;
}

:root[data-theme="light"] {
  --color-bg-base: #F7F7F9;
  --color-bg-surface: #FFFFFF;
  --color-bg-surface-elevated: #FFFFFF;
  --color-border: #E4E5EA;
  --color-border-strong: #CBCDD6;
  --color-text-primary: #14161B;
  --color-text-secondary: #5B6270;
  --color-text-muted: #8A8F9A;

  --color-brand-500: #2F6FED;
  --color-brand-600: #1D4FC4;
  --color-brand-300: #1B3F94;
  --color-brand-100: #E8EFFE;

  --color-gain-500: #1E9E5A;
  --color-gain-100: #E3F7EC;
  --color-loss-500: #C4313A;
  --color-loss-100: #FCE9EA;

  --color-gamify-500: #B8790A;
  --color-gamify-100: #FDF2DB;

  --color-feedback-error-500: #C4313A;
  --color-feedback-error-100: #FCE9EA;
}
```

## 7. Pendências para quando o frontend existir (1.1c)

- Confirmar `Inter`/`Sora` via self-host ou Google Fonts (decisão de infraestrutura, não de design — deixar para 1.1c).
- ~~Tokens de feedback genérico de UI~~ — resolvido na tarefa 6.2 (seção 2.3a): só erro foi definido, por ser o único caso usado até agora (login/cadastro). Sucesso/aviso ficam pra quando um formulário precisar deles.
