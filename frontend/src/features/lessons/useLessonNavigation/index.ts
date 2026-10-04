import { useCallback, useReducer } from 'react'

export interface LessonNavigationState {
    // `undefined` até a primeira navegação do usuário: o passo inicial vem do
    // servidor (ou 0 em revisão) e só é conhecido depois que a lição carrega.
    step: number | undefined
    card: number
    // Fase mais avançada já alcançada nesta sessão (o `max` com o passo
    // gravado no servidor é feito no hook). Reavançar até ela não chama
    // `POST /progress` (RC.2.2).
    reached: number
    // Chave `${fase}:${cartão}` de cartões `[revelar]` já abertos. Não zera
    // ao avançar nem ao voltar: o aluno que volta não tem que revelar de novo.
    revealed: string[]
}

export type LessonNavigationAction =
    | { type: 'nextCard' }
    | { type: 'goToStep'; step: number }
    | { type: 'back'; from: number; previousCardCount: number }
    | { type: 'reveal'; key: string }

export const initialLessonNavigation: LessonNavigationState = { step: undefined, card: 0, reached: 0, revealed: [] }

// `from` é o passo efetivo no momento da ação (o estado só guarda o passo
// quando o usuário já navegou); `previousCardCount` é quantos cartões tem a
// fase anterior, pra Voltar cair no último cartão dela.
export function lessonNavigationReducer(state: LessonNavigationState, action: LessonNavigationAction): LessonNavigationState {
    switch (action.type) {
        case 'nextCard':
            return { ...state, card: state.card + 1 }
        case 'goToStep':
            return { ...state, step: action.step, card: 0, reached: Math.max(state.reached, action.step) }
        case 'back':
            if (state.card > 0) {
                return { ...state, card: state.card - 1, step: action.from }
            }
            if (action.from === 0) {
                return state
            }
            return { ...state, step: action.from - 1, card: Math.max(action.previousCardCount - 1, 0) }
        case 'reveal':
            return state.revealed.includes(action.key) ? state : { ...state, revealed: [...state.revealed, action.key] }
    }
}

interface UseLessonNavigationOptions {
    initialStep: number
    // Fase mais avançada que o servidor já aceitou (`currentStep` gravado;
    // em revisão, a última, porque nada vai ao servidor).
    initialReached: number
}

// Navegação do player (RC.2.2): fase + cartão, Voltar e "já visto". Só
// estado de tela; quem decide se avançar chama o servidor é o player,
// comparando `step + 1` com `reached`.
export function useLessonNavigation({ initialStep, initialReached }: UseLessonNavigationOptions) {
    const [state, dispatch] = useReducer(lessonNavigationReducer, initialLessonNavigation)
    const step = state.step ?? initialStep
    const reached = Math.max(state.reached, initialReached)

    const nextCard = useCallback(() => dispatch({ type: 'nextCard' }), [])
    const goToStep = useCallback((target: number) => dispatch({ type: 'goToStep', step: target }), [])
    const back = useCallback(
        (cardCounts: number[]) => dispatch({ type: 'back', from: step, previousCardCount: cardCounts[step - 1] ?? 1 }),
        [step],
    )
    const reveal = useCallback(() => dispatch({ type: 'reveal', key: `${step}:${state.card}` }), [step, state.card])

    return {
        step,
        card: state.card,
        reached,
        canGoBack: step > 0 || state.card > 0,
        isRevealed: state.revealed.includes(`${step}:${state.card}`),
        nextCard,
        goToStep,
        back,
        reveal,
    }
}
