// Edição do catálogo de pautas pelo painel (MO.6.8). A pauta continua fechada e de dois lados, sem
// texto livre solto: este módulo só valida o formato e o efeito (métrica, sentido e intensidade
// dentro da faixa), que o motor valida de novo ao aplicar.
import { InvalidAgendaTemplateError } from './errors'
import type { AgendaOption } from './assembly'
import { readEffectPreview } from './scoreboard'

export type AgendaTemplateOptionInput = Omit<AgendaOption, 'id' | 'assemblyId' | 'position'>

export interface AgendaTemplateInput {
  sector: string | null
  title: string
  description: string
  options: AgendaTemplateOptionInput[]
}

export interface AgendaTemplateAdminView extends AgendaTemplateInput {
  key: string
  kind: string
  active: boolean
  createdAt: Date
  // Onde a pauta já foi usada: serve para o painel avisar o que a edição afeta (as assembleias já
  // abertas guardam a própria cópia das opções).
  usage: { assemblies: number; activeProposals: number }
}

const KEY_PATTERN = /^[a-z][a-z0-9_]{2,59}$/
const OPTION_KEY_PATTERN = /^[a-z][a-z0-9_]{1,39}$/
const DASHES = /[–—]/

export const TEMPLATE_LIMITS = {
  title: { min: 3, max: 120 },
  description: { min: 10, max: 500 },
  optionLabel: { min: 3, max: 100 },
  optionSide: { min: 3, max: 200 },
  options: { min: 2, max: 4 },
} as const

function text(value: unknown, label: string, limits: { min: number; max: number }): string {
  if (typeof value !== 'string') throw new InvalidAgendaTemplateError(`${label} deve ser um texto`)
  const trimmed = value.trim()
  if (trimmed.length < limits.min || trimmed.length > limits.max) {
    throw new InvalidAgendaTemplateError(
      `${label} deve ter de ${limits.min} a ${limits.max} caracteres`,
    )
  }
  // O texto aparece no app; travessão como pontuação não entra em texto de interface.
  if (DASHES.test(trimmed)) {
    throw new InvalidAgendaTemplateError(`${label} não pode ter travessão`)
  }
  return trimmed
}

export function validateTemplateKey(key: string): string {
  if (!KEY_PATTERN.test(key)) {
    throw new InvalidAgendaTemplateError(
      'a chave deve ter de 3 a 60 caracteres: minúsculas, números e _, começando por letra',
    )
  }
  return key
}

// Setores do motor (enum `company_sector`, spec 3.3.2): lista fechada, para um erro de digitação
// nunca criar uma pauta que não é sorteada (ponto 051, decisão 2026-10-11). Vazio ou nulo vale
// para qualquer setor.
export const COMPANY_SECTORS = [
  'Mineração',
  'Agronegócio',
  'Bancário/Financeiro',
  'Varejo',
  'Energia',
  'Tecnologia',
] as const

function validateSector(raw: string | null): string | null {
  if (raw === null || raw.trim() === '') return null
  const sector = raw.trim()
  if (!(COMPANY_SECTORS as readonly string[]).includes(sector)) {
    throw new InvalidAgendaTemplateError(
      `o setor precisa ser um de: ${COMPANY_SECTORS.join(', ')} (ou ficar vazio para valer em qualquer setor)`,
    )
  }
  return sector
}

// Normaliza (aparar espaços) e valida o conteúdo de uma pauta. Devolve o conteúdo limpo.
export function validateTemplateInput(input: AgendaTemplateInput): AgendaTemplateInput {
  const sector = validateSector(input.sector)
  const title = text(input.title, 'o título', TEMPLATE_LIMITS.title)
  const description = text(input.description, 'a descrição', TEMPLATE_LIMITS.description)
  const { min, max } = TEMPLATE_LIMITS.options
  if (input.options.length < min || input.options.length > max) {
    throw new InvalidAgendaTemplateError(`a pauta precisa de ${min} a ${max} opções`)
  }
  const options = input.options.map((option, index) => {
    const n = index + 1
    if (!OPTION_KEY_PATTERN.test(option.key)) {
      throw new InvalidAgendaTemplateError(
        `a chave da opção ${n} deve ter de 2 a 40 caracteres: minúsculas, números e _`,
      )
    }
    if (readEffectPreview(option.effect) === null) {
      throw new InvalidAgendaTemplateError(
        `o efeito da opção ${n} precisa de métrica (crescimento ou qualidade), sentido (1 ou -1) e intensidade de 0 (exclusive) a 1`,
      )
    }
    const { metric, direction, intensity } = option.effect
    return {
      key: option.key,
      label: text(option.label, `o rótulo da opção ${n}`, TEMPLATE_LIMITS.optionLabel),
      gain: text(option.gain, `o ganho da opção ${n}`, TEMPLATE_LIMITS.optionSide),
      loss: text(option.loss, `a perda da opção ${n}`, TEMPLATE_LIMITS.optionSide),
      // Só os três campos conhecidos: o jsonb nunca guarda sobra do que o painel enviou.
      effect: { metric, direction, intensity },
    }
  })
  if (new Set(options.map((o) => o.key)).size !== options.length) {
    throw new InvalidAgendaTemplateError('as chaves das opções não podem se repetir')
  }
  return { sector, title, description, options }
}
