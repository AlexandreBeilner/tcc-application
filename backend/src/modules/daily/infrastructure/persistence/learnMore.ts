import type { LearnMore, LearnMoreKind } from '../../domain/content'

export function toLearnMore(kind: string | null, ref: string | null): LearnMore | null {
  return kind !== null && ref !== null ? { kind: kind as LearnMoreKind, ref } : null
}

export function learnMoreColumns(learnMore: LearnMore | null) {
  return { learnMoreKind: learnMore?.kind ?? null, learnMoreRef: learnMore?.ref ?? null }
}
