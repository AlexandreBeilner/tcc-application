// Pausa do ciclo das assembleias (MO.6.8), no padrão das pausas de negociação do painel: global
// (todas as assembleias) ou de um assunto (uma empresa). Pausar impede abrir assembleia nova e
// aplicar efeito; não apaga nem adianta nada, então retomar continua de onde parou.
import { InvalidAssemblyPauseError } from './errors'

export type PauseScope = 'global' | 'subject'

export interface AssemblyPause {
  id: string
  scope: PauseScope
  // Nulos na pausa global.
  kind: string | null
  subjectRef: string | null
  reason: string
  createdBy: string
  createdAt: Date
  liftedAt: Date | null
  liftedBy: string | null
}

export const PAUSE_REASON_MIN = 3
export const PAUSE_REASON_MAX = 300

// Chave do escopo: uma pausa vigente por chave (garantido por índice único no banco).
export function scopeKeyOf(scope: PauseScope, kind: string | null, subjectRef: string | null) {
  return scope === 'global' ? 'global' : `${kind}:${subjectRef}`
}

export interface NewPauseInput {
  scope: PauseScope
  kind?: string
  subjectRef?: string
  reason: string
}

// Normaliza e valida o pedido de pausa: global não leva assunto, de assunto exige kind e assunto.
export interface ValidPause {
  scope: PauseScope
  kind: string | null
  subjectRef: string | null
  reason: string
}

export function validateNewPause(input: NewPauseInput): ValidPause {
  const reason = input.reason.trim()
  if (reason.length < PAUSE_REASON_MIN || reason.length > PAUSE_REASON_MAX) {
    throw new InvalidAssemblyPauseError(
      `o motivo deve ter de ${PAUSE_REASON_MIN} a ${PAUSE_REASON_MAX} caracteres`,
    )
  }
  if (input.scope === 'global') {
    if (input.subjectRef || input.kind) {
      throw new InvalidAssemblyPauseError('a pausa global não leva empresa')
    }
    return { scope: 'global', kind: null, subjectRef: null, reason }
  }
  if (!input.kind || !input.subjectRef) {
    throw new InvalidAssemblyPauseError('a pausa de uma empresa precisa dizer qual')
  }
  return { scope: 'subject', kind: input.kind, subjectRef: input.subjectRef, reason }
}

// A pausa vigente cobre esta assembleia? Global cobre tudo; de assunto, só aquele kind e assunto.
export function isPaused(
  active: readonly AssemblyPause[],
  kind: string,
  subjectRef: string,
): boolean {
  return active.some(
    (p) =>
      p.liftedAt === null &&
      (p.scope === 'global' || (p.kind === kind && p.subjectRef === subjectRef)),
  )
}
