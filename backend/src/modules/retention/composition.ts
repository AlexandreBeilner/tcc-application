import type { Database } from '../../db/client'
import type { DailyCompletionListener } from '../daily/application/ports/dailyCompletionListener'
import type { LessonCompletionListener } from '../lessons/application/ports/lessonCompletionListener'
import type { LiveTradeListener } from '../market/application/ports/liveTradeListener'
import { RecordMilestoneUseCase } from './application/recordMilestone'
import { RecordPresenceUseCase } from './application/recordPresence'
import { createDrizzleMilestoneRepository } from './infrastructure/persistence/drizzleMilestoneRepository'
import { createDrizzlePresenceRepository } from './infrastructure/persistence/drizzlePresenceRepository'

// Composição do registro de retenção (RT.1.1): único lugar que instancia os adapters. Devolve a
// presença (pro middleware de auth) e um listener por módulo dono do fato, cada um traduzindo o
// aviso do seu módulo no marco correspondente. Montado cedo em `app.ts`, antes do middleware.
export function createRetentionRecorders(db: Database) {
  const recordPresence = new RecordPresenceUseCase(createDrizzlePresenceRepository(db))
  const recordMilestone = new RecordMilestoneUseCase(createDrizzleMilestoneRepository(db))

  const lessonCompleted: LessonCompletionListener = {
    onLessonCompleted: (userId) => recordMilestone.execute(userId, 'first_lesson'),
  }
  const liveTrade: LiveTradeListener = {
    onLiveTrade: async (userId, kind) => {
      await recordMilestone.execute(userId, 'first_trade')
      if (kind === 'fixed_income') await recordMilestone.execute(userId, 'first_fixed_income')
    },
  }
  const dailyCompleted: DailyCompletionListener = {
    onDailyCompleted: (userId) => recordMilestone.execute(userId, 'first_daily'),
  }

  return { recordPresence, lessonCompleted, liveTrade, dailyCompleted }
}
