import type { AssemblyRepository } from '../../../assemblies/application/ports/assemblyRepository'
import type { Assembly } from '../../../assemblies/domain/assembly'
import type {
  AssemblyCalendarFact,
  AssemblyCalendarSource,
} from '../../application/ports/assemblyCalendarSource'

function titleOf(a: Assembly): string {
  const company = a.subjectLabel ?? 'Empresa'
  return a.title ? `${company}: ${a.title}` : company
}

// Adapter em processo: lê as assembleias e as traduz em marcos de calendário. O efeito só aparece
// quando a pauta ainda pode passar (aberta) ou passou; "não aprovada" não muda nada, então não
// vira marco de efeito.
export function createInProcessAssemblyCalendarSource(
  repository: Pick<AssemblyRepository, 'listForCalendar'>,
): AssemblyCalendarSource {
  return {
    async listBetween(from, to) {
      const within = (d: Date) => d >= from && d <= to
      const facts: AssemblyCalendarFact[] = []
      for (const a of await repository.listForCalendar(from, to)) {
        const title = titleOf(a)
        if (within(a.opensAt)) facts.push({ milestone: 'assembly_open', at: a.opensAt, title })
        if (within(a.closesAt)) facts.push({ milestone: 'assembly_close', at: a.closesAt, title })
        if (within(a.effectAppliesAt) && a.outcome !== 'not_approved') {
          facts.push({ milestone: 'assembly_effect', at: a.effectAppliesAt, title })
        }
      }
      return facts
    },
  }
}
