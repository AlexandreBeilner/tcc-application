import { useState } from 'react'
import { EmailCategoryOption } from '../../molecules/EmailCategoryOption'
import {
    playLessonCue,
    readLessonFeedbackPrefs,
    vibrationSupported,
    writeLessonFeedbackPref,
} from '../../../features/lessons/lessonFeedback'
import type { LessonFeedbackPrefs } from '../../../features/lessons/lessonFeedback'
import styles from './index.module.css'

// Seção "Lições" de Configurações (LJ.5.4): som e vibração nos acertos. Fica só neste navegador, então
// grava na hora, sem botão "Salvar". A vibração só aparece onde o aparelho vibra.
export function LessonFeedbackSection() {
    const [prefs, setPrefs] = useState<LessonFeedbackPrefs>(readLessonFeedbackPrefs)

    function change(name: keyof LessonFeedbackPrefs, enabled: boolean) {
        writeLessonFeedbackPref(name, enabled)
        setPrefs((current) => ({ ...current, [name]: enabled }))
        // Ao ligar, dá uma amostra para a pessoa saber o que escolheu.
        if (enabled) playLessonCue('correct')
    }

    return (
        <section className={styles.section} aria-labelledby="lesson-feedback-title">
            <h2 id="lesson-feedback-title" className={styles.title}>
                Lições
            </h2>
            <p className={styles.note}>
                Um som e uma vibração curtos quando você acerta uma pergunta ou conclui uma lição. Errar é sempre silencioso.
            </p>
            <div className={styles.options}>
                <EmailCategoryOption
                    title="Som"
                    description="Um toque curto nos acertos. Começa desligado."
                    checked={prefs.sound}
                    onChange={(checked) => change('sound', checked)}
                />
                {vibrationSupported() && (
                    <EmailCategoryOption
                        title="Vibração"
                        description="Uma vibração leve nos acertos, só neste aparelho."
                        checked={prefs.vibration}
                        onChange={(checked) => change('vibration', checked)}
                    />
                )}
            </div>
        </section>
    )
}
