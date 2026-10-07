import { authed, sleep } from './http'
import { LESSON_SEEDS } from '../../../src/db/seedLessons'
import type { CheckBlock } from '../../../src/modules/lessons/domain/widgets/lessonBlocks'

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

// Resolve a pergunta da Micro-decisão (RC.2.3: errar não avança). O helper não
// conhece o gabarito, então tenta as alternativas em ordem até acertar; lição
// sem pergunta com alternativas responde 422 `no_micro_decision` e segue.
async function solveMicroDecision(userToken: string, lessonId: string): Promise<void> {
  for (let option = 0; option < 6; option++) {
    const res = await authed(userToken)
      .post(`/lessons/${lessonId}/answer`)
      .send({ selectedOption: option })
    if (res.status === 422 && res.body.code === 'no_micro_decision') {
      return
    }
    if (res.status === 400) {
      break
    }
    if (res.status !== 200) {
      throw new Error(
        `falha ao responder a lição ${lessonId}: ${res.status} ${JSON.stringify(res.body)}`,
      )
    }
    if (res.body.correct === true) {
      return
    }
  }
  throw new Error(`nenhuma alternativa acertou a pergunta da lição ${lessonId}`)
}

type Phase = 'scenario' | 'microDecision' | 'revelation'

interface PublicCheck {
  type: string
  id: string
  kind?: 'single' | 'true_false' | 'numeric'
  options?: string[]
}

// Resolve as perguntas intermediárias (`check`, RC.3.2) de uma fase: sem isso o
// `POST /progress` responde 422 `checkpoint_unsolved` ao sair da fase. Alternativas
// (single e verdadeiro/falso) são tentadas em ordem, como na micro-decisão; a
// numérica não se resolve por tentativa, então o gabarito vem do próprio seed.
export async function solveCheckpoints(
  userToken: string,
  lessonId: string,
  sortOrder: number,
  phase: Phase,
): Promise<void> {
  const detail = await authed(userToken).get(`/lessons/${lessonId}`)
  const checks = ((detail.body.lesson?.blocks?.phases?.[phase] ?? []) as PublicCheck[]).filter(
    (block) => block.type === 'check',
  )
  for (const check of checks) {
    const url = `/lessons/${lessonId}/checkpoints/${check.id}/answer`
    if (check.kind === 'numeric') {
      const seeded = LESSON_SEEDS.find((seed) => seed.sortOrder === sortOrder)
        ?.blocks?.phases[phase].find((block) => block.type === 'check' && block.id === check.id) as
        | Extract<CheckBlock, { kind: 'numeric' }>
        | undefined
      if (!seeded) throw new Error(`gabarito numérico de "${check.id}" não achado no seed`)
      const res = await authed(userToken).post(url).send({ value: seeded.answer })
      if (res.status !== 200 || res.body.correct !== true) {
        throw new Error(`checkpoint "${check.id}" não resolveu: ${res.status} ${JSON.stringify(res.body)}`)
      }
      continue
    }
    const optionCount = check.kind === 'true_false' ? 2 : (check.options?.length ?? 0)
    let solved = false
    for (let option = 0; option < optionCount && !solved; option++) {
      const res = await authed(userToken).post(url).send({ selectedOption: option })
      if (res.status !== 200) {
        throw new Error(`checkpoint "${check.id}": ${res.status} ${JSON.stringify(res.body)}`)
      }
      solved = res.body.correct === true
    }
    if (!solved) throw new Error(`nenhuma alternativa acertou o checkpoint "${check.id}"`)
  }
}

async function completeLesson(userToken: string, lesson: LessonSummary): Promise<void> {
  await solveCheckpoints(userToken, lesson.id, lesson.sortOrder, 'scenario')
  await advanceStep(userToken, lesson.id, 1)
  await solveMicroDecision(userToken, lesson.id)
  await solveCheckpoints(userToken, lesson.id, lesson.sortOrder, 'microDecision')
  await advanceStep(userToken, lesson.id, 2)
  await solveCheckpoints(userToken, lesson.id, lesson.sortOrder, 'revelation')
  await advanceStep(userToken, lesson.id, 3)
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
    await completeLesson(userToken, next)
  }
}
