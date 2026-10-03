import { Activity, Bot, CandlestickChart, Clock, FileText, LayoutDashboard, ScrollText, Trophy, Users } from 'lucide-react'
import type { AdminSection } from './types'

export type { AdminSection } from './types'

// Seções do painel admin (Fase N, tarefa N.3) na ordem fixa do backlog.
// Cada tarefa seguinte só precisa preencher `to` da sua seção (e registrar a
// rota em `router.tsx`) pra ela deixar de aparecer como "Em breve". "Mercado"
// é o monitor ao vivo (N.8); o histórico de eventos macro (10.3) também pertence a ela.
export const ADMIN_SECTIONS: AdminSection[] = [
    { key: 'overview', label: 'Visão geral', Icon: LayoutDashboard, to: '/admin', end: true, task: 'N.5' },
    { key: 'time', label: 'Tempo', Icon: Clock, to: '/admin/tempo', task: 'N.6' },
    { key: 'market', label: 'Mercado', Icon: CandlestickChart, to: '/admin/mercado', alsoActiveOn: ['/admin/eventos'], task: 'N.8' },
    { key: 'bots', label: 'Bots', Icon: Bot, to: '/admin/bots', task: 'N.2' },
    { key: 'users', label: 'Usuários', Icon: Users, task: 'N.16' },
    { key: 'content', label: 'Conteúdo', Icon: FileText, task: 'N.18' },
    { key: 'gamification', label: 'Gamificação', Icon: Trophy, task: 'N.19' },
    { key: 'system', label: 'Sistema', Icon: Activity, task: 'N.20' },
    { key: 'audit', label: 'Auditoria', Icon: ScrollText, to: '/admin/auditoria', task: 'N.4' },
]

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`)

// Seção ativa na rota atual: a própria rota (e sub-rotas, salvo `end`) ou uma das
// rotas extras que ela reivindica em `alsoActiveOn`.
export function isSectionActive(section: AdminSection, pathname: string): boolean {
    if (section.to === undefined) return false
    const own = section.end ? pathname === section.to : under(pathname, section.to)
    return own || (section.alsoActiveOn ?? []).some((base) => under(pathname, base))
}
