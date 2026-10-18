import { eq } from 'drizzle-orm'
import { applyWidgetGoals } from './widgetGoalsMigration'
import { createDb } from './client'
import { lessons } from './schema'
import { LESSON_SEEDS } from './seedLessons'

// Migração de conteúdo aditiva (LJ.3.3): "problema primeiro" nas lições 0.2, 0.4 e 0.6. O seed já traz o
// widget com missão antes do texto que nomeia a regra, mas o seed nunca sobrescreve uma lição importada
// (N.23). Cada operação é cirúrgica e idempotente: só mexe se o bloco está exatamente como o seed antigo o
// deixou (texto editado pelo painel ou já migrado não casa e fica como está). Depois das operações,
// `applyWidgetGoals` coloca o widget com missão no lugar novo.
// Uso: DATABASE_URL=... npx tsx src/db/applyProblemFirst.ts

type Block = { type?: string; id?: string; markup?: string; props?: unknown } & Record<
  string,
  unknown
>
type Phases = Record<string, Block[] | undefined>
type Blocks = { phases?: Phases } & Record<string, unknown>

export type ProblemFirstOp =
  // Troca o texto de um bloco `text` por outro (casa pelo texto inteiro).
  | { op: 'replaceMarkup'; phase: string; from: string; to: string }
  // Tira um widget da fase (o `applyWidgetGoals` o reinsere no lugar novo, a partir do seed).
  | { op: 'removeWidget'; phase: string; id: string }
  // Troca um texto dentro de uma prop de widget (casa pelo texto inteiro da prop).
  | { op: 'replaceProp'; phase: string; id: string; prop: string; from: string; to: string }

export function applyProblemFirstOps(
  current: Blocks,
  ops: ProblemFirstOp[],
): { blocks: Blocks; changed: number } {
  let changed = 0
  const phases: Phases = {}
  for (const [phase, list] of Object.entries(current.phases ?? {}))
    phases[phase] = [...(list ?? [])]

  for (const op of ops) {
    const list = phases[op.phase]
    if (!list) continue
    if (op.op === 'replaceMarkup') {
      const at = list.findIndex((b) => b.type === 'text' && b.markup === op.from)
      if (at >= 0) {
        list[at] = { ...list[at], markup: op.to }
        changed += 1
      }
    } else if (op.op === 'removeWidget') {
      const at = list.findIndex((b) => b.type === 'widget' && b.id === op.id)
      if (at >= 0) {
        list.splice(at, 1)
        changed += 1
      }
    } else {
      const at = list.findIndex((b) => b.type === 'widget' && b.id === op.id)
      const props = at >= 0 ? (list[at].props as Record<string, unknown> | undefined) : undefined
      if (at >= 0 && props?.[op.prop] === op.from) {
        list[at] = { ...list[at], props: { ...props, [op.prop]: op.to } }
        changed += 1
      }
    }
  }
  return { blocks: { ...current, phases }, changed }
}

// Por `code` da lição (a poupança tem `stableKey` '0.5' e `code` 0.6: o `code` é o que o leitor reconhece).
export const PROBLEM_FIRST_OPS: Record<string, ProblemFirstOp[]> = {
  '0.2': [
    {
      op: 'replaceMarkup',
      phase: 'microDecision',
      from: 'Use a calculadora com o mesmo capital e o mesmo aporte mensal, alternando entre os modos Simples e Composto. Compare o total ao final do período antes de continuar.',
      to: 'Os mesmos R$ 1.000 a 10% ao ano rendem de um jeito nos juros simples e de outro nos compostos. Mexa no prazo da calculadora e alterne entre Simples e Composto para ver quando a diferença fica grande.',
    },
    {
      op: 'replaceProp',
      phase: 'revelation',
      id: 'conta-simples-composto',
      prop: 'intro',
      from: 'R$ 1.000 a 10% ao ano, por 3 anos. A taxa é a mesma, e o resultado muda.',
      to: 'O que você viu tem nome: juros sobre juros. R$ 1.000 a 10% ao ano, por 3 anos. A taxa é a mesma, e o resultado muda.',
    },
  ],
  '0.4': [
    {
      op: 'replaceMarkup',
      phase: 'scenario',
      from: 'Uma aplicação rendeu 8% em um ano. Parece um bom retorno. Mas, nesse ano, a {{inflação}} medida pelo {{IPCA}} foi de 6%.\n\nOs 8% são o rendimento nominal, o que a aplicação anuncia. O rendimento real é o que sobra depois de descontar a inflação.',
      to: 'Uma aplicação rendeu 8% em um ano. Parece um bom retorno. Mas, nesse ano, a {{inflação}} medida pelo {{IPCA}} foi de 6%.',
    },
    {
      op: 'replaceMarkup',
      phase: 'microDecision',
      from: 'Com 8% de rendimento nominal e 6% de inflação, o rendimento real fica perto de quanto?',
      to: 'O que você viu tem nome: rendimento real é o que sobra do rendimento nominal, o que a aplicação anuncia, depois de descontar a inflação. Com 8% nominal e 6% de inflação, o rendimento real fica perto de quanto?',
    },
    // Widget que a LJ.3.2 pôs na Revelação, com outro id: sai para o `rendimento-real` do Cenário.
    { op: 'removeWidget', phase: 'revelation', id: 'rendimento-real-8-6' },
  ],
  '0.6': [
    { op: 'removeWidget', phase: 'revelation', id: 'poupanca-vs-tesouro' },
    {
      op: 'replaceMarkup',
      phase: 'scenario',
      from: 'A regra de rendimento depende da meta da {{Selic}}. Acima de 8,5% ao ano, ela rende 0,5% ao mês mais a {{TR}}. Com a meta em 8,5% ou menos, rende 70% da meta ao ano, mais a TR.',
      to: 'O que você viu tem nome: a regra de rendimento da poupança, que depende da meta da {{Selic}}. Acima de 8,5% ao ano, ela rende 0,5% ao mês mais a {{TR}}. Com a meta em 8,5% ou menos, rende 70% da meta ao ano, mais a TR.',
    },
  ],
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('defina DATABASE_URL antes de rodar')
    process.exit(1)
  }
  const db = createDb(databaseUrl)
  for (const [code, ops] of Object.entries(PROBLEM_FIRST_OPS)) {
    const seed = LESSON_SEEDS.find((l) => l.code === code)
    if (!seed?.blocks) continue
    const [row] = await db.select().from(lessons).where(eq(lessons.stableKey, seed.stableKey))
    if (!row?.blocks) continue
    const first = applyProblemFirstOps(row.blocks as Blocks, ops)
    const second = applyWidgetGoals(first.blocks, seed.blocks as { phases?: Phases })
    const changed = first.changed + second.changed
    if (changed === 0) continue
    await db
      .update(lessons)
      .set({ blocks: second.blocks as typeof row.blocks })
      .where(eq(lessons.id, row.id))
    console.log(`lição ${seed.code}: ${changed} alteração(ões) de "problema primeiro"`)
  }
  process.exit(0)
}

if (process.env.VITEST === undefined) {
  main().catch((err) => {
    console.error('erro ao aplicar "problema primeiro":', err)
    process.exit(1)
  })
}
