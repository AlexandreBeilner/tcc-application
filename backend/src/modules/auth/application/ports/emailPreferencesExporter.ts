// Port própria e mínima sobre `modules/notifications` (EM.6.1), no mesmo desenho dos outros
// exportadores: o `auth` não conhece o outbox nem a tabela de preferências.
export interface ExportedEmailPreferences {
  social: boolean
  engagement: boolean
}

export interface EmailPreferencesExporter {
  exportForUser(userId: string): Promise<ExportedEmailPreferences>
}
