import { draftToContent } from '../../../features/admin/lessonDraft'
import type { LessonDraft } from '../../../features/admin/lessonDraft'
import type { LessonRef } from '../../molecules/LessonCardText'
import { LessonEditorForm } from '../LessonEditorForm'
import { LessonPreview } from '../LessonPreview'
import styles from './index.module.css'

interface LessonWorkbenchProps {
    draft: LessonDraft
    onChange: (draft: LessonDraft) => void
    disabled?: boolean
    lessons: LessonRef[]
}

// Bancada de edição de lição (N.23): formulário e pré-visualização lado a lado no desktop (a pré-visualização
// fica fixa enquanto o formulário rola), uma coluna no mobile e no tablet. Não é o formulário esticado: no
// desktop o admin edita e vê o resultado ao mesmo tempo.
export function LessonWorkbench({ draft, onChange, disabled, lessons }: LessonWorkbenchProps) {
    return (
        <div className={styles.root}>
            <div className={styles.form}>
                <LessonEditorForm draft={draft} onChange={onChange} disabled={disabled} />
            </div>
            <aside className={styles.preview} aria-label="Pré-visualização">
                <h2 className={styles.previewTitle}>Pré-visualização</h2>
                <LessonPreview content={draftToContent(draft)} lessons={lessons} />
            </aside>
        </div>
    )
}
