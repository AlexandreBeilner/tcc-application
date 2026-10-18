import { useMutation } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../features/auth/AuthContext'
import { useReviewSession } from '../../features/lessons/useReviewSession'
import { parseCheckBlock } from '../../features/lessons/widgets/schema'
import type { CheckBlock } from '../../features/lessons/widgets/schema'
import { recordReviewResult } from '../../services/lessons'
import type { PracticeQuestion } from '../../services/lessons'
import { Button } from '../../components/atoms/Button'
import { PracticeCheckpoint } from '../../components/organisms/PracticeCheckpoint'
import type { PracticeOutcome } from '../../components/organisms/PracticeCheckpoint'
import styles from './index.module.css'

interface Question {
    lessonId: string
    lessonTitle: string
    block: CheckBlock
}

// Perguntas com contrato válido; uma fora do contrato só some da revisão.
function toQuestions(raw: PracticeQuestion[]): Question[] {
    return raw.flatMap((question) => {
        const block = parseCheckBlock(question.block)
        return block ? [{ lessonId: question.lessonId, lessonTitle: question.lessonTitle, block }] : []
    })
}

// Revisão de 1 minuto (LJ.5.6): 3 perguntas de lições já vistas, que a pessoa resolveu depois de errar. É
// prática, não prova: sem nota, sem XP e sem cronômetro; errar nunca trava (dá para pular) e o resultado só
// reagenda a pergunta (1, 3 e 7 dias). Mostra a revisão de quando a tela abriu: as perguntas não trocam no meio.
export function RevisaoRapida() {
    const sessionQuery = useReviewSession()

    return (
        <main className={styles.page}>
            <div className={styles.top}>
                <Link to="/trilha" className={styles.back}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Sair da revisão
                </Link>
            </div>

            {sessionQuery.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar a revisão agora. Tente novamente em instantes.
                </p>
            )}
            {!sessionQuery.data && !sessionQuery.isError && <p className={styles.loading}>Carregando revisão…</p>}
            {sessionQuery.data && !sessionQuery.data.ready && <NothingToReview />}
            {sessionQuery.data?.ready && <ReviewRun questions={toQuestions(sessionQuery.data.questions)} />}
        </main>
    )
}

function NothingToReview() {
    return (
        <section className={styles.card}>
            <h1 className={styles.heading}>Nada para revisar agora</h1>
            <p className={styles.text}>Quando houver perguntas para fixar, o convite aparece nas Trilhas.</p>
            <div className={styles.actions}>
                <Link to="/trilha">
                    <Button>Voltar pra Trilha</Button>
                </Link>
            </div>
        </section>
    )
}

function ReviewRun({ questions }: { questions: Question[] }) {
    const navigate = useNavigate()
    const { token } = useAuth()
    const [index, setIndex] = useState(0)
    // Acertos "de primeira" desta revisão, por pergunta (só para o resumo final).
    const [firstTry, setFirstTry] = useState<Record<string, boolean>>({})
    // Congelada na abertura: depois de gravar os resultados o servidor já não devolve estas perguntas (o hub
    // busca de novo ao abrir, então o cartão some sozinho).
    const [session] = useState(questions)
    const record = useMutation({
        mutationFn: ({ question, correct }: { question: Question; correct: boolean }) =>
            recordReviewResult(token as string, question.lessonId, question.block.id, correct),
    })

    const done = index >= session.length
    const current = session[index]

    function settle(question: Question, outcome: PracticeOutcome) {
        setFirstTry((previous) => ({ ...previous, [question.block.id]: outcome.solved && !outcome.missed }))
        record.mutate({ question, correct: outcome.solved && !outcome.missed })
    }

    function next() {
        setIndex(index + 1)
    }

    if (session.length === 0) return <NothingToReview />

    if (done) {
        const hits = Object.values(firstTry).filter(Boolean).length
        return (
            <section className={styles.card}>
                <span className={styles.eyebrow}>Revisão de 1 minuto</span>
                <h1 className={styles.heading}>Revisão feita</h1>
                <p className={styles.text}>
                    {hits} de {session.length} de primeira. As perguntas voltam mais adiante, no seu tempo.
                </p>
                <div className={styles.actions}>
                    <Button onClick={() => navigate('/trilha')} data-lesson-continue="">
                        Voltar pra Trilha
                    </Button>
                </div>
            </section>
        )
    }

    return (
        <section className={styles.card}>
            <span className={styles.eyebrow}>Revisão de 1 minuto</span>
            <h1 className={styles.heading}>
                Pergunta {index + 1} de {session.length}
            </h1>
            <PracticeCheckpoint
                key={current.block.id}
                lessonId={current.lessonId}
                lessonTitle={current.lessonTitle}
                block={current.block}
                badge="Revisão"
                onSettle={(outcome) => settle(current, outcome)}
                onContinue={next}
            />
            {record.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível guardar o resultado agora. Você pode seguir.
                </p>
            )}
        </section>
    )
}
