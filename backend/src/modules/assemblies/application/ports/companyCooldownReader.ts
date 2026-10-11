// Período de espera da empresa diante de uma mudança de fundamentos (cooldown do motor, dias
// simulados). A abertura da assembleia consulta antes de abrir (ponto 050, decisão 2026-10-11).
export interface CompanyCooldownReader {
  // Dias simulados que faltam para a empresa poder mudar de novo (0 = livre). Lança se o motor
  // não responde, para a abertura contar a falha e tentar de novo na rodada seguinte.
  daysLeft(companyId: string): Promise<number>
}
