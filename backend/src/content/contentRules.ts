// Regras de conteúdo proibido em texto visível ao usuário (tarefa RC.1.1 do
// backlog de revisão). Módulo puro: recebe campos de texto e devolve
// violações; quem coleta os campos (seeds de lição, conquista, missão) é o
// teste. A mesma lista de padrões vale pro engine (Go) e pro frontend, cada
// um com seu próprio teste.

export interface ContentRule {
  id: string
  pattern: RegExp
  description: string
}

export const FORBIDDEN_RULES: ContentRule[] = [
  { id: 'tcc', pattern: /\bTCC\b/, description: 'referência ao TCC' },
  { id: 'spec', pattern: /\bspec\b|\bespecifica[cç][aã]o\b/i, description: 'referência à spec' },
  { id: 'capitulo', pattern: /\bcap\.\s*\d/i, description: 'referência a capítulo' },
  { id: 'backlog', pattern: /\bbacklog\b/i, description: 'referência ao backlog' },
  { id: 'motor', pattern: /\bmotor\b/i, description: 'jargão interno "motor"' },
  {
    id: 'nesta-plataforma',
    pattern: /\b(nesta|desta|na) plataforma\b|\ba plataforma registra\b/i,
    description: 'mecânica da plataforma fora do bloco "Na plataforma"',
  },
  {
    id: 'simulado',
    pattern: /simulad/i,
    description: 'mecânica da plataforma fora do bloco "Na plataforma"',
  },
  { id: 'travessao', pattern: /—/, description: 'travessão como pontuação' },
  {
    id: 'snake-case',
    pattern: /\b[a-z]+_[a-z_]+\b/,
    description: 'nome de campo/coluna em snake_case',
  },
  {
    id: 'numero-de-licao',
    pattern: /\bli[cç][aã]o\s+\d/i,
    description: 'número de lição no texto',
  },
  { id: 'sandbox', pattern: /sandbox/i, description: 'jargão "sandbox" em texto de aprendizado' },
]

// Teto duro de um cartão de texto (parágrafo). O alvo de redação é ~280
// caracteres (princípio 0 do backlog); o teto abaixo é o que o teste não deixa
// passar.
export const CARD_TARGET_CHARS = 280
export const CARD_HARD_LIMIT_CHARS = 420

// Regras que o bloco "Na plataforma" (RC.3.3) pode violar: é o único lugar
// onde a mecânica da plataforma pode ser descrita (diretrizes §3).
export const PLATFORM_NOTE_EXEMPT_RULE_IDS = ['nesta-plataforma', 'simulado', 'sandbox', 'motor']

export interface TextField {
  // Origem legível (ex: "lesson:1.2"), usada na mensagem e na chave de baseline.
  source: string
  field: string
  text: string
  // Regras que não valem para este campo (ex: texto do bloco "Na plataforma").
  exemptRuleIds?: string[]
}

export interface Violation {
  ruleId: string
  source: string
  field: string
  excerpt: string
}

export function findForbidden(
  fields: TextField[],
  rules: ContentRule[] = FORBIDDEN_RULES,
): Violation[] {
  const found: Violation[] = []
  for (const { source, field, text, exemptRuleIds } of fields) {
    for (const rule of rules) {
      if (exemptRuleIds?.includes(rule.id)) continue
      const match = rule.pattern.exec(text)
      if (!match) continue
      const start = Math.max(0, match.index - 25)
      found.push({
        ruleId: rule.id,
        source,
        field,
        excerpt: text.slice(start, match.index + match[0].length + 25),
      })
    }
  }
  return found
}

// Cartão = parágrafo (separado por linha em branco) de campos longos de lição.
export function findOversizedCards(
  fields: TextField[],
  limit = CARD_HARD_LIMIT_CHARS,
): Violation[] {
  const found: Violation[] = []
  for (const { source, field, text } of fields) {
    for (const paragraph of text.split(/\n\s*\n/)) {
      if (paragraph.length > limit) {
        found.push({
          ruleId: 'cartao-longo',
          source,
          field,
          excerpt: `${paragraph.length} caracteres: ${paragraph.slice(0, 50)}...`,
        })
      }
    }
  }
  return found
}

interface BlockLike {
  type: string
  [key: string]: unknown
}

// Campos de texto de um bloco do contrato `blocks` (RC.3.1 a RC.3.3), pra o
// teste de conteúdo varrer o que o aluno vê. `long` marca texto corrido
// (sujeito ao teto de cartão).
export function blockTextFields(
  source: string,
  phase: string,
  blocks: readonly BlockLike[],
): { field: TextField; long: boolean }[] {
  const out: { field: TextField; long: boolean }[] = []
  blocks.forEach((block, i) => {
    const base = `blocks.${phase}[${i}]`
    const push = (name: string, text: unknown, long = false, exemptRuleIds?: string[]) => {
      if (typeof text === 'string' && text) {
        out.push({ field: { source, field: `${base}.${name}`, text, exemptRuleIds }, long })
      }
    }
    if (block.type === 'text') {
      push('markup', block.markup, true)
    } else if (block.type === 'more') {
      // "Saiba mais" (LJ.5.7) é o único lugar onde o texto pode passar do teto de cartão (diretriz §2):
      // varre título e conteúdo com as mesmas regras de texto proibido, mas sem `long`.
      push('title', block.title)
      const inner = Array.isArray(block.blocks) ? (block.blocks as BlockLike[]) : []
      for (const { field } of blockTextFields(source, `${phase}[${i}].more`, inner)) {
        out.push({ field, long: false })
      }
    } else if (block.type === 'check') {
      push('prompt', block.prompt)
      push('explanation', block.explanation)
      if (Array.isArray(block.options)) block.options.forEach((o, j) => push(`options[${j}]`, o))
    } else if (block.type === 'widget') {
      const props = (block.props ?? {}) as Record<string, unknown>
      const exempt = block.widget === 'platform-note' ? PLATFORM_NOTE_EXEMPT_RULE_IDS : undefined
      push('caption', block.caption)
      const goal = (block.goal ?? {}) as Record<string, unknown>
      push('goal.text', goal.text)
      push('goal.reveal', goal.reveal)
      for (const [key, value] of Object.entries(props)) push(`props.${key}`, value, false, exempt)
    }
  })
  return out
}

// Frases de "O que ficou" (LJ.1.5), no mesmo formato de `blockTextFields`: o resumo vive na raiz
// de `blocks`, fora das fases, e é texto visível como qualquer outro.
export function summaryTextFields(
  source: string,
  summary: readonly string[] | undefined,
): TextField[] {
  return (summary ?? []).map((text, i) => ({ source, field: `blocks.summary[${i}]`, text }))
}

export function violationKey(v: Pick<Violation, 'ruleId' | 'source' | 'field'>): string {
  return `${v.ruleId}|${v.source}|${v.field}`
}

export function countByKey(violations: Violation[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const v of violations) {
    const key = violationKey(v)
    counts[key] = (counts[key] ?? 0) + 1
  }
  return counts
}

export interface BaselineDiff {
  added: string[]
  stale: string[]
}

// Baseline é um catraca: violação nova (ou a mais) falha; violação que sumiu
// também falha até o baseline ser encolhido, pra a dívida só poder diminuir.
export function diffAgainstBaseline(
  current: Record<string, number>,
  baseline: Record<string, number>,
): BaselineDiff {
  const added: string[] = []
  const stale: string[] = []
  for (const key of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
    const now = current[key] ?? 0
    const before = baseline[key] ?? 0
    if (now > before) added.push(`${key} (${before} -> ${now})`)
    if (now < before) stale.push(`${key} (${before} -> ${now})`)
  }
  return { added, stale }
}

// Cartões do caminho principal de uma fase, como o player os monta: cada parágrafo de texto (separado por
// linha em branco) é um cartão, widget e pergunta também, e "Na plataforma" e "Saiba mais" colam no cartão
// anterior e não contam (LJ.1.3, LJ.5.7). Espelha `buildPhaseCards` do frontend.
export function countMainPathCards(blocks: readonly BlockLike[]): number {
  let count = 0
  for (const block of blocks) {
    const attaches =
      block.type === 'more' || (block.type === 'widget' && block.widget === 'platform-note')
    if (attaches && count > 0) continue
    if (block.type === 'text') {
      const paragraphs = String(block.markup ?? '')
        .split('\n\n')
        .filter((paragraph) => paragraph.trim().length > 0)
      count += Math.max(1, paragraphs.length)
    } else {
      count += 1
    }
  }
  return count
}
