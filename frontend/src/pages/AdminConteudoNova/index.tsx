import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '../../components/atoms/Button'
import { LessonWorkbench } from '../../components/organisms/LessonWorkbench'
import { describeLessonError } from '../../features/admin/lessonCatalog'
import { draftToContent, emptyDraft } from '../../features/admin/lessonDraft'
import type { LessonDraft } from '../../features/admin/lessonDraft'
import { useAdminLessonsQuery, useCreateLessonMutation } from '../../features/admin/useAdminLessons'
import styles from './index.module.css'

const AT_START = '__start__'

// Tela de criação de lição (N.23): `/admin/conteudo/nova`. A lição entra logo depois da lição escolhida, na
// trilha dela. Quem já passou daquele ponto não é bloqueado (recebe a lição como opcional); quem ainda não
// chegou é bloqueado por ela normalmente. Não há exclusão: depois de criada, só despublicar.
export function AdminConteudoNova() {
    const navigate = useNavigate()
    const lessonsQuery = useAdminLessonsQuery()
    const create = useCreateLessonMutation()
    const [draft, setDraft] = useState<LessonDraft>(emptyDraft)
    const [after, setAfter] = useState<string>('')
    const [error, setError] = useState<string | null>(null)

    const lessons = lessonsQuery.data ?? []
    const refs = lessons.map((item) => ({ id: item.id, code: item.code }))
    const anchor = lessons.find((item) => item.id === after)
    const ready = after !== '' && draft.title.trim().length > 0 && draft.centralConcept.trim().length > 0

    function submit() {
        setError(null)
        create.mutate(
            { ...draftToContent(draft), after_lesson_id: after === AT_START ? null : after },
            {
                onSuccess: (result) =>
                    navigate(`/admin/conteudo/${result.lesson.id}`, {
                        replace: true,
                        state: {
                            notice: `Lição ${result.lesson.code} criada.${
                                result.waived_users > 0
                                    ? ` ${result.waived_users} usuário(s) que já tinham passado desse ponto receberam a lição como opcional.`
                                    : ''
                            }`,
                        },
                    }),
                onError: (err) => setError(describeLessonError(err)),
            },
        )
    }

    return (
        <main className={styles.page}>
            <Link to="/admin/conteudo" className={styles.back}>
                Voltar para Conteúdo
            </Link>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Nova lição</h1>
                    <p className={styles.subtitle}>
                        Escolha onde ela entra e escreva o conteúdo. Quem já passou desse ponto da trilha recebe a lição como opcional; quem
                        ainda não chegou é bloqueado por ela normalmente.
                    </p>
                </div>
                <div className={styles.actions}>
                    <Button onClick={submit} disabled={!ready || create.isPending}>
                        {create.isPending ? 'Criando…' : 'Criar lição'}
                    </Button>
                </div>
            </header>

            <div className={styles.position}>
                <label htmlFor="after-lesson" className={styles.label}>
                    Entra depois de
                </label>
                <select
                    id="after-lesson"
                    className={styles.select}
                    value={after}
                    disabled={create.isPending}
                    onChange={(e) => setAfter(e.target.value)}
                >
                    <option value="">Escolha uma lição</option>
                    <option value={AT_START}>No início do currículo</option>
                    {lessons.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.code} · {item.title}
                            {item.published ? '' : ' (despublicada)'}
                        </option>
                    ))}
                </select>
                {anchor && (
                    <span className={styles.hint}>
                        Fica na {anchor.track_name}, logo depois da lição {anchor.code}.
                    </span>
                )}
            </div>

            {error && (
                <p className={styles.error} role="alert">
                    {error}
                </p>
            )}

            <LessonWorkbench draft={draft} onChange={setDraft} disabled={create.isPending} lessons={refs} />
        </main>
    )
}
