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
    // Governança das assembleias (MO.6.8): o motor aplica cada decisão com os valores do momento em que a recebe.
    governance_growth_step_centipp: {
        title: 'Faixa de efeito no crescimento',
        unit: 'centésimos de ponto percentual',
        effect: 'Mudança máxima do crescimento base de uma empresa por decisão (100 equivale a 1 ponto percentual). A intensidade de cada opção usa uma fração dessa faixa.',
    },
    governance_quality_step_centi: {
        title: 'Faixa de efeito na qualidade',
        unit: 'centésimos',
        effect: 'Mudança máxima do multiplicador de qualidade de uma empresa por decisão (5 equivale a 0,05). A intensidade de cada opção usa uma fração dessa faixa.',
    },
    governance_ramp_ticks: {
        title: 'Rampa do efeito',
        unit: 'ticks',
        effect: 'Em quantos ticks (dias do mercado) o efeito de uma decisão é aplicado, aos poucos, até fechar o total.',
    },
    governance_cooldown_days: {
        title: 'Intervalo entre mudanças da mesma empresa',
        unit: 'dias simulados',
        effect: 'Depois de uma decisão, a empresa fica esse tempo sem aceitar outra. Uma decisão em período de espera é registrada, mas nada muda.',
    },
    // Destinação do lucro (Fase F2): a assembleia decide payout, política de dividendo e prêmio da PN.
    governance_payout_step_centipp: {
        title: 'Faixa de efeito no payout',
        unit: 'centésimos de ponto percentual',
        effect: 'Mudança máxima do payout (a parte do lucro distribuída) por decisão (1000 equivale a 10 pontos percentuais). A intensidade de cada opção usa uma fração dessa faixa.',
    },
    governance_payout_min_pct: {
        title: 'Payout mínimo da empresa',
        unit: '%',
        effect: 'Piso do payout: uma decisão que levaria a empresa abaixo disso é registrada, mas nada muda.',
    },
    governance_payout_max_pct: {
        title: 'Payout máximo da empresa',
        unit: '%',
        effect: 'Teto do payout: uma decisão que levaria a empresa acima disso é registrada, mas nada muda. Mínimo maior que máximo faz toda decisão de payout ser ignorada.',
    },
    governance_payout_cooldown_days: {
        title: 'Intervalo entre mudanças de destinação do lucro',
        unit: 'dias simulados',
        effect: 'Payout, política de dividendo e prêmio da PN dividem este intervalo, separado do dos fundamentos. A empresa dentro dele paga o dividendo normal, sem esperar assembleia.',
    },
    governance_premium_step_centipp: {
        title: 'Faixa de efeito no prêmio da ação PN',
        unit: 'centésimos de ponto percentual',
        effect: 'Mudança máxima do dividendo extra da PN sobre a ON por decisão (500 equivale a 5 pontos percentuais).',
    },
    governance_premium_min_pct: {
        title: 'Prêmio mínimo da ação PN',
        unit: '%',
        effect: 'Piso do prêmio da PN. O piso legal é 10%: o motor não aceita menos que isso.',
    },
    governance_premium_max_pct: {
        title: 'Prêmio máximo da ação PN',
        unit: '%',
        effect: 'Teto do prêmio da PN: uma decisão que passaria disso é registrada, mas nada muda.',
    },
    governance_hold_declarations: {
        title: 'Reter o dividendo até a assembleia decidir',
        unit: '0 desligado, 1 ligado (padrão)',
        effect: 'Ligado, o dividendo do balanço de empresa com acionista fica retido até a assembleia de destinação do lucro decidir. Se desligar as assembleias em emergência, desligue este junto, senão o dividendo espera o prazo de segurança sem motivo.',
    },
    governance_declaration_safety_days: {
        title: 'Prazo de segurança do dividendo retido',
        unit: 'dias simulados',
        effect: 'Se nada liberar o dividendo retido nesse prazo, o motor o paga sozinho com o payout vigente. Precisa cobrir a votação inteira (por volta de 42 dias simulados no ritmo atual).',
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
