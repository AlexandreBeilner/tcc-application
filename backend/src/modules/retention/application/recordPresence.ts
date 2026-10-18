import type { PresenceRepository } from './ports/presenceRepository'

// Registra que a pessoa apareceu hoje (dia UTC, a mesma convenção do streak). Chamado a cada
// requisição autenticada, então guarda em memória o último dia gravado por pessoa: a segunda
// requisição do dia não escreve. O backend roda como instância única (CLAUDE.md), então o cache
// não diverge; se um dia houver mais de uma, o pior caso é uma escrita repetida e inofensiva
// (a chave primária absorve). Best-effort: falha vira log e nunca derruba a requisição.
export class RecordPresenceUseCase {
  private cachedDay = ''
  private seenToday = new Set<string>()

  constructor(
    private readonly presence: PresenceRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  touch(userId: string): void {
    const day = this.clock().toISOString().slice(0, 10)
    if (day !== this.cachedDay) {
      this.cachedDay = day
      this.seenToday = new Set()
    }
    if (this.seenToday.has(userId)) return
    // Marca antes de gravar pra duas requisições simultâneas não gravarem juntas; se falhar, solta
    // a marca pra próxima requisição tentar de novo.
    this.seenToday.add(userId)
    this.presence.record(userId, day).catch((err: unknown) => {
      if (this.cachedDay === day) this.seenToday.delete(userId)
      console.error('[retention] falha ao registrar a presença do dia', err)
    })
  }
}
