import { ArrowLeft, Check, ChevronLeft, Eye } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLessonQuery } from '../../features/lessons/useLessonQuery'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { useAdvanceLesson } from '../../features/lessons/useAdvanceLesson'
import { useAnswerMicroDecision } from '../../features/lessons/useAnswerMicroDecision'
import { useReviewLesson } from '../../features/lessons/useReviewLesson'
import { useLessonNavigation } from '../../features/lessons/useLessonNavigation'
import { Button } from '../../components/atoms/Button'
import { GrowthCalculatorForm } from '../../components/organisms/GrowthCalculatorForm'
import { FixedIncomeComparisonForm } from '../../components/organisms/FixedIncomeComparisonForm'
import { EquityIndicatorsPanel } from '../../components/organisms/EquityIndicatorsPanel'
import { IndicatorSummaryCards } from '../../components/organisms/IndicatorSummaryCards'
import { assetDetailPath } from '../../features/market/assetDetailPath'
import { useAssetByTicker } from '../../features/market/useAssetByTicker'
import { useIndicatorHistoryQuery } from '../../features/market/useIndicatorHistoryQuery'
import { nextCopomSimulatedDay } from '../../features/market/nextCopomDay'
import { featureUnlockCtaFor } from '../../features/lessons/featureUnlockCta'
import { splitIntoCards } from '../../features/lessons/splitIntoCards'
import type { Card } from '../../features/lessons/splitIntoCards'
import { parseLessonMarkup } from '../../features/lessons/parseLessonMarkup'
import { GlossaryTerm } from '../../components/molecules/GlossaryTerm'
import type { AnswerMicroDecisionResult, Lesson as LessonType } from '../../services/lessons'
import styles from './index.module.css'

const TOTAL_STEPS = 4

// Janela de busca do indicador macro ao vivo (tarefa M.5, `live_macro_indicator`)
// — só precisa do valor mais recente pros cards de resumo, mesma fonte de
// `GET /market/indicators` (M.3) da tela Indicadores Econômicos (M.4), sem
// endpoint próprio.
const LIVE_MACRO_INDICATOR_WINDOW_DAYS = 90

// Widget do passo Micro-decisão que não precisa do checkbox "já pensei" —
// os dois embutem um componente já existente (tarefa 6.7) que já traz sua
// própria interação. Os outros três (`reflection`, `live_indicator`,
// `live_macro_indicator`) mantêm o checkbox (tarefa 7.0.2/M.5 — a
// revelação desses dois últimos busca o indicador ao vivo, mas a
// micro-decisão em si continua sendo reflexão).
const EMBEDDED_WIDGET_TYPES = new Set<LessonType['microDecisionType']>(['growth_calculator', 'fixed_income_comparison'])

// Tela 3.2 (tarefa 6.4/7.0.2) — máquina de estado de 4 passos, mockup em
// https://claude.ai/code/artifact/50892817-9878-430c-8332-ee5e94b90b43.
// Antes da 7.0.2, o schema de `lessons` só tinha `centralConcept`/
// `unlocksDescription` como texto livre e esta tela reaproveitava
// `centralConcept` idêntico nos 3 primeiros passos (pendência sinalizada
// desde a 6.4). Agora cada passo renderiza seu próprio campo real
// (`scenarioText`/`microDecisionPrompt`/`revelationText`), o widget de
// Micro-decisão varia por `microDecisionType`, a Revelação de uma lição
// `live_indicator` busca o indicador real via `GET /market/assets/:id` (uma
// `live_macro_indicator`, via `GET /market/indicators`, tarefa M.5), e o
// Desbloqueio ganha "Comprar agora" quando `unlocksAssetTicker` existe.
export function Lesson() {
    const { id } = useParams<{ id: string }>()
    const lessonId = id as string

    // `key` força remontagem ao trocar de lição (via "Continuar" no
    // desbloqueio) — o estado local de passo/confirmação começa limpo sem
    // precisar de um efeito só pra resetá-lo.
    return <LessonView key={lessonId} lessonId={lessonId} />
}

function LessonView({ lessonId }: { lessonId: string }) {
    const navigate = useNavigate()
    const lessonQuery = useLessonQuery(lessonId)
    const lessonsQuery = useLessonsQuery()
    const advanceLesson = useAdvanceLesson(lessonId)
    const reviewLesson = useReviewLesson(lessonId)
    const answerMicroDecision = useAnswerMicroDecision(lessonId)

    // Pergunta da Micro-decisão (RC.2.4): `selectedOption` é a alternativa
    // marcada e ainda não enviada; `answer` é o último acerto desta sessão;
    // `localWrongOptions` são os erros desta sessão (o servidor só devolve os
    // erros gravados, e em revisão não grava nada). O gabarito só chega com o
    // acerto (D3), por isso nada aqui compara índice no cliente.
    const [selectedOption, setSelectedOption] = useState<number | undefined>(undefined)
    const [answer, setAnswer] = useState<AnswerMicroDecisionResult | undefined>(undefined)
    const [localWrongOptions, setLocalWrongOptions] = useState<number[]>([])
    const [lastAttemptWrong, setLastAttemptWrong] = useState(false)
    const feedbackRef = useRef<HTMLParagraphElement>(null)

    const lesson = lessonQuery.data?.lesson
    // Referência cruzada entre lições (tarefa C.2, `{{ref:2.1}}`) resolve o
    // `code` citado pro `id` real usando esta mesma lista, sem chamada nova.
    const lessons = lessonsQuery.data?.lessons ?? []
    // Modo revisão (RC.2.1): decidido uma vez, quando a lição carrega. Guardar
    // o valor inicial evita que concluir a lição agora (a query refaz o fetch
    // e `status` vira `completed`) troque o fluxo no meio do caminho.
    const [isReview, setIsReview] = useState<boolean | undefined>(undefined)
    if (lesson && isReview === undefined) {
        setIsReview(lesson.status === 'completed')
    }
    // Lição concluída abre no Cenário (passo 0) e navega só no cliente, sem
    // `POST /progress`; lição em andamento retoma do passo gravado.
    // Navegação (RC.2.2): fase + cartão, Voltar e cartões já revelados. Em
    // revisão toda fase é "já alcançada" (nada vai ao servidor); fora dela,
    // reavançar até a fase que o servidor já gravou também não chama o POST
    // (evita 422 de intervalo/ordem ao voltar e seguir de novo).
    const serverStep = lesson?.currentStep ?? 0
    const navigation = useLessonNavigation({
        initialStep: isReview ? 0 : serverStep,
        initialReached: isReview ? TOTAL_STEPS - 1 : serverStep,
    })
    const { step, card: subStep, reached } = navigation

    // Backlog engajamento H.2 + decisão D2 (RC.2.1): a revisão conta quando o
    // usuário chega na Revelação da lição já concluída, não ao só abrir.
    // Registra uma vez por montagem (`key={lessonId}` no componente pai dá um
    // `reviewedRef` novo por lição reaberta). Backend decide se a lição é
    // antiga o bastante pra valer pra missão.
    const reviewedRef = useRef(false)
    useEffect(() => {
        if (isReview && step >= 2 && !reviewedRef.current) {
            reviewedRef.current = true
            reviewLesson.mutate()
        }
    }, [isReview, step, reviewLesson])

    const isLiveIndicator = lesson?.microDecisionType === 'live_indicator'
    const indicatorAsset = useAssetByTicker(isLiveIndicator ? (lesson?.microDecisionAssetTicker ?? null) : null)
    const isLiveMacroIndicator = lesson?.microDecisionType === 'live_macro_indicator'
    const macroIndicatorHistory = useIndicatorHistoryQuery(LIVE_MACRO_INDICATOR_WINDOW_DAYS, { enabled: isLiveMacroIndicator })
    const unlockAsset = useAssetByTicker(lesson?.unlocksAssetTicker ?? null)

    const usesEmbeddedWidget = lesson ? EMBEDDED_WIDGET_TYPES.has(lesson.microDecisionType) : false
    const hasRealOptions = (lesson?.microDecisionOptions?.length ?? 0) > 0
    // Em revisão a pergunta é sem estado: pode ser respondida de novo, mas não
    // trava nada (o servidor responde sem gravar). Fora dela, só avança quem
    // acertou, ou quem já passou da pergunta (`reached > 1`).
    const answerSolved = answer?.correct === true
    const questionSolved = answerSolved || (!isReview && (lesson?.microDecisionSolved === true || reached > 1))
    const wrongOptions = new Set([...(lesson?.microDecisionWrongOptions ?? []), ...localWrongOptions])
    const hasQuestionGate = hasRealOptions && !usesEmbeddedWidget
    const canAdvanceMicroDecision = !hasQuestionGate || isReview || questionSolved
    const unlockAssetPath = lesson?.unlocksAssetTicker && unlockAsset.asset ? assetDetailPath(unlockAsset.asset) : null
    // Chave de feature (`portfolio`/`calculator`, ex: 0.1/0.2) em vez de
    // produto real — mesmo mecanismo de CTA do Desbloqueio, generalizado pra
    // rota fixa (tarefa 7.1.1). Mutuamente exclusivo com `unlockAssetPath` na
    // prática: nenhuma lição autorada até aqui tem os dois.
    const featureUnlockCta = lesson && !lesson.unlocksAssetTicker ? featureUnlockCtaFor(lesson.unlocksKeys) : null

    const scenarioCards = lesson ? splitIntoCards(lesson.scenarioText) : [{ text: '', hidden: false }]
    const microDecisionCards = lesson ? splitIntoCards(lesson.microDecisionPrompt) : [{ text: '', hidden: false }]
    const revelationCards = lesson ? splitIntoCards(lesson.revelationText) : [{ text: '', hidden: false }]
    const isMicroDecisionLastCard = subStep >= microDecisionCards.length - 1
    const isRevelationLastCard = subStep >= revelationCards.length - 1

    // Setas esquerda/direita acionam Voltar/Continuar (RC.2.2), exceto com o
    // foco num campo de entrada (slider, input) ou com modificador. Clica nos
    // botões reais, então herdam o `disabled` e qualquer gate.
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
            const target = event.target as HTMLElement | null
            if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
            const selector = event.key === 'ArrowLeft' ? '[data-lesson-back]' : event.key === 'ArrowRight' ? '[data-lesson-continue]' : null
            if (!selector) return
            const button = document.querySelector<HTMLButtonElement>(selector)
            if (button && !button.disabled) button.click()
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    // Depois de um erro o aviso (`role="alert"`) recebe o foco: o botão que
    // estava focado acabou de ficar desativado.
    const wrongCount = localWrongOptions.length
    useEffect(() => {
        if (wrongCount > 0) feedbackRef.current?.focus()
    }, [wrongCount])

    function goToTrack() {
        navigate('/trilha')
    }

    function handleAdvance() {
        // Fase já alcançada (revisão de lição concluída, ou o aluno voltou e
        // está reavançando): só navega no cliente, sem tocar o servidor.
        if (step + 1 <= reached) {
            navigation.goToStep(step + 1)
            return
        }
        advanceLesson.mutate({ step: step + 1 }, { onSuccess: () => navigation.goToStep(step + 1) })
    }

    // Uma tentativa da pergunta (RC.2.4): o erro só descarta a alternativa
    // (sem dica, sem gabarito) e devolve o foco ao aviso; o acerto trava a
    // pergunta e libera o Continuar.
    function handleAnswer() {
        if (selectedOption === undefined) return
        const tried = selectedOption
        answerMicroDecision.mutate(tried, {
            onSuccess: (data) => {
                if (data.correct) {
                    setAnswer(data)
                    setLastAttemptWrong(false)
                    return
                }
                setLocalWrongOptions((current) => (current.includes(tried) ? current : [...current, tried]))
                setSelectedOption(undefined)
                setLastAttemptWrong(true)
            },
        })
    }

    // Cartão intermediário: só avança o cartão local. Cartão final da
    // fase: avança a fase de verdade (`handleAdvance`), mesmo gate de
    // habilitação que já existia (`disabled` no botão continua cuidando disso).
    function handleCardContinue(cards: Card[]) {
        if (subStep < cards.length - 1) {
            navigation.nextCard()
        } else {
            handleAdvance()
        }
    }

    // Quantos cartões tem cada fase, pro Voltar cair no último cartão da anterior.
    const cardCounts = [scenarioCards.length, microDecisionCards.length, revelationCards.length, 1]

    function handleBack() {
        navigation.back(cardCounts)
    }

    function handleReveal() {
        navigation.reveal()
    }

    function handleFinish() {
        const nextLesson = lessonsQuery.data?.lessons.find((candidate) => candidate.sortOrder === (lesson?.sortOrder ?? 0) + 1)
        navigate(nextLesson ? `/trilha/${nextLesson.id}` : '/trilha')
    }

    return (
        <main className={styles.page}>
            <div className={styles.top}>
                <button type="button" className={styles.back} onClick={goToTrack}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Sair da lição
                </button>
                <div className={styles.steps}>
                    {Array.from({ length: TOTAL_STEPS }, (_, index) => (
                        <span
                            key={index}
                            className={[styles.stepSeg, index < step && styles.done, index === step && styles.current]
                                .filter(Boolean)
                                .join(' ')}
                        />
                    ))}
                </div>
            </div>

            {lessonQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar esta lição agora. Ela pode estar bloqueada ou não existir.
                </p>
            )}

            {!lesson && !lessonQuery.isError && <p className={styles.loading}>Carregando lição…</p>}

            {lesson && step === 0 && (
                <section className={styles.card}>
                    <span className={styles.eyebrow}>Cenário</span>
                    <h1 className={styles.heading}>{lesson.title}</h1>
                    <CardBody card={scenarioCards[subStep]} revealed={navigation.isRevealed} onReveal={handleReveal} lessons={lessons} />
                    {scenarioCards.length > 1 && <CardDots total={scenarioCards.length} current={subStep} />}
                    <div className={styles.ctaRow}>
                        {navigation.canGoBack && (
                            <Button variant="secondary" onClick={handleBack} data-lesson-back="" aria-label="Voltar ao cartão anterior">
                                <ChevronLeft size={16} aria-hidden="true" />
                                Voltar
                            </Button>
                        )}
                        <Button
                            onClick={() => handleCardContinue(scenarioCards)}
                            disabled={advanceLesson.isPending}
                            data-lesson-continue=""
                        >
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 1 && (
                <section className={styles.card}>
                    <span className={styles.eyebrow}>Micro-decisão</span>
                    <h1 className={styles.heading}>Pense antes de continuar</h1>
                    <CardBody
                        card={microDecisionCards[subStep]}
                        revealed={navigation.isRevealed}
                        onReveal={handleReveal}
                        lessons={lessons}
                    />
                    {microDecisionCards.length > 1 && <CardDots total={microDecisionCards.length} current={subStep} />}

                    {isMicroDecisionLastCard && (
                        <>
                            {lesson.microDecisionType === 'growth_calculator' && <GrowthCalculatorForm />}
                            {lesson.microDecisionType === 'fixed_income_comparison' && <FixedIncomeComparisonForm />}

                            {hasQuestionGate && (
                                <>
                                    <div className={styles.optionsList} role="group" aria-label="Escolha uma opção">
                                        {lesson.microDecisionOptions?.map((option, index) => {
                                            const isWrong = wrongOptions.has(index)
                                            return (
                                                <button
                                                    key={option}
                                                    type="button"
                                                    aria-pressed={selectedOption === index}
                                                    className={[
                                                        styles.optionButton,
                                                        selectedOption === index && styles.optionSelected,
                                                        isWrong && styles.optionWrong,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' ')}
                                                    disabled={isWrong || questionSolved}
                                                    onClick={() => setSelectedOption(index)}
                                                >
                                                    {option}
                                                    {isWrong && <span className={styles.srOnly}> (alternativa descartada)</span>}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {lastAttemptWrong && !answerSolved && (
                                        <p ref={feedbackRef} tabIndex={-1} role="alert" className={styles.answerFeedback}>
                                            Ainda não. Essa alternativa foi descartada, escolha outra.
                                        </p>
                                    )}
                                    {answerSolved && (
                                        <p role="status" className={`${styles.answerFeedback} ${styles.answerFeedbackCorrect}`}>
                                            {isReview
                                                ? 'Resposta certa.'
                                                : answer.firstTry
                                                  ? 'Acertou de primeira.'
                                                  : `Acertou na ${answer.attempts}ª tentativa.`}
                                        </p>
                                    )}
                                    {!answerSolved && questionSolved && (
                                        <p className={styles.answerFeedback}>Você já resolveu esta pergunta.</p>
                                    )}
                                    {answerMicroDecision.isError && (
                                        <p role="alert" className={styles.error}>
                                            Não foi possível enviar sua resposta agora. Tente de novo.
                                        </p>
                                    )}

                                    {!questionSolved && (
                                        <div className={styles.ctaRow}>
                                            <Button
                                                onClick={handleAnswer}
                                                disabled={selectedOption === undefined || answerMicroDecision.isPending}
                                            >
                                                Responder
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </>
                    )}

                    <div className={styles.ctaRow}>
                        {navigation.canGoBack && (
                            <Button variant="secondary" onClick={handleBack} data-lesson-back="" aria-label="Voltar ao cartão anterior">
                                <ChevronLeft size={16} aria-hidden="true" />
                                Voltar
                            </Button>
                        )}
                        <Button
                            data-lesson-continue=""
                            onClick={() => handleCardContinue(microDecisionCards)}
                            disabled={(isMicroDecisionLastCard && !canAdvanceMicroDecision) || advanceLesson.isPending}
                        >
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 2 && (
                <section className={styles.card}>
                    <span className={styles.eyebrow}>Revelação</span>
                    <h1 className={styles.heading}>Por que isso importa</h1>
                    {answerSolved && (
                        <span className={styles.answerBadgeCorrect}>
                            {isReview || answer.firstTry
                                ? isReview
                                    ? 'Você acertou'
                                    : 'Você acertou de primeira'
                                : `Você acertou na ${answer.attempts}ª tentativa`}
                        </span>
                    )}
                    <CardBody card={revelationCards[subStep]} revealed={navigation.isRevealed} onReveal={handleReveal} lessons={lessons} />
                    {revelationCards.length > 1 && <CardDots total={revelationCards.length} current={subStep} />}

                    {isRevelationLastCard &&
                        isLiveIndicator &&
                        (indicatorAsset.isLoading ? (
                            <p className={styles.loading}>Carregando indicador ao vivo…</p>
                        ) : (
                            <EquityIndicatorsPanel indicators={indicatorAsset.asset?.equity?.indicators} />
                        ))}

                    {isRevelationLastCard &&
                        isLiveMacroIndicator &&
                        (macroIndicatorHistory.isLoading ? (
                            <p className={styles.loading}>Carregando indicador ao vivo…</p>
                        ) : (
                            <IndicatorSummaryCards
                                latest={macroIndicatorHistory.data?.indicators.at(-1)}
                                nextCopomSimulatedDay={nextCopomSimulatedDay(
                                    macroIndicatorHistory.data?.indicators.at(-1)?.simulated_day ?? 0,
                                )}
                            />
                        ))}

                    <div className={styles.ctaRow}>
                        {navigation.canGoBack && (
                            <Button variant="secondary" onClick={handleBack} data-lesson-back="" aria-label="Voltar ao cartão anterior">
                                <ChevronLeft size={16} aria-hidden="true" />
                                Voltar
                            </Button>
                        )}
                        <Button
                            onClick={() => handleCardContinue(revelationCards)}
                            disabled={advanceLesson.isPending}
                            data-lesson-continue=""
                        >
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 3 && (
                <section className={`${styles.card} ${styles.unlock}`}>
                    <span className={styles.unlockBadge} aria-hidden="true">
                        <Check size={22} strokeWidth={3} />
                    </span>
                    <span className={styles.eyebrow}>Desbloqueio</span>
                    <h1 className={styles.heading}>Lição concluída</h1>
                    <p className={styles.body}>{lesson.unlocksDescription || 'Você avançou mais um passo na trilha.'}</p>
                    <div className={styles.ctaRow}>
                        <Button variant="secondary" onClick={handleBack} data-lesson-back="" aria-label="Voltar ao passo anterior">
                            <ChevronLeft size={16} aria-hidden="true" />
                            Voltar
                        </Button>
                        <Button variant="secondary" onClick={goToTrack}>
                            Voltar pra Trilha
                        </Button>
                        {unlockAssetPath && <Button onClick={() => navigate(unlockAssetPath)}>Comprar agora</Button>}
                        {featureUnlockCta && <Button onClick={() => navigate(featureUnlockCta.path)}>{featureUnlockCta.label}</Button>}
                        <Button onClick={handleFinish} data-lesson-continue="">
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {advanceLesson.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível salvar seu progresso agora. Tente de novo.
                </p>
            )}
        </main>
    )
}

// Revelação progressiva (tarefa A.3) — cartão marcado `[revelar]` esconde o
// texto atrás de um botão "Ver resultado" até o toque; um `<button>` de
// verdade preserva a navegação por teclado (Tab alcança, Enter/Espaço
// ativa), sem precisar de nenhum tratamento especial.
function CardBody({ card, revealed, onReveal, lessons }: { card: Card; revealed: boolean; onReveal: () => void; lessons: LessonType[] }) {
    if (card.hidden && !revealed) {
        return (
            <button type="button" className={styles.revealButton} onClick={onReveal}>
                <Eye size={16} aria-hidden="true" />
                Ver resultado
            </button>
        )
    }

    return <p className={styles.body}>{renderLessonMarkup(card.text, lessons)}</p>
}

// Convenção `{{Termo}}`/`{{ref:X.Y}}` das tarefas C.1/C.2 — termo resolvido
// no catálogo vira popover (`GlossaryTerm`), referência de lição vira link
// pra ela (`ref` resolvido pro `id` real aqui, já que é aqui que a lista de
// `lessons` está disponível), e o resto do texto continua como nó de texto
// puro (não `<span>`) pra não quebrar consultas de teste que buscam o texto
// completo do cartão quando não há marcação nenhuma.
function renderLessonMarkup(text: string, lessons: LessonType[]) {
    return parseLessonMarkup(text).map((segment, index) => {
        if (segment.type === 'term') {
            return <GlossaryTerm key={index} term={segment.term} definition={segment.definition} />
        }

        if (segment.type === 'ref') {
            const referencedLesson = lessons.find((candidate) => candidate.code === segment.code)
            const label = `já visto na lição ${segment.code}`

            return referencedLesson ? (
                <Link key={index} to={`/trilha/${referencedLesson.id}`} className={styles.refLink}>
                    {label}
                </Link>
            ) : (
                label
            )
        }

        return segment.value
    })
}

// Barra de progresso fina interna à fase (tarefa A.1) — pontinhos menores
// que a barra de 4 segmentos, só aparece quando a fase tem mais de 1
// cartão. Decorativa: o único controle interativo continua sendo o botão
// "Continuar", então não interfere na navegação por teclado.
function CardDots({ total, current }: { total: number; current: number }) {
    return (
        <div className={styles.cardDots} aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
                <span
                    key={index}
                    className={[styles.cardDot, index < current && styles.done, index === current && styles.current]
                        .filter(Boolean)
                        .join(' ')}
                />
            ))}
        </div>
    )
}
