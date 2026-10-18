// Ajustes de clareza no enunciado de perguntas e missões já importadas (2026-10-18): a estimativa da 0.2 não
// dizia se era juro simples ou composto (e outras três tinham a mesma lacuna), e cada missão de widget passa
// a nomear o controle que a pessoa deve mexer. O seed já traz o texto novo, mas nunca sobrescreve uma lição
// importada (N.23). Cada troca casa o bloco por `id` e só age se o campo ainda for exatamente `from`: texto
// editado pelo painel, ou já trocado, fica como está.

export type ClarityField = 'goal.text' | 'prompt' | 'explanation' | `right.${number}`

export interface ClarityFix {
  id: string
  field: ClarityField
  from: string
  to: string
}

export const CLARITY_FIXES: ClarityFix[] = [
  {
    id: 'chute-20-anos',
    field: 'prompt',
    from: 'Chute: quanto viram os R$ 1.000 depois de 20 anos a 10% ao ano?',
    to: 'Chute: com juros compostos, em que os juros também rendem, quanto viram os R$ 1.000 depois de 20 anos a 10% ao ano?',
  },
  {
    id: 'chute-preco-10-anos',
    field: 'prompt',
    from: 'Chute: com inflação de 5% ao ano, quanto custará em 10 anos o que hoje custa R$ 100?',
    to: 'Chute: com inflação de 5% ao ano, sempre sobre o preço já reajustado, quanto custará em 10 anos o que hoje custa R$ 100?',
  },
  {
    id: 'chute-divida-12-meses',
    field: 'prompt',
    from: 'Chute: você deve R$ 1.000 a 15% ao mês e não paga nada. Quanto deve depois de 12 meses?',
    to: 'Chute: você deve R$ 1.000 a 15% ao mês, os juros são somados à dívida todo mês e você não paga nada. Quanto deve depois de 12 meses?',
  },
  {
    id: 'chute-taxa-30-anos',
    field: 'prompt',
    from: 'R$ 10.000 a 10% ao ano por 30 anos viram cerca de R$ 174 mil. Chute: quanto uma taxa de 2% ao ano leva desse saldo?',
    to: 'R$ 10.000 a 10% ao ano por 30 anos viram cerca de R$ 174 mil. Chute: se o produto cobrar uma taxa de 2% ao ano, quanto o saldo final fica menor?',
  },
  {
    id: 'finais-do-ticker',
    field: 'right.2',
    from: 'Fundo ou ETF, não uma ação simples',
    to: 'Fundo, ETF ou unit (um pacote de ações), não uma ação simples',
  },
  {
    id: 'finais-do-ticker',
    field: 'explanation',
    from: 'O 3 marca a ação ordinária e o 4, a preferencial. O 11 abrange fundos e ETFs: as ações simples terminam em 3 ou em 4.',
    to: 'O 3 marca a ação ordinária e o 4, a preferencial. O 11 costuma marcar fundos, ETFs e units, que são pacotes de ações. As ações simples mais comuns terminam em 3 ou em 4.',
  },
  {
    id: 'calculadora',
    field: 'goal.text',
    from: 'Ache o prazo em que os juros compostos passam do dobro dos juros simples',
    to: 'Mexa no Período e ache o prazo em que os juros compostos passam do dobro dos juros simples',
  },
  {
    id: 'rendimento-real',
    field: 'goal.text',
    from: 'Faça a inflação passar o rendimento',
    to: 'Aumente a Inflação até ela passar o Rendimento nominal',
  },
  {
    id: 'juro-real',
    field: 'goal.text',
    from: 'Ache a inflação em que o juro real zera',
    to: 'Mexa na Inflação e ache o valor em que o juro real zera',
  },
  {
    id: 'poupanca-vs-tesouro',
    field: 'goal.text',
    from: 'Ache a Selic em que a poupança e o Tesouro Selic rendem quase igual',
    to: 'Mexa na Meta da Selic e ache o valor em que a poupança e o Tesouro Selic rendem quase igual',
  },
  {
    id: 'barra-fgc',
    field: 'goal.text',
    from: 'Distribua os R$ 600 mil sem deixar nada fora da cobertura',
    to: 'Mexa em Instituições que quebram em 4 anos e divida os R$ 600 mil sem deixar nada fora da cobertura',
  },
  {
    id: 'tabela-ir',
    field: 'goal.text',
    from: 'Ache o prazo em que a alíquota chega à menor da tabela',
    to: 'Mexa no Prazo da aplicação e ache o prazo em que a alíquota chega à menor da tabela',
  },
  {
    id: 'taxa-equivalente',
    field: 'goal.text',
    from: 'Ache a taxa do CDB que rende o mesmo que a LCI depois do imposto',
    to: 'Mexa na Taxa do CDB e ache a taxa que rende o mesmo que a LCI depois do imposto',
  },
  {
    id: 'calculadora-reserva',
    field: 'goal.text',
    from: 'Chegue ao menor valor da meta em até 12 meses',
    to: 'Mexa em Quanto você consegue guardar por mês e ache o aporte que junta o menor valor da faixa de reserva em até 12 meses',
  },
  {
    id: 'preco-prefixado',
    field: 'goal.text',
    from: 'Faça cada título custar menos de R$ 800 hoje',
    to: 'Mexa na Taxa contratada e no Prazo até cada título custar menos de R$ 800 hoje',
  },
  {
    id: 'gangorra-marcacao',
    field: 'goal.text',
    from: 'Faça o seu título perder mais de 5% do valor antes do vencimento',
    to: 'Suba a Taxa de mercado até o seu título perder mais de 5% do valor antes do vencimento',
  },
  {
    id: 'inflacao-de-equilibrio',
    field: 'goal.text',
    from: 'Ache a inflação esperada em que o IPCA+ passa a render mais que o prefixado',
    to: 'Mexa na Inflação que você espera e ache o valor em que o IPCA+ passa a render mais que o prefixado',
  },
  {
    id: 'livro-de-ofertas',
    field: 'goal.text',
    from: 'Envie uma ordem limitada de compra e faça com que ela seja executada',
    to: 'Escolha Comprar e Limitada, use Enviar ordem e faça com que ela seja executada. Se ficar na fila, mexa no mercado',
  },
  {
    id: 'balanco-interativo',
    field: 'goal.text',
    from: 'Deixe o lucro líquido positivo mexendo só nos custos',
    to: 'Mexa só em Custos e deixe o lucro líquido positivo',
  },
  {
    id: 'laboratorio-de-roe',
    field: 'goal.text',
    from: 'Leve o ROE acima da Selic de referência sem mexer na Selic',
    to: 'Mexa em Parte do ativo financiada por dívida e leve o ROE acima da Selic de referência, sem mexer na Selic',
  },
  {
    id: 'efeito-da-taxa',
    field: 'goal.text',
    from: 'Com 30 anos de prazo, ache a taxa do produto B que já leva R$ 10 mil do saldo',
    to: 'Mexa na Taxa do produto B e ache a taxa que, com 30 anos de prazo, já leva R$ 10 mil do saldo',
  },
  {
    id: 'pesos-da-carteira',
    field: 'goal.text',
    from: 'Monte uma carteira em que nenhuma fatia chegue a 40% e a soma feche em 100%',
    to: 'Mexa nos controles de cada classe e monte uma carteira em que nenhuma fatia chegue a 40% e a soma feche em 100%',
  },
  {
    id: 'monte-seu-orcamento',
    field: 'goal.text',
    from: 'Feche o mês com 10% da renda de sobra',
    to: 'Mexa nos gastos (Moradia, Alimentação, Transporte, Lazer, Dívidas e Outros) e feche o mês com 10% da renda de sobra',
  },
  {
    id: 'simulador-de-divida',
    field: 'goal.text',
    from: 'Quite a dívida em menos de 12 meses',
    to: 'Mexa em Pagamento por mês e quite a dívida em menos de 12 meses',
  },
]

type Block = Record<string, unknown> & { id?: string; blocks?: Block[] }
export type Blocks = { phases?: Record<string, Block[] | undefined> } & Record<string, unknown>

function readField(block: Block, field: ClarityField): string | undefined {
  if (field === 'goal.text') return (block.goal as { text?: string } | undefined)?.text
  if (field.startsWith('right.')) {
    return (block.right as string[] | undefined)?.[Number(field.slice('right.'.length))]
  }
  const value = block[field]
  return typeof value === 'string' ? value : undefined
}

function writeField(block: Block, field: ClarityField, value: string): Block {
  if (field === 'goal.text') return { ...block, goal: { ...(block.goal as object), text: value } }
  if (field.startsWith('right.')) {
    const right = [...((block.right as string[] | undefined) ?? [])]
    right[Number(field.slice('right.'.length))] = value
    return { ...block, right }
  }
  return { ...block, [field]: value }
}

function fixList(list: Block[], fixes: ClarityFix[], hits: { count: number }): Block[] {
  return list.map((block) => {
    let next = block
    for (const fix of fixes) {
      if (next.id === fix.id && readField(next, fix.field) === fix.from) {
        next = writeField(next, fix.field, fix.to)
        hits.count += 1
      }
    }
    // Blocos "Saiba mais" guardam outros blocos dentro.
    if (Array.isArray(next.blocks)) next = { ...next, blocks: fixList(next.blocks, fixes, hits) }
    return next
  })
}

export function applyClarityFixes(
  blocks: Blocks,
  fixes: ClarityFix[] = CLARITY_FIXES,
): { blocks: Blocks; changes: number } {
  const hits = { count: 0 }
  const phases: Record<string, Block[] | undefined> = {}
  for (const [phase, list] of Object.entries(blocks.phases ?? {})) {
    phases[phase] = fixList(list ?? [], fixes, hits)
  }
  return { blocks: { ...blocks, phases }, changes: hits.count }
}
