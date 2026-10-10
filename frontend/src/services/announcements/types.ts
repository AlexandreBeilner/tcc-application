export interface ActiveAnnouncement {
    id: string
    title: string
    body: string
    severity: 'info' | 'warning' | 'critical'
    kind: 'notice' | 'maintenance'
    dismissible: boolean
    starts_at: string
    ends_at: string | null
}
