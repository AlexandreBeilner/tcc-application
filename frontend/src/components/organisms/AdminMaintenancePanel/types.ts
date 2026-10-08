import type { AdminAnnouncement } from '../../../services/admin'

export interface MaintenanceFormValues {
    title: string
    body: string
    endsAt: string
    pauseTrading: boolean
}

export interface AdminMaintenancePanelProps {
    // A manutenção em aberto (no ar ou agendada), se houver; só existe uma por vez.
    open: AdminAnnouncement | null
    busy: boolean
    onStart: (values: MaintenanceFormValues) => void
    onEnd: (announcement: AdminAnnouncement) => void
}
