// Marcos das assembleias para o Calendário de mercado (MO.6.3). O módulo `assemblies` é dono do
// dado; o Calendário só mostra. Datas em tempo real: quem usa converte para o dia simulado.
export type AssemblyMilestone = 'assembly_open' | 'assembly_close' | 'assembly_effect'

export interface AssemblyCalendarFact {
  milestone: AssemblyMilestone
  at: Date
  // Texto pronto para o evento (empresa e pauta), sem valor em reais nem patrimônio.
  title: string
}

export interface AssemblyCalendarSource {
  listBetween(from: Date, to: Date): Promise<AssemblyCalendarFact[]>
}
