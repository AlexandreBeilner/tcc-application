import { ApiError } from '../../../services/client'
import type { IntegrityKind, IntegrityRun } from '../../../services/admin'

// Ordem e rótulo de cada categoria que o motor confere (N.21). Todas aparecem na tela, com zero
// quando limpas: "nenhuma divergência" é uma informação, não uma ausência.
export const INTEGRITY_KINDS: Array<{ kind: IntegrityKind; label: string; hint: string }> = [
    { kind: 'balance_mismatch', label: 'Saldo difere dos eventos', hint: 'O saldo da conta não bate com o reconstruído de market_events.' },
    {
        kind: 'position_mismatch',
        label: 'Posição difere dos eventos',
        hint: 'A quantidade em carteira não bate com a reconstruída dos eventos.',
    },
    { kind: 'negative_balance', label: 'Saldo negativo', hint: 'Conta com saldo abaixo de zero.' },
    { kind: 'negative_position', label: 'Posição negativa', hint: 'Posição com quantidade abaixo de zero.' },
    {
        kind: 'float_mismatch',
        label: 'Float difere das posições',
        hint: 'A soma das posições de um ativo não bate com as cotas em circulação.',
    },
    {
        kind: 'resting_order_unfunded',
        label: 'Ordem em repouso sem fundos',
        hint: 'Ordem em aberto que o dono, sozinho, não tem caixa ou posição para honrar.',
    },
    {
        kind: 'unknown_event_type',
        label: 'Evento de tipo desconhecido',
        hint: 'Tipo de evento que a verificação ainda não sabe reconstruir.',
    },
]

export const INTEGRITY_KIND_LABELS = Object.fromEntries(INTEGRITY_KINDS.map((k) => [k.kind, k.label])) as Record<IntegrityKind, string>

// Ainda há verificação rodando: o painel consulta de novo em poucos segundos.
export function isRunning(run: IntegrityRun | null | undefined): boolean {
    return run?.status === 'running'
}

// Valores monetários vêm do motor em reais com ponto ("9900.00"); a divergência de saldo e a de
// ordem usam essa forma, as de quantidade são inteiros em texto. Mostra com vírgula e símbolo
// só quando é dinheiro (a categoria diz).
const MONEY_KINDS: IntegrityKind[] = ['balance_mismatch', 'negative_balance', 'resting_order_unfunded']

export function formatDivergenceValue(kind: IntegrityKind, value: string): string {
    if (!MONEY_KINDS.includes(kind) || !/^-?\d+(\.\d+)?$/.test(value)) return value
    const number = Number(value)
    return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function describeIntegrityError(err: unknown): string {
    if (err instanceof ApiError && err.status === 409) return 'Já existe uma verificação em andamento. Aguarde terminar.'
    return 'Não foi possível falar com o motor agora. Tente novamente em instantes.'
}
