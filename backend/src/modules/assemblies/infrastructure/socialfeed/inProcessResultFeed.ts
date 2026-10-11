import type { ResultFeed } from '../../application/ports/resultPublishers'

// Ponte em processo para `RecordAssemblyParticipationUseCase` do módulo `socialfeed`.
export function createInProcessResultFeed(recorder: {
  execute(input: {
    userId: string
    data: {
      assemblyId: string
      subjectLabel: string
      title: string
      outcome: 'approved' | 'not_approved'
    }
  }): Promise<void>
}): ResultFeed {
  return {
    async publishParticipation(userId, result) {
      await recorder.execute({
        userId,
        data: {
          assemblyId: result.assemblyId,
          subjectLabel: result.subjectLabel,
          title: result.title,
          outcome: result.outcome,
        },
      })
    },
  }
}
