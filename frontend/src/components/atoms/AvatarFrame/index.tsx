import type { ReactNode } from 'react'
import styles from './index.module.css'

// Frames conhecidos (chaves do catálogo em `cosmetic_items`). Chave desconhecida (item novo ainda
// sem visual neste build) cai sem moldura, nunca quebra a tela.
const KNOWN_FRAMES = new Set(['frame_aurora', 'frame_oceano', 'frame_crepusculo', 'frame_ametista', 'frame_coral', 'frame_grafite'])

function isKnownFrame(frame: string | null | undefined): frame is string {
    return frame != null && KNOWN_FRAMES.has(frame)
}

// Anel de gradiente em volta de um avatar (MO.5.1). Sem moldura devolve os filhos como estão, sem
// wrapper, então telas sem cosmético não mudam de tamanho.
export function AvatarFrame({ frame, children }: { frame?: string | null; children: ReactNode }) {
    if (!isKnownFrame(frame)) return <>{children}</>
    return (
        <span className={styles.frame} data-frame={frame}>
            {children}
        </span>
    )
}
