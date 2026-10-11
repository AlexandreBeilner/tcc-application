// Um efeito da opção. A política de dividendo usa `value` (valor-alvo); as demais alavancas usam
// sentido e intensidade.
export interface EffectDraft {
    metric: string
    direction: '1' | '-1'
    // Texto digitado (vírgula ou ponto); só vira número ao salvar.
    intensity: string
    // Valor-alvo da política de dividendo (trimestral, semestral ou anual).
    value: string
}

export interface OptionDraft {
    key: string
    label: string
    gain: string
    loss: string
    // De 1 a 2 efeitos, em alavancas diferentes.
    effects: EffectDraft[]
}

export interface TemplateDraft {
    key: string
    // `general` abre pelo balanço; `profit` só a partir do dividendo retido (destinação do lucro).
    purpose: 'general' | 'profit'
    sector: string
    title: string
    description: string
    options: OptionDraft[]
}

export interface SettingText {
    title: string
    unit: string
    effect: string
}
