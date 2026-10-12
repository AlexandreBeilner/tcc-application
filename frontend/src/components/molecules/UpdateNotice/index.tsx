import { useSyncExternalStore } from 'react'
import { applyUpdate, isUpdateWaiting, subscribeToUpdate } from '../../../features/pwa/updateStore'
import { Button } from '../../atoms/Button'
import styles from './index.module.css'

// Aviso de versão nova (LW.2.2). Fica no canto, sem bloquear nada: a atualização recarrega a
// página, então só acontece quando a pessoa toca em "Atualizar" (nunca no meio de uma lição ou de
// uma ordem). Quem prefere esperar simplesmente ignora o aviso.
export function UpdateNotice() {
    const waiting = useSyncExternalStore(subscribeToUpdate, isUpdateWaiting, () => false)

    if (!waiting) return null

    return (
        <div className={styles.notice} role="status" aria-live="polite">
            <p className={styles.text}>Nova versão disponível. Atualize quando terminar o que está fazendo.</p>
            <Button onClick={applyUpdate}>Atualizar</Button>
        </div>
    )
}
