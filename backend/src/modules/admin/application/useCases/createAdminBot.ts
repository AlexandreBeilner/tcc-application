import type { AdminBot, BotAdmin, CreateBotInput } from '../ports/botAdmin'
import type { RecordAdminActionUseCase } from './recordAdminAction'

// Criação de bot (N.1). As regras (faixas da personalidade, escopo, caixa) vivem no
// motor; aqui só a auditoria, inclusive quando o motor recusa. O id do bot criado vira o
// alvo da linha.
export class CreateAdminBotUseCase {
  constructor(
    private readonly botAdmin: BotAdmin,
    private readonly recordAdminAction: RecordAdminActionUseCase,
  ) {}

  async execute(adminId: string, input: CreateBotInput): Promise<AdminBot> {
    return this.recordAdminAction.run(
      {
        adminId,
        action: 'bot.create',
        targetType: 'bot',
        payload: {
          archetype: input.archetype,
          sectors: input.sectors,
          risk_classes: input.riskClasses,
          asset_classes: input.assetClasses,
          initial_cash: input.initialCash,
        },
      },
      () => this.botAdmin.create(input),
      (bot) => ({ targetId: bot.account_id }),
    )
  }
}
