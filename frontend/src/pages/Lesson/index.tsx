import { ArrowLeft, Check, ChevronLeft } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLessonQuery } from '../../features/lessons/useLessonQuery'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { useAdvanceLesson } from '../../features/lessons/useAdvanceLesson'
import { useCardReach } from '../../features/lessons/useCardReach'
import { useCheckpoints } from '../../features/lessons/useCheckpoints'
import { useAnswerMicroDecision } from '../../features/lessons/useAnswerMicroDecision'
import { useReviewLesson } from '../../features/lessons/useReviewLesson'
import { useLessonNavigation } from '../../features/lessons/useLessonNavigation'
import { Button } from '../../components/atoms/Button'
import { LockedGate } from '../../components/organisms/LockedGate'
import { LessonCheckpoint } from '../../components/organisms/LessonCheckpoint'
import { LessonWidget } from '../../components/organisms/LessonWidget'
import { assetDetailPath } from '../../features/market/assetDetailPath'
import { useAssetByTicker } from '../../features/market/useAssetByTicker'
import { featureUnlockCtaFor } from '../../features/lessons/featureUnlockCta'
import { buildPhaseCards, termsSeenBeforeEachCard } from '../../features/lessons/playerCards'
import type { PlayerCard } from '../../features/lessons/playerCards'
import { parseLessonBlocks } from '../../features/lessons/widgets/schema'
import type { CheckBlock, WidgetBlock } from '../../features/lessons/widgets/schema'
import { LessonCardBody, LessonCardDots } from '../../components/molecules/LessonCardText'
import type { AnswerMicroDecisionResult, Lesson as LessonType } from '../../services/lessons'
import styles from './index.module.css'

const TOTAL_STEPS = 4

// Widget do passo Micro-decisão que traz a própria interação (tarefa 6.7),
// então a pergunta com opções reais (`hasQuestionGate`) não se aplica a ele.
// Os outros três (`reflection`, `live_indicator`, `live_macro_indicator`)
// usam a pergunta normalmente (tarefa 7.0.2/M.5 — a revelação dos dois
// últimos busca o indicador ao vivo, mas a micro-decisão em si continua
// sendo uma pergunta).
const EMBEDDED_WIDGET_TYPES = new Set<LessonType['microDecisionType']>(['growth_calculator', 'fixed_income_comparison'])

// Widgets legados por `microDecisionType` (lição sem `blocks`) passam pelo
// mesmo registro dos blocos novos (RC.3.1).
const LEGACY_WIDGET_BLOCKS: Record<string, WidgetBlock> = {
    growth_calculator: { type: 'widget', id: 'legacy-growth-calculator', widget: 'growth-calculator', props: {} },
    fixed_income_comparison: { type: 'widget', id: 'legacy-fixed-income-comparison', widget: 'fixed-income-comparison', props: {} },
    live_macro_indicator: { type: 'widget', id: 'legacy-live-macro', widget: 'live-macro', props: {} },
}

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
    // Lição bloqueada aberta por URL (achado 039): o backend responde 404, mas a
    // lista já diz que ela está `locked`. O CTA aponta pra primeira lição que o
    // usuário já pode fazer, nunca pra uma ainda inacessível.
    const lockedLesson = lessons.some((l) => l.id === lessonId && l.status === 'locked')
    const nextAvailableLesson = lessons.find((l) => l.status === 'available')
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
    // Funil por cartão (LJ.5.1): só fora de revisão, e só depois de saber se é revisão.
    useCardReach(lessonId, { phase: step, card: subStep }, lesson !== undefined && isReview === false)

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

    // Conteúdo por blocos (RC.3.1): fase sem blocos usa o texto legado e os
    // widgets legados por `microDecisionType`, igual a antes.
    const blocks = useMemo(() => parseLessonBlocks(lesson?.blocks), [lesson?.blocks])
    // Perguntas intermediárias (RC.3.2): estado restaurado do servidor + sessão.
    const checkpoints = useCheckpoints(lessonId, lesson?.checkpoints, isReview === true)
    const microDecisionHasBlocks = (blocks?.phases.microDecision.length ?? 0) > 0
    const revelationHasBlocks = (blocks?.phases.revelation.length ?? 0) > 0
    const isLiveIndicator = lesson?.microDecisionType === 'live_indicator'
    const isLiveMacroIndicator = lesson?.microDecisionType === 'live_macro_indicator'
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

    const scenarioCards = buildPhaseCards(blocks?.phases.scenario, lesson?.scenarioText ?? '')
    const microDecisionCards = buildPhaseCards(blocks?.phases.microDecision, lesson?.microDecisionPrompt ?? '')
    const revelationCards = buildPhaseCards(blocks?.phases.revelation, lesson?.revelationText ?? '')
    const termsSeenBefore = termsSeenBeforeEachCard([...scenarioCards, ...microDecisionCards, ...revelationCards])
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
    function handleCardContinue(cards: PlayerCard[]) {
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

    // Pergunta intermediária ainda não resolvida segura o Continuar do cartão
    // dela (RC.3.2); em revisão de lição concluída nada trava.
    function checkpointBlocking(card: PlayerCard | undefined): boolean {
        return !isReview && card?.kind === 'check' && !checkpoints.viewFor(card.block.id).solved
    }

    function renderCheckpoint(block: CheckBlock) {
        return (
            <LessonCheckpoint
                key={block.id}
                block={block}
                view={checkpoints.viewFor(block.id)}
                pending={checkpoints.isPending}
                error={checkpoints.isError}
                isReview={isReview === true}
                onSubmit={(response) => checkpoints.submit(block, response)}
            />
        )
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

            {lessonQuery.isError && lockedLesson && (
                <LockedGate variant="screen" lessonId={nextAvailableLesson?.id} lessonTitle={nextAvailableLesson?.title} />
            )}

            {lessonQuery.isError && !lockedLesson && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar esta lição agora. Ela pode estar bloqueada ou não existir.
                </p>
            )}

            {!lesson && !lessonQuery.isError && <p className={styles.loading}>Carregando lição…</p>}

            {lesson && step === 0 && (
                <section className={cardClassName(scenarioCards[subStep])}>
                    <span className={styles.eyebrow}>Cenário</span>
                    <h1 className={styles.heading}>{lesson.title}</h1>
                    <CardBody
                        card={scenarioCards[subStep]}
                        renderCheckpoint={renderCheckpoint}
                        revealed={navigation.isRevealed}
                        onReveal={handleReveal}
                        lessons={lessons}
                        termsSeen={termsSeenBefore.get(scenarioCards[subStep])}
                    />
                    {scenarioCards.length > 1 && <LessonCardDots total={scenarioCards.length} current={subStep} />}
                    <div className={styles.ctaRow}>
                        {navigation.canGoBack && (
                            <Button variant="secondary" onClick={handleBack} data-lesson-back="" aria-label="Voltar ao cartão anterior">
                                <ChevronLeft size={16} aria-hidden="true" />
                                Voltar
                            </Button>
                        )}
                        <Button
                            onClick={() => handleCardContinue(scenarioCards)}
                            disabled={advanceLesson.isPending || checkpointBlocking(scenarioCards[subStep])}
                            data-lesson-continue=""
                        >
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 1 && (
                <section className={cardClassName(microDecisionCards[subStep])}>
                    <span className={styles.eyebrow}>Micro-decisão</span>
                    <h1 className={styles.heading}>Pense antes de continuar</h1>
                    <CardBody
                        card={microDecisionCards[subStep]}
                        renderCheckpoint={renderCheckpoint}
                        revealed={navigation.isRevealed}
                        onReveal={handleReveal}
                        lessons={lessons}
                        termsSeen={termsSeenBefore.get(microDecisionCards[subStep])}
                    />
                    {microDecisionCards.length > 1 && <LessonCardDots total={microDecisionCards.length} current={subStep} />}

                    {isMicroDecisionLastCard && (
                        <>
                            {!microDecisionHasBlocks && lesson.microDecisionType === 'growth_calculator' && (
                                <LessonWidget block={LEGACY_WIDGET_BLOCKS.growth_calculator} />
                            )}
                            {!microDecisionHasBlocks && lesson.microDecisionType === 'fixed_income_comparison' && (
                                <LessonWidget block={LEGACY_WIDGET_BLOCKS.fixed_income_comparison} />
                            )}

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
                            disabled={
                                (isMicroDecisionLastCard && !canAdvanceMicroDecision) ||
                                advanceLesson.isPending ||
                                checkpointBlocking(microDecisionCards[subStep])
                            }
                        >
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 2 && (
                <section className={cardClassName(revelationCards[subStep])}>
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
                    <CardBody
                        card={revelationCards[subStep]}
                        renderCheckpoint={renderCheckpoint}
                        revealed={navigation.isRevealed}
                        onReveal={handleReveal}
                        lessons={lessons}
                        termsSeen={termsSeenBefore.get(revelationCards[subStep])}
                    />
                    {revelationCards.length > 1 && <LessonCardDots total={revelationCards.length} current={subStep} />}

                    {isRevelationLastCard && !revelationHasBlocks && isLiveIndicator && lesson.microDecisionAssetTicker && (
                        <LessonWidget
                            block={{
                                type: 'widget',
                                id: 'legacy-live-indicator',
                                widget: 'live-indicator',
                                props: { ticker: lesson.microDecisionAssetTicker },
                            }}
                        />
                    )}

                    {isRevelationLastCard && !revelationHasBlocks && isLiveMacroIndicator && (
                        <LessonWidget block={LEGACY_WIDGET_BLOCKS.live_macro_indicator} />
                    )}

                    <div className={styles.ctaRow}>
                        {navigation.canGoBack && (
                            <Button variant="secondary" onClick={handleBack} data-lesson-back="" aria-label="Voltar ao cartão anterior">
                                <ChevronLeft size={16} aria-hidden="true" />
                                Voltar
                            </Button>
                        )}
                        <Button
                            onClick={() => handleCardContinue(revelationCards)}
                            disabled={advanceLesson.isPending || checkpointBlocking(revelationCards[subStep])}
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

// Cartão de widget ganha composição própria no desktop (texto à esquerda,
// widget à direita, ver `.hasWidget` no CSS); os demais seguem a coluna única.
function cardClassName(card: PlayerCard | undefined): string {
    return card?.kind === 'widget' ? `${styles.card} ${styles.hasWidget}` : styles.card
}

// Revelação progressiva (tarefa A.3) — cartão marcado `[revelar]` esconde o
// texto atrás de um botão "Ver resultado" até o toque; um `<button>` de
// verdade preserva a navegação por teclado (Tab alcança, Enter/Espaço
// ativa), sem precisar de nenhum tratamento especial.
function CardBody({
    renderCheckpoint,
    card,
    revealed,
    onReveal,
    lessons,
    termsSeen,
}: {
    renderCheckpoint: (block: CheckBlock) => React.ReactNode
    card: PlayerCard
    revealed: boolean
    onReveal: () => void
    lessons: LessonType[]
    termsSeen?: Set<string>
}) {
    if (card.kind === 'check') {
        return <>{renderCheckpoint(card.block)}</>
    }

    if (card.kind === 'widget') {
        return (
            <div className={styles.widgetStage}>
                <LessonWidget block={card.block} />
            </div>
        )
    }

    return <LessonCardBody card={card} revealed={revealed} onReveal={onReveal} lessons={lessons} termsSeen={termsSeen} />
}
