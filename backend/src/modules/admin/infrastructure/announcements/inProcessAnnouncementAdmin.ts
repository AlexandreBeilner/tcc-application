import type {
  CreateAnnouncementUseCase,
  EndAnnouncementUseCase,
  ListAnnouncementsUseCase,
  UpdateAnnouncementUseCase,
} from '../../../announcements/application/useCases/announcements'
import type { Announcement } from '../../../announcements/domain/announcement'
import { announcementStatus } from '../../../announcements/domain/announcement'
import {
  AnnouncementConflictError,
  AnnouncementNotFoundError,
  InvalidAnnouncementError,
} from '../../../announcements/domain/errors'
import type {
  AdminAnnouncement,
  AnnouncementAdmin,
} from '../../application/ports/announcementAdmin'
import {
  AdminAnnouncementConflictError,
  AdminAnnouncementNotFoundError,
  InvalidAdminAnnouncementError,
} from '../../domain/errors'

export interface InProcessAnnouncementAdminDeps {
  listAnnouncements: ListAnnouncementsUseCase
  createAnnouncement: CreateAnnouncementUseCase
  updateAnnouncement: UpdateAnnouncementUseCase
  endAnnouncement: EndAnnouncementUseCase
  now?: () => Date
}

// Traduz as recusas do módulo `announcements` pros erros do painel (o router do admin
// só conhece os do próprio módulo).
async function translated<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (err instanceof AnnouncementNotFoundError) {
      throw new AdminAnnouncementNotFoundError(err.message)
    }
    if (err instanceof AnnouncementConflictError) {
      throw new AdminAnnouncementConflictError(err.message)
    }
    if (err instanceof InvalidAnnouncementError) {
      throw new InvalidAdminAnnouncementError(err.message)
    }
    throw err
  }
}

export function createInProcessAnnouncementAdmin(
  deps: InProcessAnnouncementAdminDeps,
): AnnouncementAdmin {
  const now = deps.now ?? (() => new Date())
  const withStatus = (announcement: Announcement): AdminAnnouncement => ({
    ...announcement,
    status: announcementStatus(announcement, now()),
  })

  return {
    list: () => deps.listAnnouncements.execute(),
    create: (adminId, input) =>
      translated(async () =>
        withStatus(await deps.createAnnouncement.execute({ draft: input, createdBy: adminId })),
      ),
    update: (id, changes) =>
      translated(async () => withStatus(await deps.updateAnnouncement.execute(id, changes))),
    end: (id) =>
      translated(async () => {
        const result = await deps.endAnnouncement.execute(id)
        return { announcement: withStatus(result.announcement), outcome: result.outcome }
      }),
    startMaintenance: (adminId, input) =>
      translated(async () =>
        withStatus(
          await deps.createAnnouncement.execute({
            draft: {
              title: input.title,
              body: input.body,
              severity: 'critical',
              dismissible: false,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
            },
            createdBy: adminId,
            maintenance: { linkedHaltId: input.linkedHaltId },
          }),
        ),
      ),
  }
}
