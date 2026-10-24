import { missedCheckpoint } from './lesson'
import type { LessonSummary, UserCheckpointRecord } from './lesson'
import { allBlocks, findCheckBlock, toPublicBlock } from './widgets/lessonBlocks'
import type { PublicCheckBlock } from './widgets/lessonBlocks'

// "Relembra?" (LJ.5.5): uma pergunta de lição anterior já concluída no começo da lição.
// Quantas lições para trás o sorteio olha quando a pessoa não errou nada: de 2 a 5 (a imediatamente
// anterior ainda está fresca demais para "relembrar").
export const RECALL_WINDOW_NEAR = 2
export const RECALL_WINDOW_FAR = 5

export interface RecallView {
  // Lição de origem: a resposta vai para a rota de checkpoint dela (leitura, porque está concluída).
  lessonId: string
  lessonTitle: string
  block: PublicCheckBlock
}

export interface SelectRecallInput {
  // Semente do dia: usuário + dia, para recarregar não trocar a pergunta. A lição atual entra no
  // sorteio junto, então cada lição do dia tem a sua pergunta.
  seed: string
  now: Date
  current: Pick<LessonSummary, 'id' | 'trackNumber' | 'sortOrder'>
  // Lições publicadas, qualquer ordem.
  lessons: LessonSummary[]
  completedLessonIds: ReadonlySet<string>
  checkpoints: UserCheckpointRecord[]
}

// FNV-1a: ordem estável por semente, sem depender de estado nem de `Math.random`.
function rank(seed: string, key: string): number {
  let hash = 2166136261
  const text = `${seed}|${key}`
  for (let i = 0; i < text.length; i += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619)
  }
  return hash >>> 0
}

function pickFirstByRank<T>(seed: string, items: T[], keyOf: (item: T) => string): T | undefined {
  return items.reduce<T | undefined>((best, item) => {
    if (best === undefined) return item
    return rank(seed, keyOf(item)) < rank(seed, keyOf(best)) ? item : best
  }, undefined)
}

interface Candidate {
  lessonId: string
  checkpointId: string
}

// Escolhe a pergunta do "Relembra?", ou nada. Regras:
// - só a partir da segunda lição de cada trilha;
// - só de lição já concluída e anterior a esta, e só de pergunta que ainda existe no conteúdo;
// - prefere uma pergunta que a pessoa errou e que está vencida na fila de revisão (LJ.5.6), em
//   qualquer lição anterior concluída. Acertar no "Relembra?" conta como revisão e adia a volta, então a
//   mesma pergunta errada não aparece em toda lição;
// - sem erro nenhum, uma qualquer das lições de 2 a 5 posições atrás (se não houver, de 1 a 5);
// - determinística pela semente e pela lição atual.
export function selectRecall(
  input: SelectRecallInput,
): { lessonId: string; checkpointId: string } | undefined {
  const seed = `${input.seed}|${input.current.id}`
  const ordered = [...input.lessons].sort((a, b) => a.sortOrder - b.sortOrder)
  const firstOfTrack = ordered.find((lesson) => lesson.trackNumber === input.current.trackNumber)
  const position = ordered.findIndex((lesson) => lesson.id === input.current.id)
  if (position < 0 || firstOfTrack?.id === input.current.id) {
    return undefined
  }

  const earlier = ordered
    .slice(0, position)
    .filter((lesson) => input.completedLessonIds.has(lesson.id))
  const earlierById = new Map(earlier.map((lesson) => [lesson.id, lesson]))

  const missed: Candidate[] = input.checkpoints
    .filter((record) => {
      const lesson = earlierById.get(record.lessonId)
      return (
        lesson !== undefined &&
        missedCheckpoint(record) &&
        isDueForReview(record, input.now) &&
        findCheckBlock(lesson.blocks, record.checkpointId)
      )
    })
    .map((record) => ({ lessonId: record.lessonId, checkpointId: record.checkpointId }))
  const fromMistakes = pickFirstByRank(seed, missed, (c) => `${c.lessonId}|${c.checkpointId}`)
  if (fromMistakes) {
    return fromMistakes
  }

  const questionsIn = (from: number, to: number): Candidate[] =>
    ordered
      .slice(Math.max(0, position - from), Math.max(0, position - to + 1))
      .filter((lesson) => input.completedLessonIds.has(lesson.id))
      .flatMap((lesson) =>
        allBlocks(lesson.blocks).flatMap((block) =>
          block.type === 'check' ? [{ lessonId: lesson.id, checkpointId: block.id }] : [],
        ),
      )
  const pool = questionsIn(RECALL_WINDOW_FAR, RECALL_WINDOW_NEAR)
  const fallback = pool.length > 0 ? pool : questionsIn(RECALL_WINDOW_FAR, 1)
  return pickFirstByRank(seed, fallback, (c) => `${c.lessonId}|${c.checkpointId}`)
}

// Na fila de revisão e já vencida. Fora da fila (`null`): a pessoa já fixou a pergunta.
function isDueForReview(record: UserCheckpointRecord, now: Date): boolean {
  return record.reviewDueAt != null && record.reviewDueAt.getTime() <= now.getTime()
}

// Monta a visão pública da escolha (sem gabarito nem explicação). `undefined` se a lição ou a pergunta sumiram.
export function buildRecallView(
  choice: { lessonId: string; checkpointId: string },
  lessons: LessonSummary[],
): RecallView | undefined {
  const lesson = lessons.find((candidate) => candidate.id === choice.lessonId)
  const block = lesson ? findCheckBlock(lesson.blocks, choice.checkpointId) : undefined
  if (!lesson || !block) {
    return undefined
  }
  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    block: toPublicBlock(block) as PublicCheckBlock,
  }
}
