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

export interface TextField {
  // Origem legível (ex: "lesson:1.2"), usada na mensagem e na chave de baseline.
  source: string
  field: string
  text: string
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
  for (const { source, field, text } of fields) {
    for (const rule of rules) {
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
