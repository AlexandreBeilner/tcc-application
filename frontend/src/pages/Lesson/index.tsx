import { ArrowLeft, Check } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLessonQuery } from '../../features/lessons/useLessonQuery'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { useAdvanceLesson } from '../../features/lessons/useAdvanceLesson'
import { useReviewLesson } from '../../features/lessons/useReviewLesson'
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
import { LessonCardBody, LessonCardDots } from '../../components/molecules/LessonCardText'
import type { Lesson as LessonType } from '../../services/lessons'
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

    const [localStep, setLocalStep] = useState<number | undefined>(undefined)
    // Aposta com acerto/erro real (backlog engajamento B.3) — índice
    // escolhido pelo usuário no widget de opções reais. Só sustenta a UI do
    // botão (`aria-pressed`) e habilita "Continuar"; o veredito em si vem do
    // servidor (`microDecisionResult` abaixo, correção da revisão da PR 18 —
    // `Lesson.microDecisionCorrectOption` não existe mais, comparar aqui
    // vazaria a resposta certa via `GET /lessons` antes de qualquer escolha).
    const [selectedOption, setSelectedOption] = useState<number | undefined>(undefined)
    // Veredito da aposta (B.3), devolvido por `POST /lessons/:id/progress`
    // só na chamada que envia `selectedOption` — nunca lido de volta de
    // `GET /lessons`/`GET /lessons/:id` (mesma razão do comentário acima).
    const [microDecisionResult, setMicroDecisionResult] = useState<{ correct: boolean; correctOptionLabel: string } | undefined>(undefined)
    // Navegação entre cartões (tarefa A.1) dentro da fase atual — estado
    // local, não persistido (a persistência de progresso continua sendo só
    // o `step` de fase, spec 5.2). Reseta pra 0 a cada avanço real de fase.
    const [subStep, setSubStep] = useState(0)
    // Cartões `[revelar]` (tarefa A.3) — índice (dentro da fase atual) já
    // revelado pelo toque em "Ver resultado". Reseta junto com `subStep` a
    // cada avanço real de fase, mesmo motivo: índice só faz sentido dentro
    // do array de cartões da fase corrente.
    const [revealedIndexes, setRevealedIndexes] = useState<Set<number>>(new Set())

    const lesson = lessonQuery.data?.lesson
    // Referência cruzada entre lições (tarefa C.2, `{{ref:2.1}}`) resolve o
    // `code` citado pro `id` real usando esta mesma lista, sem chamada nova.
    const lessons = lessonsQuery.data?.lessons ?? []
    const step = localStep ?? lesson?.currentStep ?? 0

    // Backlog engajamento H.2 — reabrir uma lição já concluída (modo
    // revisão acima, jump direto pro Desbloqueio) é, por si só, o "revisar"
    // que a missão espera: registra uma vez por montagem (`key={lessonId}`
    // no componente pai já garante um `reviewedRef` novo por lição
    // reaberta), sem precisar de nenhuma ação extra do usuário. Backend
    // decide se a lição é antiga o bastante pra valer pra missão.
    const reviewedRef = useRef(false)
    useEffect(() => {
        if (lesson?.status === 'completed' && !reviewedRef.current) {
            reviewedRef.current = true
            reviewLesson.mutate()
        }
    }, [lesson?.status, reviewLesson])

    const isLiveIndicator = lesson?.microDecisionType === 'live_indicator'
    const indicatorAsset = useAssetByTicker(isLiveIndicator ? (lesson?.microDecisionAssetTicker ?? null) : null)
    const isLiveMacroIndicator = lesson?.microDecisionType === 'live_macro_indicator'
    const macroIndicatorHistory = useIndicatorHistoryQuery(LIVE_MACRO_INDICATOR_WINDOW_DAYS, { enabled: isLiveMacroIndicator })
    const unlockAsset = useAssetByTicker(lesson?.unlocksAssetTicker ?? null)

    const usesEmbeddedWidget = lesson ? EMBEDDED_WIDGET_TYPES.has(lesson.microDecisionType) : false
    const hasRealOptions = (lesson?.microDecisionOptions?.length ?? 0) > 0
    const canAdvanceMicroDecision = usesEmbeddedWidget || !hasRealOptions || selectedOption !== undefined
    // Badge de acerto/erro da Revelação (B.3) — só existe quando o servidor
    // já devolveu o veredito desta escolha (`handleAdvance` abaixo grava em
    // `microDecisionResult` no `onSuccess` do avanço que saiu do passo
    // Micro-decisão com `selectedOption`).
    const microDecisionAnswered = microDecisionResult !== undefined
    const microDecisionCorrect = microDecisionResult?.correct ?? false
    const correctOptionLabel = microDecisionResult?.correctOptionLabel
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

    function goToTrack() {
        navigate('/trilha')
    }

    function handleAdvance() {
        // `selectedOption` só viaja na chamada que sai do passo Micro-decisão
        // (step 1) de uma lição com aposta real — nas demais transições o
        // campo nem existe no payload (`useAdvanceLesson`/`services/lessons`).
        const optionToSend = step === 1 && hasRealOptions ? selectedOption : undefined
        advanceLesson.mutate(
            { step: step + 1, selectedOption: optionToSend },
            {
                onSuccess: (data) => {
                    if (data.microDecisionCorrect !== undefined) {
                        setMicroDecisionResult({
                            correct: data.microDecisionCorrect,
                            correctOptionLabel: data.correctOptionLabel ?? '',
                        })
                    }
                    setLocalStep(step + 1)
                    setSubStep(0)
                    setRevealedIndexes(new Set())
                },
            },
        )
    }

    // Cartão intermediário: só avança o `subStep` local. Cartão final da
    // fase: avança a fase de verdade (`handleAdvance`), mesmo gate de
    // habilitação que já existia (`disabled` no botão continua cuidando disso).
    function handleCardContinue(cards: Card[]) {
        if (subStep < cards.length - 1) {
            setSubStep((current) => current + 1)
        } else {
            handleAdvance()
        }
    }

    function handleReveal() {
        setRevealedIndexes((current) => new Set(current).add(subStep))
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
                    <LessonCardBody
                        card={scenarioCards[subStep]}
                        revealed={revealedIndexes.has(subStep)}
                        onReveal={handleReveal}
                        lessons={lessons}
                    />
                    {scenarioCards.length > 1 && <LessonCardDots total={scenarioCards.length} current={subStep} />}
                    <div className={styles.ctaRow}>
                        <Button onClick={() => handleCardContinue(scenarioCards)} disabled={advanceLesson.isPending}>
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 1 && (
                <section className={styles.card}>
                    <span className={styles.eyebrow}>Micro-decisão</span>
                    <h1 className={styles.heading}>Pense antes de continuar</h1>
                    <LessonCardBody
                        card={microDecisionCards[subStep]}
                        revealed={revealedIndexes.has(subStep)}
                        onReveal={handleReveal}
                        lessons={lessons}
                    />
                    {microDecisionCards.length > 1 && <LessonCardDots total={microDecisionCards.length} current={subStep} />}

                    {isMicroDecisionLastCard && (
                        <>
                            {lesson.microDecisionType === 'growth_calculator' && <GrowthCalculatorForm />}
                            {lesson.microDecisionType === 'fixed_income_comparison' && <FixedIncomeComparisonForm />}

                            {!usesEmbeddedWidget && hasRealOptions && (
                                <div className={styles.optionsList} role="group" aria-label="Escolha uma opção">
                                    {lesson.microDecisionOptions?.map((option, index) => (
                                        <button
                                            key={option}
                                            type="button"
                                            aria-pressed={selectedOption === index}
                                            className={[styles.optionButton, selectedOption === index && styles.optionSelected]
                                                .filter(Boolean)
                                                .join(' ')}
                                            onClick={() => setSelectedOption(index)}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    <div className={styles.ctaRow}>
                        <Button
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
                    {microDecisionAnswered &&
                        (microDecisionCorrect ? (
                            <span className={styles.answerBadgeCorrect}>Você acertou</span>
                        ) : (
                            <span className={styles.answerBadgeAlmost}>Quase. A resposta certa era: {correctOptionLabel}</span>
                        ))}
                    <LessonCardBody
                        card={revelationCards[subStep]}
                        revealed={revealedIndexes.has(subStep)}
                        onReveal={handleReveal}
                        lessons={lessons}
                    />
                    {revelationCards.length > 1 && <LessonCardDots total={revelationCards.length} current={subStep} />}

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
                        <Button onClick={() => handleCardContinue(revelationCards)} disabled={advanceLesson.isPending}>
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
                        <Button variant="secondary" onClick={goToTrack}>
                            Voltar pra Trilha
                        </Button>
                        {unlockAssetPath && <Button onClick={() => navigate(unlockAssetPath)}>Comprar agora</Button>}
                        {featureUnlockCta && <Button onClick={() => navigate(featureUnlockCta.path)}>{featureUnlockCta.label}</Button>}
                        <Button onClick={handleFinish}>Continuar</Button>
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
