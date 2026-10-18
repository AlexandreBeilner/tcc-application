import { ChevronRight, Plus } from 'lucide-react'
import { LessonCardBody } from '../../molecules/LessonCardText'
import { LessonWidget } from '../LessonWidget'
import type { MoreDetailsProps } from './types'
import styles from './index.module.css'

export type { MoreDetailsProps } from './types'

// "Saiba mais" como detalhe recolhido do cartão anterior (LJ.5.7): o título vira o resumo de um `<details>`
// fechado e o texto e os widgets de apoio aparecem ao abrir, fora do caminho principal da lição. `<details>`
// dá teclado (Enter e Espaço no resumo) e leitor de tela de graça; o aberto/fechado fica com o player, que
// lembra enquanto a lição está aberta. O texto passa pelo mesmo renderizador do cartão (glossário e links).
export function MoreDetails({ block, open, onToggle, lessons }: MoreDetailsProps) {
    return (
        <details
            className={styles.more}
            open={open}
            onToggle={(event) => {
                const isOpen = event.currentTarget.open
                if (isOpen !== open) onToggle(isOpen)
            }}
        >
            <summary className={styles.summary}>
                <Plus size={16} aria-hidden="true" />
                <span>
                    <span className={styles.label}>Saiba mais</span>
                    {block.title}
                </span>
                <ChevronRight size={16} className={styles.chevron} aria-hidden="true" />
            </summary>
            {/* Montado só aberto: um widget com consulta ao vivo não deve buscar dado para um detalhe que ninguém abriu. */}
            {open && (
                <div className={styles.content}>
                    {block.blocks.map((inner, index) =>
                        inner.type === 'text' ? (
                            <LessonCardBody
                                key={index}
                                card={{ text: inner.markup, hidden: false }}
                                revealed
                                onReveal={() => undefined}
                                lessons={lessons}
                            />
                        ) : (
                            <LessonWidget key={inner.id} block={inner} />
                        ),
                    )}
                </div>
            )}
        </details>
    )
}
