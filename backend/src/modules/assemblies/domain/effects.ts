// Efeitos de uma opção de pauta (MO.6.10 a MO.6.13). Uma opção tem de 1 a 2 efeitos, em alavancas
// diferentes: crescimento, qualidade, payout (a fração do lucro distribuída), prêmio da ação PN
// sobre a ON (em degraus) e política de dividendo (trimestral, semestral ou anual, um valor-alvo).
// O catálogo nunca carrega valor absoluto de degrau: só alavanca, sentido e que fração da faixa do
// motor usar (o tamanho final é do motor). A política é discreta e traz o valor-alvo.
//
// Formato guardado em `effect` (jsonb): `{ effects: [...] }`. O formato antigo, um objeto único
// `{ metric, direction, intensity }`, continua legível (pautas anteriores à Fase F2).

export const STEP_METRICS = [
  'base_growth_pct',
  'quality_multiplier',
  'payout_ratio_pct',
  'pn_dividend_premium_pct',
] as const
export type StepMetric = (typeof STEP_METRICS)[number]

export const DIVIDEND_POLICIES = ['quarterly', 'semiannual', 'annual'] as const
export type DividendPolicy = (typeof DIVIDEND_POLICIES)[number]

export const MAX_EFFECTS_PER_OPTION = 2

export type OptionEffect =
  | { metric: StepMetric; direction: 1 | -1; intensity: number }
  | { metric: 'dividend_policy'; value: DividendPolicy }

// Alavancas que decidem o destino do lucro: só elas, e não crescimento nem qualidade, sentem a
// retenção da declaração de dividendo (a decisão libera o dividendo depois de aplicadas).
export const PROFIT_METRICS = ['payout_ratio_pct', 'pn_dividend_premium_pct', 'dividend_policy']

function readOne(raw: unknown): OptionEffect | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { metric, direction, intensity, value } = raw as Record<string, unknown>
  if (metric === 'dividend_policy') {
    return (DIVIDEND_POLICIES as readonly unknown[]).includes(value)
      ? { metric, value: value as DividendPolicy }
      : null
  }
  if (!(STEP_METRICS as readonly unknown[]).includes(metric)) return null
  if (direction !== 1 && direction !== -1) return null
  if (typeof intensity !== 'number' || !(intensity > 0 && intensity <= 1)) return null
  return { metric: metric as StepMetric, direction, intensity }
}

// Lê a lista de efeitos do `effect` jsonb (formato novo ou antigo). `null` se qualquer efeito for
// inválido, a lista estiver vazia, passar de 2 ou repetir a alavanca.
export function readOptionEffects(raw: Record<string, unknown>): OptionEffect[] | null {
  const items = Array.isArray(raw.effects) ? raw.effects : [raw]
  if (items.length < 1 || items.length > MAX_EFFECTS_PER_OPTION) return null
  const effects: OptionEffect[] = []
  for (const item of items) {
    const effect = readOne(item)
    if (!effect) return null
    effects.push(effect)
  }
  if (new Set(effects.map((e) => e.metric)).size !== effects.length) return null
  return effects
}

// Forma canônica para gravar: só os campos conhecidos de cada efeito, nunca sobra do que o painel
// enviou.
export function toStoredEffect(effects: readonly OptionEffect[]): Record<string, unknown> {
  return {
    effects: effects.map((e) =>
      e.metric === 'dividend_policy'
        ? { metric: e.metric, value: e.value }
        : { metric: e.metric, direction: e.direction, intensity: e.intensity },
    ),
  }
}

// Mensagem de recusa para o painel: diz o que está errado no `effect` de uma opção.
export function describeEffectProblem(raw: Record<string, unknown>): string {
  const items = Array.isArray(raw.effects) ? raw.effects : [raw]
  if (items.length < 1 || items.length > MAX_EFFECTS_PER_OPTION) {
    return `a opção precisa de 1 a ${MAX_EFFECTS_PER_OPTION} efeitos`
  }
  const bad = items.findIndex((item) => readOne(item) === null)
  if (bad >= 0) {
    return `o efeito ${bad + 1} precisa de alavanca válida (crescimento, qualidade, payout, prêmio da PN ou política de dividendo), com sentido (1 ou -1) e intensidade de 0 (exclusive) a 1, ou, na política, o valor trimestral, semestral ou anual`
  }
  return 'as alavancas dos efeitos de uma opção não podem se repetir'
}

// A opção mexe no destino do lucro? (payout, prêmio da PN ou política).
export function touchesProfit(effects: readonly OptionEffect[]): boolean {
  return effects.some((e) => PROFIT_METRICS.includes(e.metric))
}
