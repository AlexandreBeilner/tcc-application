import { ArrowLeft, Check, Eye } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLessonQuery } from '../../features/lessons/useLessonQuery'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { useAdvanceLesson } from '../../features/lessons/useAdvanceLesson'
import { Button } from '../../components/atoms/Button'
import { GrowthCalculatorForm } from '../../components/organisms/GrowthCalculatorForm'
import { FixedIncomeComparisonForm } from '../../components/organisms/FixedIncomeComparisonForm'
import { EquityIndicatorsPanel } from '../../components/organisms/EquityIndicatorsPanel'
import { assetDetailPath } from '../../features/market/assetDetailPath'
import { useAssetByTicker } from '../../features/market/useAssetByTicker'
import { featureUnlockCtaFor } from '../../features/lessons/featureUnlockCta'
import { splitIntoCards } from '../../features/lessons/splitIntoCards'
import type { Card } from '../../features/lessons/splitIntoCards'
import { parseLessonMarkup } from '../../features/lessons/parseLessonMarkup'
import { GlossaryTerm } from '../../components/molecules/GlossaryTerm'
import type { Lesson as LessonType } from '../../services/lessons'
import styles from './index.module.css'

const TOTAL_STEPS = 4

// Widget do passo Micro-decisão que não precisa do checkbox "já pensei" —
// os dois embutem um componente já existente (tarefa 6.7) que já traz sua
// própria interação. Os outros dois (`reflection`, `live_indicator`)
// mantêm o checkbox (tarefa 7.0.2 — a revelação de `live_indicator` busca
// o indicador ao vivo, mas a micro-decisão em si continua sendo reflexão).
const EMBEDDED_WIDGET_TYPES = new Set<LessonType['microDecisionType']>(['growth_calculator', 'fixed_income_comparison'])

// Tela 3.2 (tarefa 6.4/7.0.2) — máquina de estado de 4 passos, mockup em
// https://claude.ai/code/artifact/50892817-9878-430c-8332-ee5e94b90b43.
// Antes da 7.0.2, o schema de `lessons` só tinha `centralConcept`/
// `unlocksDescription` como texto livre e esta tela reaproveitava
// `centralConcept` idêntico nos 3 primeiros passos (pendência sinalizada
// desde a 6.4). Agora cada passo renderiza seu próprio campo real
// (`scenarioText`/`microDecisionPrompt`/`revelationText`), o widget de
// Micro-decisão varia por `microDecisionType`, a Revelação de uma lição
// `live_indicator` busca o indicador real via `GET /market/assets/:id`, e
// o Desbloqueio ganha "Comprar agora" quando `unlocksAssetTicker` existe.
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

    const [localStep, setLocalStep] = useState<number | undefined>(undefined)
    const [microDecisionConfirmed, setMicroDecisionConfirmed] = useState(false)
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

    const isLiveIndicator = lesson?.microDecisionType === 'live_indicator'
    const indicatorAsset = useAssetByTicker(isLiveIndicator ? (lesson?.microDecisionAssetTicker ?? null) : null)
    const unlockAsset = useAssetByTicker(lesson?.unlocksAssetTicker ?? null)

    const usesEmbeddedWidget = lesson ? EMBEDDED_WIDGET_TYPES.has(lesson.microDecisionType) : false
    const canAdvanceMicroDecision = usesEmbeddedWidget || microDecisionConfirmed
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
        advanceLesson.mutate(step + 1, {
            onSuccess: () => {
                setLocalStep(step + 1)
                setSubStep(0)
                setRevealedIndexes(new Set())
            },
        })
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
                    <CardBody card={scenarioCards[subStep]} revealed={revealedIndexes.has(subStep)} onReveal={handleReveal} lessons={lessons} />
                    {scenarioCards.length > 1 && <CardDots total={scenarioCards.length} current={subStep} />}
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
                    <CardBody card={microDecisionCards[subStep]} revealed={revealedIndexes.has(subStep)} onReveal={handleReveal} lessons={lessons} />
                    {microDecisionCards.length > 1 && <CardDots total={microDecisionCards.length} current={subStep} />}

                    {isMicroDecisionLastCard && (
                        <>
                            {lesson.microDecisionType === 'growth_calculator' && <GrowthCalculatorForm />}
                            {lesson.microDecisionType === 'fixed_income_comparison' && <FixedIncomeComparisonForm />}

                            {!usesEmbeddedWidget && (
                                <label className={styles.confirmRow}>
                                    <input
                                        type="checkbox"
                                        checked={microDecisionConfirmed}
                                        onChange={(event) => setMicroDecisionConfirmed(event.target.checked)}
                                    />
                                    Já pensei na minha resposta
                                </label>
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
                    <CardBody card={revelationCards[subStep]} revealed={revealedIndexes.has(subStep)} onReveal={handleReveal} lessons={lessons} />
                    {revelationCards.length > 1 && <CardDots total={revelationCards.length} current={subStep} />}

                    {isRevelationLastCard &&
                        isLiveIndicator &&
                        (indicatorAsset.isLoading ? (
                            <p className={styles.loading}>Carregando indicador ao vivo…</p>
                        ) : (
                            <EquityIndicatorsPanel indicators={indicatorAsset.asset?.equity?.indicators} />
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

// Revelação progressiva (tarefa A.3) — cartão marcado `[revelar]` esconde o
// texto atrás de um botão "Ver resultado" até o toque; um `<button>` de
// verdade preserva a navegação por teclado (Tab alcança, Enter/Espaço
// ativa), sem precisar de nenhum tratamento especial.
function CardBody({
    card,
    revealed,
    onReveal,
    lessons,
}: {
    card: Card
    revealed: boolean
    onReveal: () => void
    lessons: LessonType[]
}) {
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
