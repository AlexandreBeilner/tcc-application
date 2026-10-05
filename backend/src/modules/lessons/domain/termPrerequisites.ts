// Lint de pré-requisitos de termos (RC.1.2): nenhum termo técnico aparece numa
// lição antes de ser apresentado. Um termo está "apresentado" quando (a) a
// lição que o define vem antes na trilha (ordem global `sortOrder`) ou (b) o
// próprio texto da lição o define inline com `{{termo}}` (entrada do glossário).
//
// `definedIn: null` significa que a lição que vai definir o termo ainda não
// existe (`plannedIn` diz qual tarefa a cria): até lá, todo uso sem definição
// inline é acusado. É o que faz o lint ficar verde só quando a Fase 4 termina.

export interface TermRule {
  id: string
  label: string
  pattern: RegExp
  // Código da lição que apresenta o termo, ou null enquanto ela não existe.
  definedIn: string | null
  plannedIn?: string
  // Chaves de glossário (`{{chave}}`) que contam como definição inline.
  glossaryKeys?: string[]
}

export const TERM_RULES: TermRule[] = [
  {
    id: 'selic',
    label: 'Selic',
    pattern: /\bselic\b/i,
    definedIn: null,
    plannedIn: 'RC.4.1',
    glossaryKeys: ['Selic'],
  },
  {
    id: 'cdi',
    label: 'CDI',
    pattern: /\bcdi\b/i,
    definedIn: null,
    plannedIn: 'RC.4.1',
    glossaryKeys: ['CDI'],
  },
  {
    id: 'tr',
    label: 'TR',
    pattern: /\bTR\b/,
    definedIn: null,
    plannedIn: 'RC.4.1',
    glossaryKeys: ['TR'],
  },
  {
    id: 'ipca',
    label: 'IPCA',
    pattern: /\bipca\b/i,
    definedIn: null,
    plannedIn: 'RC.4.1',
    glossaryKeys: ['IPCA'],
  },
  {
    id: 'ticker',
    label: 'ticker',
    pattern: /\bticker/i,
    definedIn: null,
    plannedIn: 'RC.4.2',
    glossaryKeys: ['ticker'],
  },
  {
    id: 'on-pn',
    label: 'ON/PN',
    pattern: /\b(ON|PN)\b/,
    definedIn: null,
    plannedIn: 'RC.4.2',
    glossaryKeys: ['ON', 'PN'],
  },
  {
    id: 'valor-de-face',
    label: 'valor de face',
    pattern: /valor de face/i,
    definedIn: '1.7',
    glossaryKeys: ['valor de face'],
  },
  { id: 'vna', label: 'VNA', pattern: /\bVNA\b/, definedIn: '1.10', glossaryKeys: ['VNA'] },
  {
    id: 'alavancagem',
    label: 'alavancagem',
    pattern: /alavanca/i,
    definedIn: '2.8',
    glossaryKeys: ['alavancagem'],
  },
  {
    id: 'payout',
    label: 'payout',
    pattern: /payout/i,
    definedIn: '2.6.6',
    glossaryKeys: ['payout'],
  },
  {
    id: 'jcp',
    label: 'JCP',
    pattern: /\bJCP\b|juros sobre capital/i,
    definedIn: '2.6.6',
    glossaryKeys: ['JCP'],
  },
  {
    id: 'itr-dfp',
    label: 'ITR/DFP',
    pattern: /\b(ITR|DFP)\b/,
    definedIn: '2.7',
    glossaryKeys: ['ITR', 'DFP'],
  },
  {
    id: 'valor-de-mercado',
    label: 'valor de mercado',
    pattern: /valor de mercado/i,
    definedIn: '2.2',
    glossaryKeys: ['valor de mercado'],
  },
  { id: 'nav', label: 'NAV', pattern: /\bNAV\b/, definedIn: '2.9', glossaryKeys: ['NAV'] },
  {
    id: 'agio-desagio',
    label: 'ágio/deságio',
    pattern: /ágio|deságio/i,
    definedIn: '1.7',
    glossaryKeys: ['deságio', 'ágio'],
  },
  {
    id: 'ordem-mercado-limite',
    label: 'ordem a mercado/limite',
    pattern: /ordem a mercado|ordem (a )?limite/i,
    definedIn: '2.4',
    glossaryKeys: ['ordem a mercado', 'ordem limite'],
  },
  { id: 'spread', label: 'spread', pattern: /spread/i, definedIn: '2.4', glossaryKeys: ['spread'] },
  {
    id: 'liquidez',
    label: 'liquidez',
    pattern: /liquidez/i,
    definedIn: '2.4',
    glossaryKeys: ['liquidez'],
  },
  {
    id: 'ciclico-defensivo',
    label: 'cíclico/defensivo',
    pattern: /cíclic|defensiv/i,
    definedIn: '2.8',
    glossaryKeys: ['cíclico', 'defensivo'],
  },
]

export interface LessonText {
  code: string
  sortOrder: number
  text: string
}

export interface TermViolation {
  termId: string
  label: string
  lessonCode: string
  definedIn: string | null
  plannedIn?: string
}

const hasInlineDefinition = (text: string, keys: string[] = []) =>
  keys.some((key) => text.includes(`{{${key}}}`))

export function findTermViolations(
  lessons: LessonText[],
  rules: TermRule[] = TERM_RULES,
): TermViolation[] {
  const orderByCode = new Map(lessons.map((l) => [l.code, l.sortOrder]))
  const violations: TermViolation[] = []
  for (const rule of rules) {
    const definerOrder = rule.definedIn === null ? null : (orderByCode.get(rule.definedIn) ?? null)
    for (const lesson of lessons) {
      if (!rule.pattern.test(lesson.text)) continue
      if (lesson.code === rule.definedIn) continue
      if (definerOrder !== null && definerOrder < lesson.sortOrder) continue
      if (hasInlineDefinition(lesson.text, rule.glossaryKeys)) continue
      violations.push({
        termId: rule.id,
        label: rule.label,
        lessonCode: lesson.code,
        definedIn: rule.definedIn,
        plannedIn: rule.plannedIn,
      })
    }
  }
  return violations
}
