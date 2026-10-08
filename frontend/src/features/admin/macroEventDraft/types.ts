import type { MacroEventDirection, MacroEventMagnitudeBand } from '../../../services/admin'

export type MacroEventTargetKind = 'sector' | 'risk_class' | 'asset'

// `id` só existe pro React (`key`/remoção de linha) — nunca enviado ao
// backend, que só conhece `kind`/`value` (traduzidos pra `sector`/
// `risk_class`/`asset_id` em `buildTriggerMacroEventInput`).
export interface MacroEventTargetDraft {
    id: string
    kind: MacroEventTargetKind
    value: string
}

// Estado de formulário da tela 10.2 — `mode` é o toggle "usar template" vs.
// "evento avulso" (backlog 6.11: um formulário só, não dois visualmente
// distintos). Os campos de evento avulso (title/narrative/direction/
// magnitudeBand/affectsPrice/affectsFundamentals) sempre existem no
// estado, mas só são obrigatórios/enviados quando `mode === 'adhoc'`.
export interface MacroEventDraft {
    mode: 'template' | 'adhoc'
    templateKey: string
    title: string
    narrative: string
    direction: MacroEventDirection
    magnitudeBand: MacroEventMagnitudeBand
    affectsPrice: boolean
    affectsFundamentals: boolean
    targets: MacroEventTargetDraft[]
    // Dia simulado em que o efeito começa (N.11); vazio dispara já.
    applyOnDay: string
    // Antecedência com que o jogador vê o evento agendado (N.25); vazio usa a véspera. Só vale com `applyOnDay`.
    revealLeadDays: string
}
