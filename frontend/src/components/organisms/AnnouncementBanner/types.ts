import type { ActiveAnnouncement } from '../../../services/announcements'

export interface AnnouncementBannerProps {
    announcements: ActiveAnnouncement[]
    onDismiss: (id: string) => void
}
