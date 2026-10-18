import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query'
import {
    addDailyAcceptedWord,
    createDailyEvent,
    createDailyQuestion,
    createDailyWord,
    getDailyAcceptedWords,
    getDailyEvents,
    getDailyMetrics,
    getDailyOverview,
    getDailyPuzzle,
    getDailyQuestions,
    getDailyWords,
    prepareDailyDraft,
    publishDailyPuzzles,
    removeDailyAcceptedWord,
    replaceDailyCard,
    reviewDailyPuzzle,
    setDailyStartDate,
    updateDailyEvent,
    updateDailyQuestion,
    updateDailyWord,
} from '../../../services/admin'
import type {
    DailyChangeImpact,
    DailyDraftResult,
    DailyEvent,
    DailyEventInput,
    DailyMetricsDay,
    DailyOverview,
    DailyPatch,
    DailyPuzzleDetail,
    DailyQuestion,
    DailyQuestionInput,
    DailyReplaceCardInput,
    DailyStartDateResult,
    DailyWord,
    DailyWordInput,
} from '../../../services/admin'
import { useAuth } from '../../auth/AuthContext'
import { useAdminReauth } from '../AdminReauth'
import { AUDIT_LOG_QUERY_KEY } from '../useAuditLogQuery'

export const ADMIN_DAILY_QUERY_KEY = ['admin', 'daily'] as const
const OVERVIEW_KEY = [...ADMIN_DAILY_QUERY_KEY, 'overview'] as const
const puzzleKey = (number: number) => [...ADMIN_DAILY_QUERY_KEY, 'puzzle', number] as const
const WORDS_KEY = [...ADMIN_DAILY_QUERY_KEY, 'words'] as const
const QUESTIONS_KEY = [...ADMIN_DAILY_QUERY_KEY, 'questions'] as const
const EVENTS_KEY = [...ADMIN_DAILY_QUERY_KEY, 'events'] as const
const ACCEPTED_KEY = [...ADMIN_DAILY_QUERY_KEY, 'accepted'] as const

// Tudo do painel do Diário depende de tudo (editar um item muda a agenda, a revisão e a cobertura),
// então qualquer escrita invalida a árvore inteira e a auditoria. Invalida no `onSettled`: uma recusa
// também deixa a tela velha.
function useInvalidateDaily() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: ADMIN_DAILY_QUERY_KEY })
        queryClient.invalidateQueries({ queryKey: AUDIT_LOG_QUERY_KEY })
    }
}

function useDailyQuery<T>(key: readonly unknown[], load: (token: string) => Promise<T>, enabled = true): UseQueryResult<T> {
    const { token } = useAuth()
    return useQuery({ queryKey: key, queryFn: () => load(token as string), enabled: token !== null && enabled, retry: false })
}

export const useDailyMetricsQuery = (days = 30) =>
    useDailyQuery<DailyMetricsDay[]>(
        [...ADMIN_DAILY_QUERY_KEY, 'metrics', days],
        async (token) => (await getDailyMetrics(token, days)).days,
    )

export const useDailyOverviewQuery = () => useDailyQuery<DailyOverview>(OVERVIEW_KEY, getDailyOverview)

export const useDailyPuzzleQuery = (number: number) =>
    useDailyQuery<DailyPuzzleDetail>(puzzleKey(number), (token) => getDailyPuzzle(token, number), Number.isInteger(number) && number > 0)

export const useDailyWordsQuery = () => useDailyQuery<DailyWord[]>(WORDS_KEY, async (token) => (await getDailyWords(token)).words)
export const useDailyQuestionsQuery = () =>
    useDailyQuery<DailyQuestion[]>(QUESTIONS_KEY, async (token) => (await getDailyQuestions(token)).questions)
export const useDailyEventsQuery = () => useDailyQuery<DailyEvent[]>(EVENTS_KEY, async (token) => (await getDailyEvents(token)).events)
export const useDailyAcceptedWordsQuery = () =>
    useDailyQuery<string[]>(ACCEPTED_KEY, async (token) => (await getDailyAcceptedWords(token)).words)

function useDailyMutation<V, R>(run: (token: string, variables: V) => Promise<R>): UseMutationResult<R, unknown, V> {
    const { token } = useAuth()
    const invalidate = useInvalidateDaily()
    return useMutation({ mutationFn: (variables: V) => run(token as string, variables), onSettled: invalidate })
}

export const usePrepareDailyDraftMutation = (): UseMutationResult<DailyDraftResult, unknown, string> =>
    useDailyMutation((token, startDate: string) => prepareDailyDraft(token, startDate))

// Mudar a data da estreia pede senha recente (N.22).
export function useSetDailyStartDateMutation(): UseMutationResult<DailyStartDateResult, unknown, string | null> {
    const { withReauth } = useAdminReauth()
    const invalidate = useInvalidateDaily()
    return useMutation({
        mutationFn: (startDate: string | null) => withReauth((token) => setDailyStartDate(token, startDate)),
        onSettled: invalidate,
    })
}

export const usePublishDailyPuzzlesMutation = (): UseMutationResult<{ published: number[] }, unknown, number[] | undefined> =>
    useDailyMutation((token, numbers: number[] | undefined) => publishDailyPuzzles(token, numbers))

export const useReviewDailyPuzzleMutation = (): UseMutationResult<{ number: number }, unknown, number> =>
    useDailyMutation((token, number: number) => reviewDailyPuzzle(token, number))

export interface ReplaceDailyCardVariables {
    number: number
    input: DailyReplaceCardInput
}

export const useReplaceDailyCardMutation = (): UseMutationResult<{ number: number }, unknown, ReplaceDailyCardVariables> =>
    useDailyMutation((token, { number, input }: ReplaceDailyCardVariables) => replaceDailyCard(token, number, input))

export interface UpdateVariables<T> {
    id: string
    patch: DailyPatch<T>
}

export const useCreateDailyWordMutation = (): UseMutationResult<{ word: DailyWord }, unknown, DailyWordInput> =>
    useDailyMutation((token, input: DailyWordInput) => createDailyWord(token, input))

export const useUpdateDailyWordMutation = (): UseMutationResult<
    { word: DailyWord } & DailyChangeImpact,
    unknown,
    UpdateVariables<DailyWordInput>
> => useDailyMutation((token, { id, patch }: UpdateVariables<DailyWordInput>) => updateDailyWord(token, id, patch))

export const useCreateDailyQuestionMutation = (): UseMutationResult<{ question: DailyQuestion }, unknown, DailyQuestionInput> =>
    useDailyMutation((token, input: DailyQuestionInput) => createDailyQuestion(token, input))

export const useUpdateDailyQuestionMutation = (): UseMutationResult<
    { question: DailyQuestion } & DailyChangeImpact,
    unknown,
    UpdateVariables<DailyQuestionInput>
> => useDailyMutation((token, { id, patch }: UpdateVariables<DailyQuestionInput>) => updateDailyQuestion(token, id, patch))

export const useCreateDailyEventMutation = (): UseMutationResult<{ event: DailyEvent }, unknown, DailyEventInput> =>
    useDailyMutation((token, input: DailyEventInput) => createDailyEvent(token, input))

export const useUpdateDailyEventMutation = (): UseMutationResult<
    { event: DailyEvent } & DailyChangeImpact,
    unknown,
    UpdateVariables<DailyEventInput>
> => useDailyMutation((token, { id, patch }: UpdateVariables<DailyEventInput>) => updateDailyEvent(token, id, patch))

export const useAddDailyAcceptedWordMutation = (): UseMutationResult<{ word: string }, unknown, string> =>
    useDailyMutation((token, word: string) => addDailyAcceptedWord(token, word))

export const useRemoveDailyAcceptedWordMutation = (): UseMutationResult<{ word: string }, unknown, string> =>
    useDailyMutation((token, word: string) => removeDailyAcceptedWord(token, word))
