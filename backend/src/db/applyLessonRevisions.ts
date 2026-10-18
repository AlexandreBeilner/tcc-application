import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'

// Migração de conteúdo única (2026-10-17): leva para o banco as revisões feitas no seed
// depois que as lições já tinham sido importadas (o seed nunca sobrescreve, N.23):
// 1. a fórmula com os números ao lado (`formula-walkthrough`) nas lições 0.2, 1.10 e 1.11;
// 2. perguntas que dependiam do valor vigente (meta de inflação, FGC, isenção, custódia,
//    retenção de dividendos) reescritas com a regra no enunciado;
// 3. o número de hoje tirado do texto e posto em cartões "Valores de hoje".
// Cada passo é idempotente e só age se encontrar exatamente o que espera: texto editado
// pelo painel continua como está. Uso: DATABASE_URL=... npx tsx src/db/applyLessonRevisions.ts

type Block = { type?: string; id?: string; markup?: string } & Record<string, unknown>
type Phases = Record<string, Block[] | undefined>
type Blocks = { phases?: Phases } & Record<string, unknown>

// Onde um bloco do seed entra: antes ou depois de um bloco com este id, ou depois do texto
// que contém este trecho.
type Anchor = { before: string } | { after: string } | { afterText: string }

export interface LessonRevision {
  code: string
  // Trocas exatas de trecho dentro dos blocos de texto.
  texts?: [string, string][]
  // Blocos de texto ou widget a remover: texto que contém o trecho, ou id do widget.
  removeTexts?: string[]
  removeIds?: string[]
  // Perguntas trocadas pela versão do seed, pelo id.
  checks?: string[]
  // Blocos do seed (pelo id) inseridos onde a âncora indicar, se ainda não existirem.
  inserts?: { id: string; at: Anchor }[]
}

export const REVISIONS: LessonRevision[] = [
  {
    code: '0.2',
    removeTexts: ['No regime simples, o montante cresce em linha reta'],
    removeIds: ['dica-tempo'],
    inserts: [{ id: 'conta-simples-composto', at: { before: 'renda-fixa-regime' } }],
  },
  {
    code: '0.3',
    texts: [
      [
        'O Banco Central persegue uma meta: 3% ao ano, com tolerância de 1,5 ponto para mais ou para menos.',
        'O Banco Central persegue uma meta de inflação e compara o IPCA com ela.',
      ],
    ],
    checks: ['meta-inflacao'],
    inserts: [{ id: 'hoje-meta-inflacao', at: { afterText: 'persegue uma meta de inflação' } }],
  },
  {
    code: '1.2',
    texts: [
      [
        'A B3 cobra 0,20% ao ano de custódia, mas no Tesouro Selic não cobra nada sobre os primeiros R$ 10 mil.',
        'A B3 cobra uma taxa anual de custódia, mas no Tesouro Selic ela não incide sobre os primeiros reais investidos.',
      ],
    ],
    checks: ['custodia-selic'],
    inserts: [
      { id: 'hoje-custodia-b3', at: { afterText: 'ela não incide sobre os primeiros reais' } },
    ],
  },
  {
    code: '1.4',
    texts: [
      [
        'Hoje a meta é de 3% ao ano, com tolerância de 1,5 ponto para cima e para baixo, medida pelo {{IPCA}} em 12 meses.',
        'A meta é um número com tolerância para cima e para baixo, definido pelo governo e medido pelo {{IPCA}} em 12 meses. Ela pode mudar com o tempo.',
      ],
    ],
    checks: ['inflacao-dentro-da-meta'],
  },
  {
    code: '1.5',
    texts: [
      [
        'O {{FGC}} protege até R$ 250 mil por CPF, por {{conglomerado financeiro}}. Além disso, o teto é de R$ 1 milhão por CPF a cada 4 anos.',
        'O {{FGC}} protege até um limite por CPF, por {{conglomerado financeiro}}, e há ainda um teto total por CPF a cada 4 anos.',
      ],
    ],
    checks: ['fgc-limite'],
    inserts: [{ id: 'hoje-fgc', at: { afterText: 'há ainda um teto total por CPF' } }],
  },
  {
    code: '1.8',
    texts: [['e a custódia da B3, de 0,20% ao ano.', 'e a custódia da B3.']],
  },
  {
    code: '1.10',
    texts: [
      [
        'A meta de inflação no Brasil é de 3% ao ano, com tolerância de 1,5 ponto para cima e para baixo. Compara-se a meta com o IPCA acumulado em 12 meses.',
        'Compara-se a meta de inflação, com a tolerância para cima e para baixo, com o IPCA acumulado em 12 meses.',
      ],
    ],
    removeTexts: ['O acumulado de 12 meses é o produto dos fatores mensais'],
    checks: ['ipca-fora-da-meta'],
    inserts: [{ id: 'conta-acumulado', at: { before: 'acumulado-doze-meses' } }],
  },
  {
    code: '1.11',
    removeTexts: ['Os dois efeitos se multiplicam: (1 + IPCA)'],
    inserts: [{ id: 'conta-ipca-mais', at: { before: 'simulador-ipca-mais' } }],
  },
  {
    code: '2.4',
    texts: [
      [
        'mas quem vende até R$ 20 mil em ações no mês tem o ganho isento.',
        'mas quem vende até o limite de isenção do mês em ações tem o ganho isento.',
      ],
    ],
    checks: ['isencao-vinte-mil'],
  },
  {
    code: '2.7.6',
    texts: [
      [
        'Em 2026, o dividendo só tem 10% retidos se o total pago por uma mesma empresa a você passar de R$ 50 mil no mês.',
        'O dividendo só tem retenção se o total pago por uma mesma empresa a você passar de um limite no mês.',
      ],
    ],
    checks: ['dividendo-abaixo-do-limite'],
  },
  {
    code: '2.7.7',
    texts: [
      [
        'Desde 2026, dividendos acima de R$ 50 mil no mês pagos por uma mesma empresa a uma pessoa física têm 10% retidos na fonte.',
        'Dividendos acima de um limite no mês, pagos por uma mesma empresa a uma pessoa física, têm parte retida na fonte.',
      ],
    ],
    checks: ['retencao-dividendos'],
  },
  {
    code: '2.9',
    texts: [
      [
        'e o ETF não tem a isenção de R$ 20 mil em vendas no mês, que vale só para ações.',
        'e o ETF não tem a isenção de vendas no mês, que vale só para ações.',
      ],
    ],
    checks: ['etf-sem-isencao'],
  },
  {
    code: '2.10',
    texts: [
      [
        'E a isenção de R$ 20 mil em vendas no mês vale só para ações, não para FII.',
        'E a isenção de vendas no mês vale só para ações, não para FII.',
      ],
    ],
    checks: ['venda-de-cotas'],
  },
  {
    code: '2.11',
    texts: [
      [
        'a B3 cobra custódia de 0,20% ao ano sobre o valor dos títulos.',
        'a B3 cobra uma custódia anual sobre o valor dos títulos.',
      ],
    ],
    checks: ['custodia-do-tesouro'],
  },
  {
    code: '2.12',
    texts: [
      [
        'Nada. Quem vende até R$ 20 mil em ações no mês tem o ganho isento',
        'Nada. Quem vende até o limite de isenção do mês em ações tem o ganho isento',
      ],
      [
        'Passou de R$ 20 mil? Todo o lucro do mês é tributado, não só o que passou do limite.',
        'Passou do limite? Todo o lucro do mês é tributado, não só o que passou do limite.',
      ],
      [
        'Os dividendos das ações também têm regra própria: desde 2026, a empresa retém 10% quando paga mais de R$ 50 mil no mês a uma mesma pessoa. Abaixo disso, não há retenção.',
        'Os dividendos das ações também têm regra própria: a empresa retém parte do imposto quando paga muito a uma mesma pessoa no mês. Abaixo desse limite, não há retenção.',
      ],
    ],
    // `isencao-so-acoes` virou o agrupar `isento-ou-tributado` (LJ.2.7, `applyGameChecks.ts`).
    checks: ['imposto-acima-do-limite', 'dividendo-limite'],
    inserts: [
      {
        id: 'hoje-isencao-dividendos',
        at: { afterText: 'retém parte do imposto quando paga muito' },
      },
    ],
  },
  {
    code: '3.1',
    texts: [
      [
        'O {{FGC}} cobre até R$ 250 mil por CPF, por instituição ou conglomerado, e o que passa disso fica sem a garantia.',
        'O {{FGC}} cobre até um limite por CPF, por instituição ou conglomerado, e o que passa disso fica sem a garantia.',
      ],
    ],
    checks: ['fgc-excedente'],
  },
  {
    code: '3.3',
    texts: [
      [
        'e a cobertura do FGC, que vale até R$ 250 mil por CPF e instituição.',
        'e a cobertura do FGC, que tem limite por CPF e instituição.',
      ],
    ],
  },
  {
    code: 'F.2',
    texts: [
      [
        'entra no {{rotativo}}. Em 2026, a média do Banco Central ficou perto de 15% ao mês, mais de 400% ao ano. Por lei, desde 2024 os juros',
        'entra no {{rotativo}}, uma das taxas mais altas do mercado. Por lei, os juros',
      ],
      [
        'também são caros: o cheque especial ficou perto de 7% ao mês em 2026. O {{consignado}}',
        'também são caros. O {{consignado}}',
      ],
    ],
    inserts: [
      { id: 'hoje-taxas-credito', at: { afterText: 'também são caros. O {{consignado}}' } },
    ],
  },
]

function seedBlockById(seed: Blocks, id: string): Block | undefined {
  return Object.values(seed.phases ?? {})
    .flatMap((list) => list ?? [])
    .find((block) => block.id === id)
}

// Comparação sem depender da ordem das chaves: o jsonb do Postgres as reordena.
export function sameBlock(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical((value as Record<string, unknown>)[key])]),
          )
        : value
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))
}

function matches(block: Block, anchor: Anchor): boolean {
  if ('before' in anchor) return block.id === anchor.before
  if ('after' in anchor) return block.id === anchor.after
  return block.type === 'text' && (block.markup ?? '').includes(anchor.afterText)
}

// Aplica uma revisão sobre os blocos atuais, usando o seed como fonte dos blocos novos.
// Devolve quantas mudanças fez (0 quando já estava aplicada).
export function applyRevision(
  current: Blocks,
  seed: Blocks,
  revision: LessonRevision,
): { blocks: Blocks; changes: number } {
  let changes = 0
  const phases: Phases = {}

  for (const [phase, list] of Object.entries(current.phases ?? {})) {
    let blocks = (list ?? []).map((block) => {
      if (block.type === 'text' && revision.texts) {
        let markup = block.markup ?? ''
        for (const [from, to] of revision.texts) {
          if (markup.includes(from)) {
            markup = markup.replace(from, to)
            changes += 1
          }
        }
        return markup === block.markup ? block : { ...block, markup }
      }
      if (block.type === 'check' && block.id && revision.checks?.includes(block.id)) {
        const fromSeed = seedBlockById(seed, block.id)
        if (fromSeed && !sameBlock(fromSeed, block)) {
          changes += 1
          return fromSeed
        }
      }
      return block
    })

    const before = blocks.length
    blocks = blocks.filter(
      (block) =>
        !(block.id && revision.removeIds?.includes(block.id)) &&
        !(
          block.type === 'text' &&
          revision.removeTexts?.some((part) => (block.markup ?? '').includes(part))
        ),
    )
    changes += before - blocks.length
    phases[phase] = blocks
  }

  for (const insert of revision.inserts ?? []) {
    const exists = Object.values(phases).some((list) => list?.some((b) => b.id === insert.id))
    const fromSeed = seedBlockById(seed, insert.id)
    if (exists || !fromSeed) continue
    for (const list of Object.values(phases)) {
      const index = list?.findIndex((block) => matches(block, insert.at)) ?? -1
      if (!list || index < 0) continue
      list.splice('before' in insert.at ? index : index + 1, 0, fromSeed)
      changes += 1
      break
    }
  }

  return { blocks: { ...current, phases }, changes }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const revision of REVISIONS) {
    const seed = LESSON_SEEDS.find((s) => s.code === revision.code)
    const [row] = await db.select().from(lessons).where(eq(lessons.code, revision.code))
    if (!seed?.blocks || !row?.blocks) {
      console.log(`lição ${revision.code}: não encontrada, ignorada`)
      continue
    }
    const { blocks, changes } = applyRevision(
      row.blocks as unknown as Blocks,
      seed.blocks as unknown as Blocks,
      revision,
    )
    if (changes === 0) {
      console.log(`lição ${revision.code}: já atualizada`)
      continue
    }
    await db
      .update(lessons)
      .set({ blocks: blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${revision.code}: ${changes} mudança(s)`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar as revisões:', err)
    process.exit(1)
  })
}
