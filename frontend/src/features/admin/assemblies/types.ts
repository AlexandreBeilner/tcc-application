export interface OptionDraft {
    key: string
    label: string
    gain: string
    loss: string
    metric: string
    direction: '1' | '-1'
    // Texto digitado (vírgula ou ponto); só vira número ao salvar.
    intensity: string
}

export interface TemplateDraft {
    key: string
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
