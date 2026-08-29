import { ArrowLeft, Check } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLessonQuery } from '../../features/lessons/useLessonQuery'
import { useLessonsQuery } from '../../features/lessons/useLessonsQuery'
import { useAdvanceLesson } from '../../features/lessons/useAdvanceLesson'
import { Button } from '../../components/atoms/Button'
import styles from './index.module.css'

const TOTAL_STEPS = 4

// Tela 3.2 (tarefa 6.4) — máquina de estado de 4 passos, mockup em
// https://claude.ai/code/artifact/50892817-9878-430c-8332-ee5e94b90b43.
// O schema de `lessons` só tem `centralConcept`/`unlocksDescription` como
// texto livre — não existe ainda um campo por passo (cenário/micro-decisão/
// revelação com fórmula real), isso é conteúdo pedagógico da tarefa 7.1
// (autoria das 33 lições, semana 7). Esta tela já entrega a estrutura de
// navegação/persistência de progresso completa; o texto de cada passo hoje
// reaproveita `centralConcept`, a ser substituído por conteúdo real na 7.1.
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

    const lesson = lessonQuery.data?.lesson
    const step = localStep ?? lesson?.currentStep ?? 0

    function goToTrack() {
        navigate('/trilha')
    }

    function handleAdvance() {
        advanceLesson.mutate(step + 1, { onSuccess: () => setLocalStep(step + 1) })
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
                    <p className={styles.body}>{lesson.centralConcept}</p>
                    <div className={styles.ctaRow}>
                        <Button onClick={handleAdvance} disabled={advanceLesson.isPending}>
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 1 && (
                <section className={styles.card}>
                    <span className={styles.eyebrow}>Micro-decisão</span>
                    <h1 className={styles.heading}>Pense antes de continuar</h1>
                    <p className={styles.body}>{lesson.centralConcept}</p>
                    <label className={styles.confirmRow}>
                        <input
                            type="checkbox"
                            checked={microDecisionConfirmed}
                            onChange={(event) => setMicroDecisionConfirmed(event.target.checked)}
                        />
                        Já pensei na minha resposta
                    </label>
                    <div className={styles.ctaRow}>
                        <Button onClick={handleAdvance} disabled={!microDecisionConfirmed || advanceLesson.isPending}>
                            Continuar
                        </Button>
                    </div>
                </section>
            )}

            {lesson && step === 2 && (
                <section className={styles.card}>
                    <span className={styles.eyebrow}>Revelação</span>
                    <h1 className={styles.heading}>Por que isso importa</h1>
                    <p className={styles.body}>{lesson.centralConcept}</p>
                    <div className={styles.ctaRow}>
                        <Button onClick={handleAdvance} disabled={advanceLesson.isPending}>
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
