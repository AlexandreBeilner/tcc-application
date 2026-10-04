import { describe, expect, it } from 'vitest'
import { authed, sleep } from './support/http'
import { registerRandomUser } from './support/users'

interface LessonView {
  id: string
  status: 'completed' | 'available' | 'locked'
  sortOrder: number
  microDecisionOptions: string[] | null
  microDecisionSolved?: boolean
  microDecisionWrongOptions?: number[]
}

// Jornada de lição com a pergunta que só avança ao acertar (RC.2.3/RC.2.4,
// .docs/backend/lessons.md): erra, tenta de novo, acerta, avança; sem acertar
// o gate devolve 422; reabrir a lição concluída e responder de novo não muda
// XP, streak nem progresso; `selectedOption` antigo em `/progress` é ignorado.
describe('jornada: lição com pergunta que só avança ao acertar', () => {
  it('errar não avança, acertar libera, e a revisão não altera o progresso', async () => {
    const user = await registerRandomUser()
    const http = authed(user.token)

    const list = await http.get('/lessons')
    expect(list.status).toBe(200)
    const lessons = (list.body.lessons as LessonView[]).sort((a, b) => a.sortOrder - b.sortOrder)
    const target = lessons.find(
      (l) => l.status === 'available' && (l.microDecisionOptions?.length ?? 0) > 1,
    )
    if (!target) {
      throw new Error('nenhuma lição disponível com pergunta de alternativas pra jornada')
    }
    const options = target.microDecisionOptions as string[]

    // Antes de sair do Cenário não há linha de progresso: a pergunta ainda não pode ser respondida.
    const early = await http.post(`/lessons/${target.id}/answer`).send({ selectedOption: 0 })
    expect(early.status).toBe(422)
    expect(early.body.code).toBe('step_out_of_order')

    // `selectedOption` antigo em /progress é aceito e ignorado: não grava nem devolve veredito.
    const toStep1 = await http
      .post(`/lessons/${target.id}/progress`)
      .send({ step: 1, selectedOption: 0 })
    expect(toStep1.status).toBe(200)
    expect(toStep1.body.microDecisionCorrect).toBeUndefined()
    expect(toStep1.body.correctOptionLabel).toBeUndefined()

    // Responde em ordem até acertar; todo erro fica sem gabarito e sem avançar.
    const wrong: number[] = []
    let solvedOption = -1
    for (let option = 0; option < options.length; option++) {
      const res = await http.post(`/lessons/${target.id}/answer`).send({ selectedOption: option })
      expect(res.status).toBe(200)
      if (res.body.correct) {
        solvedOption = option
        expect(res.body.correctOptionLabel).toBe(options[option])
        expect(res.body.firstTry).toBe(wrong.length === 0)
        break
      }
      wrong.push(option)
      expect(res.body.correctOptionLabel).toBeUndefined()
      expect(res.body.wrongOptions).toContain(option)

      const blocked = await http.post(`/lessons/${target.id}/progress`).send({ step: 2 })
      expect(blocked.status).toBe(422)
      expect(blocked.body.code).toBe('micro_decision_unsolved')
    }
    expect(solvedOption).toBeGreaterThanOrEqual(0)

    const reopened = await http.get(`/lessons/${target.id}`)
    expect(reopened.body.lesson.microDecisionSolved).toBe(true)
    expect(reopened.body.lesson.microDecisionWrongOptions).toEqual(wrong)
    expect(JSON.stringify(reopened.body)).not.toContain('microDecisionCorrectOption')

    // Respeita o intervalo mínimo entre passos (o 422 devolve quanto falta).
    for (const step of [2, 3]) {
      for (;;) {
        const res = await http.post(`/lessons/${target.id}/progress`).send({ step })
        if (res.status === 200) break
        if (res.status === 422 && res.body.code === 'step_too_fast') {
          await sleep((res.body.retryAfterMs as number) + 50)
          continue
        }
        throw new Error(
          `falha ao avançar pro passo ${step}: ${res.status} ${JSON.stringify(res.body)}`,
        )
      }
    }

    const progressionAfter = (await http.get('/me/progression')).body
    const listAfter = (await http.get('/lessons')).body.lessons as LessonView[]
    expect(listAfter.find((l) => l.id === target.id)?.status).toBe('completed')

    // Revisão: responder de novo (inclusive errado) e reenviar passos não grava nada.
    const again = await http
      .post(`/lessons/${target.id}/answer`)
      .send({ selectedOption: solvedOption })
    expect(again.status).toBe(200)
    expect(again.body.correct).toBe(true)
    const wrongAgain = await http
      .post(`/lessons/${target.id}/answer`)
      .send({ selectedOption: (solvedOption + 1) % options.length })
    expect(wrongAgain.status).toBe(200)
    const replay = await http.post(`/lessons/${target.id}/progress`).send({ step: 0 })
    expect(replay.status).toBe(200)
    expect(replay.body.completed).toBe(true)
    expect(replay.body.xpAwarded).toBeUndefined()

    const progressionReview = (await http.get('/me/progression')).body
    expect(progressionReview.xp).toBe(progressionAfter.xp)
    expect(progressionReview.currentStreak).toBe(progressionAfter.currentStreak)
    const afterReview = (await http.get(`/lessons/${target.id}`)).body.lesson
    expect(afterReview.currentStep).toBe(3)
    expect(afterReview.microDecisionWrongOptions).toEqual(wrong)
  }, 120_000)
})
