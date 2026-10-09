import type { AdminAnnouncement } from '../../../services/admin'
import type { AnnouncementFormValues } from '../../../features/admin/announcementForm'

export interface AdminAnnouncementsPanelProps {
    announcements: AdminAnnouncement[]
    saving: boolean
    endingId: string | null
    // `editingId` é nulo quando o formulário cria um comunicado novo.
    onSave: (values: AnnouncementFormValues, editingId: string | null) => void
    onEnd: (announcement: AdminAnnouncement) => void
}
