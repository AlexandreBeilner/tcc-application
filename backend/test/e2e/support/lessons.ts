import type {
  CheckBlock,
  LessonBlocks,
  PublicCheckBlock,
  PublicLessonBlock,
} from '../../../src/modules/lessons/domain/widgets/lessonBlocks'
import { withE2EDatabase } from './db'
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

// Gabarito de autoria das perguntas de uma fase, lido do banco da stack: o conteúdo das lições
// vive no banco (N.23, pode ter sido editado pelo painel ou por migração de conteúdo) e o
// gabarito nunca sai do servidor antes do acerto, então não há caminho HTTP pra ele.
async function authoredChecks(lessonId: string, phase: Phase): Promise<CheckBlock[]> {
  const blocks = await withE2EDatabase(async (client) => {
    const res = await client.query<{ blocks: LessonBlocks | null }>(
      'SELECT blocks FROM lessons WHERE id = $1',
      [lessonId],
    )
    return res.rows[0]?.blocks ?? null
  })
  return (blocks?.phases[phase] ?? []).filter(
    (block): block is CheckBlock => block.type === 'check',
  )
}

// Posição, na lista embaralhada que o cliente recebe, do item de autoria `text`.
function publicIndex(list: string[] | undefined, text: string, checkId: string): number {
  const index = list?.indexOf(text) ?? -1
  if (index < 0) throw new Error(`checkpoint "${checkId}": item "${text}" não veio ao cliente`)
  return index
}

// Resolve as perguntas intermediárias (`check`, RC.3.2) de uma fase: sem isso o
// `POST /progress` responde 422 `checkpoint_unsolved` ao sair da fase. Cobre todos os
// formatos (LJ.2.x): `order` e `match` chegam embaralhados ao cliente, então o gabarito de
// autoria é traduzido para as posições que o cliente vê, como faria quem joga; `match`
// confere um par por vez (LJ-D3); `estimate` resolve na primeira resposta (LJ-D1).
export async function solveCheckpoints(
  userToken: string,
  lessonId: string,
  phase: Phase,
): Promise<void> {
  const detail = await authed(userToken).get(`/lessons/${lessonId}`)
  const publicChecks = (
    (detail.body.lesson?.blocks?.phases?.[phase] ?? []) as PublicLessonBlock[]
  ).filter((block): block is PublicCheckBlock => block.type === 'check')
  if (publicChecks.length === 0) return

  const authored = await authoredChecks(lessonId, phase)
  for (const check of publicChecks) {
    const block = authored.find((candidate) => candidate.id === check.id)
    if (!block) throw new Error(`gabarito de "${check.id}" não achado no banco`)
    const answer = (body: object) =>
      authed(userToken).post(`/lessons/${lessonId}/checkpoints/${check.id}/answer`).send(body)

    let res
    switch (block.kind) {
      case 'single':
        res = await answer({ selectedOption: block.answer })
        break
      case 'true_false':
        res = await answer({ selectedOption: block.answer ? 0 : 1 })
        break
      case 'estimate':
        res = await answer({ value: block.answer })
        break
      case 'categorize':
        res = await answer({ groups: block.answer })
        break
      case 'order':
        res = await answer({
          sequence: block.answer.map((item) =>
            publicIndex(check.items, block.items[item], check.id),
          ),
        })
        break
      case 'match':
        for (let left = 0; left < block.left.length; left++) {
          const right = publicIndex(check.right, block.right[block.answer[left]], check.id)
          res = await answer({ pair: [left, right] })
          if (res.status !== 200 || res.body.match?.pairCorrect !== true) break
        }
        break
    }
    if (!res || res.status !== 200 || res.body.correct !== true) {
      throw new Error(
        `checkpoint "${check.id}" (${block.kind}) não resolveu: ${res?.status} ${JSON.stringify(res?.body)}`,
      )
    }
  }
}

async function completeLesson(userToken: string, lesson: LessonSummary): Promise<void> {
  await solveCheckpoints(userToken, lesson.id, 'scenario')
  await advanceStep(userToken, lesson.id, 1)
  await solveMicroDecision(userToken, lesson.id)
  await solveCheckpoints(userToken, lesson.id, 'microDecision')
  await advanceStep(userToken, lesson.id, 2)
  await solveCheckpoints(userToken, lesson.id, 'revelation')
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
