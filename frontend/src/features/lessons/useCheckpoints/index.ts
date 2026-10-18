import { useMutation } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { answerCheckpoint } from '../../../services/lessons'
import type { AnswerCheckpointResult, CheckpointState } from '../../../services/lessons'
import type { CheckBlock } from '../widgets/schema'
import { nextStreak, streakMilestone } from '../answerStreak'
import { playLessonCue } from '../lessonFeedback'
import type { CheckpointResponse, CheckpointView } from './types'

export type { CheckpointResponse, CheckpointView } from './types'

const UNTOUCHED: CheckpointView = { solved: false, attempts: 0, wrongOptions: [], firstTry: false, lastAttemptWrong: false }

// Estado das perguntas intermediárias de uma lição (RC.3.2): o que o servidor
// restaurou (`GET /lessons/:id`) mais o que aconteceu nesta sessão. Em revisão
// de lição concluída (`isReview`) o estado do servidor é ignorado e nada fica
// travado: a pergunta é sem estado, pode ser respondida de novo.
export function useCheckpoints(lessonId: string, serverState: CheckpointState[] | undefined, isReview: boolean) {
    const { token } = useAuth()
    const [local, setLocal] = useState<Record<string, CheckpointView>>({})
    // Acertos de primeira seguidos nesta sessão da lição (LJ.1.6): só memória, nunca grava nada. Em revisão não conta.
    const streak = useRef(0)
    const mutation = useMutation({
        mutationFn: ({ block, response }: { block: CheckBlock; response: CheckpointResponse }) =>
            answerCheckpoint(token as string, lessonId, block.id, response),
    })

    function viewFor(checkpointId: string): CheckpointView {
        if (local[checkpointId]) {
            return local[checkpointId]
        }
        const restored = isReview ? undefined : serverState?.find((state) => state.checkpointId === checkpointId)
        if (!restored) {
            return UNTOUCHED
        }
        return {
            solved: restored.solved,
            attempts: restored.attempts,
            wrongOptions: restored.wrongOptions,
            firstTry: restored.firstTry,
            lastAttemptWrong: false,
            ...(restored.estimate ? { estimate: restored.estimate } : {}),
            ...(restored.sequence ? { sequence: restored.sequence } : {}),
            ...(restored.groups ? { groups: restored.groups } : {}),
            ...(restored.match ? { matched: restored.match.pairs } : {}),
        }
    }

    async function submit(block: CheckBlock, response: CheckpointResponse) {
        const before = viewFor(block.id)
        let result
        try {
            result = await mutation.mutateAsync({ block, response })
        } catch {
            // Falha de rede: `isError` mostra o aviso e a pergunta segue como estava.
            return
        }
        if (block.kind === 'match' && 'pair' in response && result.match) {
            recordMatchPair(block.id, block.left.length, response.pair, before, result)
            return
        }
        const milestone = isReview
            ? undefined
            : streakMilestone((streak.current = nextStreak(streak.current, { correct: result.correct, firstTry: result.firstTry })))
        // Som e vibração só no acerto, e nunca em revisão (LJ.5.4). Erro é silencioso.
        if (result.correct && !isReview) playLessonCue('correct')
        const tried = 'selectedOption' in response ? response.selectedOption : undefined
        setLocal((current) => ({
            ...current,
            // Estimativa resolve na 1ª resposta, mesmo longe do valor (LJ-D1): sempre vem o resultado.
            [block.id]:
                result.correct || result.estimate
                    ? {
                          solved: true,
                          attempts: result.attempts,
                          wrongOptions: before.wrongOptions,
                          firstTry: result.firstTry,
                          explanation: result.explanation,
                          streakMilestone: milestone,
                          lastAttemptWrong: false,
                          ...(result.estimate ? { estimate: result.estimate } : {}),
                          ...('sequence' in response ? { sequence: response.sequence } : {}),
                          ...('groups' in response ? { groups: response.groups } : {}),
                      }
                    : {
                          solved: false,
                          attempts: result.attempts,
                          // Em revisão o servidor devolve `wrongOptions` vazio: acumula só no cliente.
                          wrongOptions:
                              tried === undefined || before.wrongOptions.includes(tried)
                                  ? before.wrongOptions
                                  : [...before.wrongOptions, tried],
                          firstTry: false,
                          lastAttemptWrong: true,
                          ...(result.hint ? { hint: result.hint } : {}),
                      },
        }))
    }

    // Ligar pares (LJ-D3): cada chamada confere um par. O servidor diz se o par travou e, fora da revisão, quais
    // pares já estão travados; em revisão (sem estado) a tela soma os pares certos por conta própria. A
    // pergunta só resolve quando o último par trava. Sequência e som seguem a pergunta inteira: um par certo
    // no meio do caminho não mexe na sequência, um par errado a zera (sem mensagem).
    function recordMatchPair(
        blockId: string,
        total: number,
        pair: [number, number],
        before: CheckpointView,
        result: AnswerCheckpointResult,
    ) {
        const pairCorrect = result.match?.pairCorrect === true
        const known = before.matched ?? []
        const pairs = isReview ? (pairCorrect ? [...known, pair] : known) : (result.match?.pairs ?? known)
        const done = isReview ? pairs.length === total : result.correct
        let milestone: CheckpointView['streakMilestone']
        if (!isReview && (done || !pairCorrect)) {
            milestone = streakMilestone((streak.current = nextStreak(streak.current, { correct: done, firstTry: done && result.firstTry })))
        }
        if (done && !isReview) playLessonCue('correct')
        setLocal((current) => ({
            ...current,
            [blockId]: {
                solved: done,
                attempts: result.attempts,
                wrongOptions: before.wrongOptions,
                firstTry: done && result.firstTry,
                lastAttemptWrong: false,
                matched: pairs,
                ...(done && result.explanation ? { explanation: result.explanation } : {}),
                ...(milestone ? { streakMilestone: milestone } : {}),
                ...(pairCorrect ? {} : { lastMiss: { left: pair[0], right: pair[1], n: (before.lastMiss?.n ?? 0) + 1 } }),
            },
        }))
    }

    return { viewFor, submit, isPending: mutation.isPending, isError: mutation.isError }
}
