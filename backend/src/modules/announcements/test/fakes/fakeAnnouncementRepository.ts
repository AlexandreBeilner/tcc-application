import { randomUUID } from 'node:crypto'
import type {
  AnnouncementRepository,
  NewAnnouncement,
} from '../../application/ports/announcementRepository'
import type { Announcement, AnnouncementDraft } from '../../domain/announcement'

export class FakeAnnouncementRepository implements AnnouncementRepository {
  items: Announcement[] = []

  async listActive(now: Date): Promise<Announcement[]> {
    return this.items.filter(
      (a) => a.startsAt <= now && (a.endsAt === null || a.endsAt.getTime() > now.getTime()),
    )
  }

  async listAll(limit: number): Promise<Announcement[]> {
    return [...this.items]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
  }

  async findById(id: string): Promise<Announcement | null> {
    return this.items.find((a) => a.id === id) ?? null
  }

  async findOpenMaintenance(now: Date): Promise<Announcement | null> {
    return (
      this.items.find(
        (a) =>
          a.kind === 'maintenance' && (a.endsAt === null || a.endsAt.getTime() > now.getTime()),
      ) ?? null
    )
  }

  async create(input: NewAnnouncement): Promise<Announcement> {
    const created: Announcement = {
      id: randomUUID(),
      title: input.title,
      body: input.body,
      severity: input.severity,
      kind: input.kind,
      dismissible: input.dismissible,
      notifyByEmail: input.notifyByEmail,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      linkedHaltId: input.linkedHaltId ?? null,
      createdBy: input.createdBy,
      createdAt: new Date(),
    }
    this.items.push(created)
    return created
  }

  async update(id: string, draft: AnnouncementDraft): Promise<Announcement | null> {
    const index = this.items.findIndex((a) => a.id === id)
    if (index < 0) return null
    this.items[index] = { ...this.items[index]!, ...draft }
    return this.items[index]!
  }

  async setEnd(id: string, endsAt: Date): Promise<Announcement | null> {
    const index = this.items.findIndex((a) => a.id === id)
    if (index < 0) return null
    this.items[index] = { ...this.items[index]!, endsAt }
    return this.items[index]!
  }

  async remove(id: string): Promise<void> {
    this.items = this.items.filter((a) => a.id !== id)
  }
}
