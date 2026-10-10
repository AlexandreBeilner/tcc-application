import { Lock } from 'lucide-react'
import type { LockedProps } from './types'
import styles from './index.module.css'

export type { LockedProps } from './types'

// Unifica o ícone de cadeado reimplementado em `LockedAssetBadge`,
// `LockedGate`, `LessonNode` e o gráfico horizontal antigo do Mapa da
// Trilha (tarefa K.1) — mesmo `<Lock strokeWidth={2} aria-hidden>` em todos
// os 4, cada um só variando o tamanho. Puro refactor visual: nenhum dos 4
// chamadores muda de aparência, só passa a consumir este átomo em vez de
// desenhar o cadeado sozinho.
export function Locked({ size, label }: LockedProps) {
    return (
        <span className={styles.locked}>
            <Lock size={size} strokeWidth={2} aria-hidden="true" />
            {label && <span aria-hidden="true">{label}</span>}
        </span>
    )
}
