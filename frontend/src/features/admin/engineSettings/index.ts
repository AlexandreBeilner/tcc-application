import { ApiError } from '../../../services/client'
import type { EditableSetting, EngineSettingKey } from '../../../services/admin'

interface SettingText {
    title: string
    unit: string
    effect: string
}

// Texto de cada parâmetro editável. Mudança só vale a partir da próxima tentativa do
// agendador (até 30 s) e nunca no meio de um tick.
export const EDITABLE_SETTING_TEXT: Record<EngineSettingKey, SettingText> = {
    ticks_per_day: {
        title: 'Dias simulados por dia real',
        unit: 'dias simulados',
        effect: 'Quantos ticks (dias do mercado) acontecem a cada dia real. Mais ticks, mercado mais rápido pra todos os usuários.',
    },
    max_catch_up: {
        title: 'Recuperação máxima depois de uma parada',
        unit: 'ticks',
        effect: 'Quantos ticks atrasados o motor recupera de uma vez ao voltar de uma parada. O excedente é descartado e registrado.',
    },
}

const READ_ONLY_TITLES: Record<string, string> = {
    simulation_seed: 'Semente da simulação',
    initial_capital: 'Capital inicial por conta',
    copom_interval_days: 'Intervalo entre reuniões do Copom',
    max_spread_width_pct: 'Teto de spread do bot',
    max_order_pct_of_volume: 'Teto de ordem do bot sobre o volume',
    max_advance_days: 'Teto de avançar dias',
    max_admin_cancel_batch: 'Teto do cancelamento em lote',
}

export function readOnlyTitle(key: string): string {
    return READ_ONLY_TITLES[key] ?? key
}

// Valida o texto digitado contra a faixa do parâmetro; devolve o inteiro ou a mensagem.
export function parseSettingInput(raw: string, setting: Pick<EditableSetting, 'min' | 'max'>): { value: number } | { error: string } {
    const trimmed = raw.trim()
    if (!/^\d+$/.test(trimmed)) return { error: 'Digite um número inteiro.' }
    const value = Number(trimmed)
    if (value < setting.min || value > setting.max) return { error: `Use um valor entre ${setting.min} e ${setting.max}.` }
    return { value }
}

// O motor devolve a faixa na mensagem do 422; as demais situações têm texto fixo.
export function describeSettingError(err: unknown): string {
    if (err instanceof ApiError) {
        if (err.status === 422) return `O motor recusou o valor: ${err.message}`
        if (err.status === 404) return 'Esse parâmetro não é editável.'
        if (err.status === 400) return 'Valor inválido.'
    }
    return 'Não foi possível salvar agora. Confira a auditoria antes de tentar de novo.'
}
