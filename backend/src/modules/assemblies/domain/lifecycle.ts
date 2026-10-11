// Ciclo de vida da assembleia (MO.6.3): quando abrir, quanto dura e quando o efeito vale. Tudo
// parametrizado (nada fixo nas regras); o painel admin edita esses valores na MO.6.8.
import type { AgendaOption, NewAssemblyInput } from './assembly'

export interface LifecycleParams {
  // A assembleia abre este tanto de dias depois do balanço da empresa.
  openDelayDays: number
  // Até quantos dias além do atraso ainda se abre uma assembleia que o job perdeu (processo parado).
  catchUpDays: number
  // Quantos dias a votação fica aberta.
  durationDays: number
  // Quantos dias depois do fechamento o efeito é entregue ao motor.
  effectDelayDays: number
}

// Decisões do autor (2026-10-10): abre 2 dias depois do balanço, fica aberta 7 dias e o efeito
// começa 1 dia depois de fechar. A janela de recuperação (7) é nossa, só vale para o job perdido.
export const DEFAULT_LIFECYCLE_PARAMS: LifecycleParams = {
  openDelayDays: 2,
  catchUpDays: 7,
  durationDays: 7,
  effectDelayDays: 1,
}

const DAY_MS = 24 * 60 * 60 * 1000

export type AssemblySchedule = Pick<
  NewAssemblyInput,
  'opensAt' | 'snapshotAt' | 'closesAt' | 'effectAppliesAt'
>

// A data de corte é o instante da abertura: o snapshot de posições é tirado nesse momento.
export function planSchedule(now: Date, params: LifecycleParams): AssemblySchedule {
  const closesAt = new Date(now.getTime() + params.durationDays * DAY_MS)
  return {
    opensAt: now,
    snapshotAt: now,
    closesAt,
    effectAppliesAt: new Date(closesAt.getTime() + params.effectDelayDays * DAY_MS),
  }
}

// Chave de idempotência da abertura: uma assembleia por empresa e por balanço.
export function shareholderDedupeKey(companyId: string, reportDay: number): string {
  return `shareholder:${companyId}:${reportDay}`
}

export interface AgendaTemplate {
  key: string
  kind: string
  // Nulo vale para qualquer setor.
  sector: string | null
  title: string
  description: string
  // `general` abre pelo balanço; `profit` só abre a partir da declaração de dividendo retida.
  purpose?: TemplatePurpose
  options: Array<Omit<AgendaOption, 'id' | 'assemblyId' | 'position'>>
}

export type TemplatePurpose = 'general' | 'profit'

// Pauta sem finalidade gravada vale como geral.
export function purposeOf(template: Pick<AgendaTemplate, 'purpose'>): TemplatePurpose {
  return template.purpose ?? 'general'
}
export const TEMPLATE_PURPOSES: readonly TemplatePurpose[] = ['general', 'profit']

function hash(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Escolhe a pauta de uma empresa de forma determinística (mesma empresa e mesmo balanço dão
// sempre a mesma pauta, então reexecutar o job não muda nada). Candidatas: as do setor da empresa
// e as gerais; ordenadas por chave para não depender da ordem do banco. `null` sem candidata.
export function pickTemplate(
  templates: readonly AgendaTemplate[],
  companyId: string,
  sector: string,
  reportDay: number,
): AgendaTemplate | null {
  const candidates = templates
    .filter((t) => t.sector === null || t.sector === sector)
    .sort((a, b) => a.key.localeCompare(b.key))
  if (candidates.length === 0) return null
  return candidates[hash(`${companyId}:${reportDay}`) % candidates.length]
}
