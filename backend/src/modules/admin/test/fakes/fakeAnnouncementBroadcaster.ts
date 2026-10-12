import type { AdminAnnouncement } from '../../application/ports/announcementAdmin'
import type { AnnouncementBroadcaster } from '../../application/ports/announcementBroadcast'

export interface FakeAnnouncementBroadcaster extends AnnouncementBroadcaster {
  started: AdminAnnouncement[]
  failWith: Error | null
}

export function createFakeAnnouncementBroadcaster(): FakeAnnouncementBroadcaster {
  const fake: FakeAnnouncementBroadcaster = {
    started: [],
    failWith: null,
    async start(announcement) {
      if (fake.failWith) throw fake.failWith
      fake.started.push(announcement)
    },
  }
  return fake
}
