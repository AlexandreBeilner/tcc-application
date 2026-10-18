import { describe, expect, it } from 'vitest'
import { applyProblemFirstOps, PROBLEM_FIRST_OPS } from './applyProblemFirst'
import { applyWidgetGoals } from './widgetGoalsMigration'
import { LESSON_SEEDS } from './seedLessons'

const text = (markup: string) => ({ type: 'text', markup })

describe('applyProblemFirstOps', () => {
  it('troca o texto só quando ele está exatamente como no seed antigo, e é idempotente', () => {
    const op = { op: 'replaceMarkup', phase: 'scenario', from: 'velho', to: 'novo' } as const
    const first = applyProblemFirstOps({ phases: { scenario: [text('velho'), text('outro')] } }, [
      op,
    ])
    expect(first.changed).toBe(1)
    expect(first.blocks.phases?.scenario).toEqual([text('novo'), text('outro')])
    expect(applyProblemFirstOps(first.blocks, [op]).changed).toBe(0)
    // Texto que o painel já editou não casa e fica como está.
    expect(
      applyProblemFirstOps({ phases: { scenario: [text('velho editado')] } }, [op]).changed,
    ).toBe(0)
  })

  it('tira o widget da fase e troca prop de widget', () => {
    const widget = { type: 'widget', id: 'w', widget: 'formula-walkthrough', props: { intro: 'a' } }
    const removed = applyProblemFirstOps({ phases: { revelation: [widget] } }, [
      { op: 'removeWidget', phase: 'revelation', id: 'w' },
    ])
    expect(removed.blocks.phases?.revelation).toEqual([])
    const swapped = applyProblemFirstOps({ phases: { revelation: [widget] } }, [
      { op: 'replaceProp', phase: 'revelation', id: 'w', prop: 'intro', from: 'a', to: 'b' },
    ])
    expect((swapped.blocks.phases?.revelation?.[0].props as { intro: string }).intro).toBe('b')
  })
})

// O estado do banco antes da LJ.3.3 é o seed da LJ.3.2: reconstituído aqui desfazendo as operações no seed novo.
describe('lições do seed com o problema primeiro (LJ.3.3)', () => {
  // Cartões por fase como o player os monta: texto se fatia por parágrafo, "Na plataforma" vira rodapé do
  // cartão anterior, o resto é um cartão por bloco.
  const cardsOf = (code: string) => {
    const phases = LESSON_SEEDS.find((l) => l.code === code)?.blocks?.phases
    if (!phases) return []
    return [phases.scenario, phases.microDecision, phases.revelation].map((list) =>
      list.reduce((total, block, i) => {
        if (block.type === 'text') return total + block.markup.split('\n\n').length
        if (block.type === 'widget' && block.widget === 'platform-note' && i > 0) return total
        return total + 1
      }, 0),
    )
  }

  it.each([
    // Cartões por fase (Cenário, Aposta, Revelação) antes da missão: o número total não cresce.
    ['0.2', 3, 2, 3],
    ['0.4', 2, 1, 5],
    ['0.6', 4, 1, 6],
  ])('%s mantém o total de cartões', (code, scenario, micro, revelation) => {
    expect(cardsOf(code)).toEqual([scenario, micro, revelation])
  })

  it('o widget com missão vem antes do texto que nomeia a regra', () => {
    const phasesOf = (code: string) => LESSON_SEEDS.find((l) => l.code === code)?.blocks?.phases
    const order = (
      list: { type: string; id?: string; markup?: string }[] | undefined,
      id: string,
      needle: string,
    ) => {
      const widgetAt = list?.findIndex((b) => b.id === id) ?? -1
      const textAt = list?.findIndex((b) => b.markup?.includes(needle)) ?? -1
      return widgetAt >= 0 && textAt >= 0 && widgetAt < textAt
    }
    expect(order(phasesOf('0.6')?.scenario, 'poupanca-vs-tesouro', 'O que você viu tem nome')).toBe(
      true,
    )
    expect(order(phasesOf('0.4')?.scenario, 'rendimento-real', 'O que você viu tem nome')).toBe(
      false,
    )
    // 0.4: o texto que nomeia está na Aposta, que vem depois do Cenário com o widget.
    expect(
      phasesOf('0.4')?.scenario.some((b) => b.type === 'widget' && b.id === 'rendimento-real'),
    ).toBe(true)
    expect(JSON.stringify(phasesOf('0.4')?.microDecision)).toContain('O que você viu tem nome')
    // 0.2: o widget está na Aposta e o texto que nomeia ("juros sobre juros") na Revelação.
    expect(
      phasesOf('0.2')?.microDecision.some((b) => b.type === 'widget' && b.id === 'calculadora'),
    ).toBe(true)
    expect(JSON.stringify(phasesOf('0.2')?.revelation)).toContain('O que você viu tem nome')
  })

  it('migrar o banco da LJ.3.2 leva ao seed novo (e uma segunda vez não muda nada)', () => {
    // Banco como a LJ.3.2 o deixou: seed novo com as operações desfeitas.
    const seed = (code: string) =>
      LESSON_SEEDS.find((l) => l.code === code)?.blocks as never as {
        phases: Record<
          string,
          {
            type: string
            id?: string
            markup?: string
            goal?: unknown
            props?: Record<string, unknown>
          }[]
        >
      }
    for (const code of ['0.4', '0.6']) {
      const now = structuredClone(seed(code))
      const old = structuredClone(now)
      const ops = PROBLEM_FIRST_OPS[code]
      for (const op of ops) {
        if (op.op === 'replaceMarkup') {
          const b = old.phases[op.phase].find((x) => x.markup === op.to)
          if (b) b.markup = op.from
        }
      }
      // Antes da LJ.3.3 o widget com missão ficava na Revelação, depois do primeiro bloco (0.4 com outro id).
      const moved = old.phases.scenario.findIndex((b) => b.type === 'widget' && b.goal)
      const [widget] = old.phases.scenario.splice(moved, 1)
      old.phases.revelation.splice(1, 0, {
        ...widget,
        id: code === '0.4' ? 'rendimento-real-8-6' : widget.id,
      })

      const first = applyProblemFirstOps(old, ops)
      const second = applyWidgetGoals(first.blocks, now)
      expect(second.blocks.phases).toEqual(now.phases)
      const again = applyWidgetGoals(applyProblemFirstOps(second.blocks, ops).blocks, now)
      expect(applyProblemFirstOps(second.blocks, ops).changed + again.changed).toBe(0)
    }
  })
})
