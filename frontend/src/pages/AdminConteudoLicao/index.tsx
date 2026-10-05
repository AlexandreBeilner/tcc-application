import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { LessonRevisionList } from '../../components/organisms/LessonRevisionList'
import { LessonWorkbench } from '../../components/organisms/LessonWorkbench'
import { describeLessonError } from '../../features/admin/lessonCatalog'
import { draftFromContent, draftToContent, isDraftDirty } from '../../features/admin/lessonDraft'
import type { LessonDraft } from '../../features/admin/lessonDraft'
import {
    useAdminLessonQuery,
    useAdminLessonsQuery,
    useRestoreLessonRevisionMutation,
    useUpdateLessonMutation,
} from '../../features/admin/useAdminLessons'
import type { AdminLessonForEdit } from '../../services/admin'
import styles from './index.module.css'

// Tela de edição de uma lição (N.23): `/admin/conteudo/:id`. O banco é a fonte da verdade do conteúdo, então
// o que se salva aqui vale na hora pra todos os usuários; cada edição vira uma revisão restaurável.
export function AdminConteudoLicao() {
    const { id } = useParams<{ id: string }>()
    const lessonId = id as string
    const location = useLocation()
    const query = useAdminLessonQuery(lessonId)
    // O retorno da ação mora aqui, não no editor: depois de salvar ou restaurar o editor é remontado (ver `key`
    // abaixo) e perderia a mensagem.
    const [notice, setNotice] = useState<string | null>((location.state as { notice?: string } | null)?.notice ?? null)
    const [warnings, setWarnings] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)

    return (
        <main className={styles.page}>
            <Link to="/admin/conteudo" className={styles.back}>
                Voltar para Conteúdo
            </Link>
            {query.isLoading && <p className={styles.muted}>Carregando lição…</p>}
            {query.isError && (
                <p className={styles.error} role="alert">
                    Não foi possível carregar esta lição. Ela pode não existir.
                </p>
            )}

            {notice && (
                <p className={styles.notice} role="status">
                    {notice}
                </p>
            )}
            {warnings.length > 0 && (
                <ul className={styles.warnings} aria-label="Avisos">
                    {warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                    ))}
                </ul>
            )}
            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            {query.data && (
                // `key` pela última revisão: depois de salvar ou restaurar, o formulário recomeça do conteúdo salvo.
                <Editor
                    key={query.data.revisions[0]?.id ?? 'sem-revisao'}
                    lessonId={lessonId}
                    data={query.data}
                    onFeedback={(next) => {
                        setNotice(next.notice ?? null)
                        setWarnings(next.warnings ?? [])
                        setError(next.error ?? null)
                    }}
                />
            )}
        </main>
    )
}

interface Feedback {
    notice?: string
    warnings?: string[]
    error?: string
}

interface EditorProps {
    lessonId: string
    data: AdminLessonForEdit
    onFeedback: (feedback: Feedback) => void
}

function Editor({ lessonId, data, onFeedback }: EditorProps) {
    const { lesson, revisions } = data
    const lessonsQuery = useAdminLessonsQuery()
    const update = useUpdateLessonMutation(lessonId)
    const restore = useRestoreLessonRevisionMutation(lessonId)
    const [draft, setDraft] = useState<LessonDraft>(() => draftFromContent(lesson))

    const dirty = isDraftDirty(draft, lesson)
    const refs = (lessonsQuery.data ?? []).map((item) => ({ id: item.id, code: item.code }))

    function save() {
        onFeedback({})
        update.mutate(draftToContent(draft), {
            onSuccess: (result) =>
                onFeedback({ notice: 'Lição salva. O conteúdo já vale para todos os usuários.', warnings: result.warnings }),
            onError: (err) => onFeedback({ error: describeLessonError(err) }),
        })
    }

    function restoreRevision(revisionId: string) {
        onFeedback({})
        restore.mutate(revisionId, {
            onSuccess: (result) => onFeedback({ notice: 'Revisão restaurada.', warnings: result.warnings }),
            onError: (err) => onFeedback({ error: describeLessonError(err) }),
        })
    }

    return (
        <>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>
                        {lesson.code} · {lesson.title}
                    </h1>
                    <p className={styles.subtitle}>
                        {lesson.track_name}
                        {lesson.published ? '' : ' · despublicada'}. Código, trilha e posição não mudam por aqui.
                    </p>
                </div>
                <div className={styles.actions}>
                    <Button onClick={save} disabled={!dirty || update.isPending}>
                        {update.isPending ? 'Salvando…' : 'Salvar'}
                    </Button>
                </div>
            </header>

            <LessonWorkbench draft={draft} onChange={setDraft} disabled={update.isPending} lessons={refs} />

            <section className={styles.history}>
                <h2 className={styles.sectionTitle}>Histórico de revisões</h2>
                <LessonRevisionList
                    lessonId={lessonId}
                    revisions={revisions}
                    current={lesson}
                    restoring={restore.isPending}
                    onRestore={restoreRevision}
                />
            </section>
        </>
    )
}
