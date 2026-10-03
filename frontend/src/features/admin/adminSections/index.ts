import { Activity, Bot, CandlestickChart, Clock, FileText, LayoutDashboard, ScrollText, Trophy, Users } from 'lucide-react'
import type { AdminSection } from './types'

export type { AdminSection } from './types'

// Seções do painel admin (Fase N, tarefa N.3) na ordem fixa do backlog.
// Cada tarefa seguinte só precisa preencher `to` da sua seção (e registrar a
// rota em `router.tsx`) pra ela deixar de aparecer como "Em breve". "Mercado"
// aponta pro histórico de eventos macro, única tela dela até a N.8/N.11.
export const ADMIN_SECTIONS: AdminSection[] = [
    { key: 'overview', label: 'Visão geral', Icon: LayoutDashboard, to: '/admin', end: true, task: 'N.5' },
    { key: 'time', label: 'Tempo', Icon: Clock, to: '/admin/tempo', task: 'N.6' },
    { key: 'market', label: 'Mercado', Icon: CandlestickChart, to: '/admin/eventos', task: 'N.8' },
    { key: 'bots', label: 'Bots', Icon: Bot, task: 'N.2' },
    { key: 'users', label: 'Usuários', Icon: Users, task: 'N.16' },
    { key: 'content', label: 'Conteúdo', Icon: FileText, task: 'N.18' },
    { key: 'gamification', label: 'Gamificação', Icon: Trophy, task: 'N.19' },
    { key: 'system', label: 'Sistema', Icon: Activity, task: 'N.20' },
    { key: 'audit', label: 'Auditoria', Icon: ScrollText, to: '/admin/auditoria', task: 'N.4' },
]
