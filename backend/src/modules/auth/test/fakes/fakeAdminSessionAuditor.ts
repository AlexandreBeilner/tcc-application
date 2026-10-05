import type {
  AdminSessionAuditor,
  AdminSessionEventKind,
} from '../../application/ports/adminSessionAuditor'

export function createFakeAdminSessionAuditor(): AdminSessionAuditor & {
  events: { adminId: string; kind: AdminSessionEventKind }[]
} {
  const events: { adminId: string; kind: AdminSessionEventKind }[] = []
  return {
    events,
    async record(event) {
      events.push(event)
    },
  }
}
