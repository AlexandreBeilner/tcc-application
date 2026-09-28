import { authed, sleep } from './http'

interface LessonSummary {
  id: string
  sortOrder: number
  status: 'completed' | 'available' | 'locked'
  unlocksKeys: string[]
}

async function listLessons(userToken: string): Promise<LessonSummary[]> {
  const res = await authed(userToken).get('/lessons')
  if (res.status !== 200) {
    throw new Error(`falha ao listar lições: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return (res.body.lessons as LessonSummary[]).sort((a, b) => a.sortOrder - b.sortOrder)
}

// Avança uma lição do passo 1 ao 3 (conclusão), respeitando o intervalo
// mínimo entre passos (`LESSON_MIN_STEP_INTERVAL_MS`, .docs/backend/lessons.md)
// — em vez de assumir o valor default (5000ms, pode ser outro no ambiente),
// espera exatamente o `retryAfterMs` que o próprio 422 devolve e tenta de
// novo, robusto a qualquer configuração.
async function advanceStep(userToken: string, lessonId: string, step: number): Promise<void> {
  for (;;) {
    const res = await authed(userToken).post(`/lessons/${lessonId}/progress`).send({ step })
    if (res.status === 200) {
      return
    }
    if (res.status === 422 && res.body.code === 'step_too_fast') {
      await sleep((res.body.retryAfterMs as number) + 50)
      continue
    }
    throw new Error(
      `falha ao avançar lição ${lessonId} pro passo ${step}: ${res.status} ${JSON.stringify(res.body)}`,
    )
  }
}

async function completeLesson(userToken: string, lessonId: string): Promise<void> {
  await advanceStep(userToken, lessonId, 1)
  await advanceStep(userToken, lessonId, 2)
  await advanceStep(userToken, lessonId, 3)
}

// Completa lições em ordem (`sortOrder`) até que alguma já concluída tenha
// `key` em `unlocksKeys` — mesmo mecanismo de gate real da tarefa 7.0.1
// (`ProductUnlockReader`/`unlockedKeysFor`, .docs/backend/lessons.md e
// market.md), não um atalho de banco: prova o gate de verdade, não só o
// caminho feliz pós-desbloqueio.
export async function unlockKey(userToken: string, key: string): Promise<void> {
  for (;;) {
    const lessons = await listLessons(userToken)
    const alreadyUnlocked = lessons.some(
      (lesson) => lesson.status === 'completed' && lesson.unlocksKeys.includes(key),
    )
    if (alreadyUnlocked) {
      return
    }

    const next = lessons.find((lesson) => lesson.status === 'available')
    if (!next) {
      throw new Error(`nenhuma lição disponível pra avançar rumo à chave "${key}"`)
    }
    await completeLesson(userToken, next.id)
  }
}
