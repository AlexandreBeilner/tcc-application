// Lógica pura do enxugamento de cartões (ponto 057, opção d): tira o cartão final "Completar esta lição
// libera..." (a tela final já mostra o mesmo, pelo `unlocksDescription`) e funde dois cartões de texto curtos
// vizinhos da 2.10. Fica fora de `applyTrimCards.ts` para o teste importá-la sem disparar o `main` dele.
import type { Block, Blocks, Phases } from './widgetGoalsMigration'

type Text = Block & { markup?: string }

export const CLOSING_CARDS = [
  'Completar esta lição libera a compra do CDB2027 no Mercado.',
  'Completar esta lição libera a compra de LCI e LCA no Mercado.',
  'Completar esta lição libera a compra do Tesouro Selic no Mercado.',
  'Completar esta lição libera a compra do Tesouro Prefixado no Mercado.',
  'Completar esta lição libera a compra do Tesouro IPCA+ no Mercado.',
  'Completar esta lição libera a compra de CRI e CRA no Mercado e abre a Trilha 2.',
]

// Cada fusão vale só para dois blocos de texto seguidos, com exatamente estes textos.
export const MERGES: { first: string; second: string }[] = [
  {
    first:
      'O FII distribui rendimentos aos cotistas, em geral todo mês. A lei exige distribuir pelo menos 95% do lucro apurado em regime de caixa, com balanço semestral. Pagar todo mês é prática de mercado.',
    second: 'No FII o nome é rendimento, ou provento. Dividendo é o termo das ações.',
  },
  {
    first:
      'Para pessoa física, o rendimento do FII é isento de IR quando o fundo tem pelo menos 100 cotistas, as cotas são negociadas em bolsa e você tem menos de 10% delas.',
    second:
      'Já o ganho ao vender a cota é tributado. E a isenção de vendas no mês vale só para ações, não para FII.',
  },
]

const isText = (b: Block | undefined, markup: string) =>
  b?.type === 'text' && (b as Text).markup === markup

export function trimCards(current: Blocks): { blocks: Blocks; changed: number } {
  let changed = 0
  const phases: Phases = {}
  for (const [phase, list] of Object.entries(current.phases ?? {})) {
    let blocks = [...(list ?? [])]
    const kept = blocks.filter((b) => !CLOSING_CARDS.some((text) => isText(b, text)))
    changed += blocks.length - kept.length
    blocks = kept
    for (const { first, second } of MERGES) {
      const at = blocks.findIndex((b, i) => isText(b, first) && isText(blocks[i + 1], second))
      if (at < 0) continue
      blocks.splice(at, 2, { ...blocks[at], markup: `${first} ${second}` })
      changed += 1
    }
    phases[phase] = blocks
  }
  return { blocks: { ...current, phases }, changed }
}
