import {
  CreateAnnouncementUseCase,
  EndAnnouncementUseCase,
  ListAnnouncementsUseCase,
  UpdateAnnouncementUseCase,
} from '../../../announcements/application/useCases/announcements'
import type { AnnouncementRepository } from '../../../announcements/application/ports/announcementRepository'
import { createInProcessAnnouncementAdmin } from '../../infrastructure/announcements/inProcessAnnouncementAdmin'

// O adapter em processo sobre um repositório em memória: os testes de rota e de caso de uso do
// painel exercitam as regras reais do módulo `announcements` sem banco.
export function createFakeAnnouncementAdmin(repository: AnnouncementRepository, now: () => Date) {
  return createInProcessAnnouncementAdmin({
    listAnnouncements: new ListAnnouncementsUseCase(repository, now),
    createAnnouncement: new CreateAnnouncementUseCase(repository, now),
    updateAnnouncement: new UpdateAnnouncementUseCase(repository, now),
    endAnnouncement: new EndAnnouncementUseCase(repository, now),
    now,
  })
}
