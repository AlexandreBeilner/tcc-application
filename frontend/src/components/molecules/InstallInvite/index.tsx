import { useState } from 'react'
import { dismissInstallInvite, isInstallInviteDismissed, promptInstall, useInstallMode } from '../../../features/pwa/install'
import { Button } from '../../atoms/Button'
import styles from './index.module.css'
import type { InstallInviteProps } from './types'

// Convite para instalar a Selucra na tela inicial (LW.2.4). Convite, nunca insistência: some sozinho
// depois de instalado (ou se o navegador não suporta) e pode ser dispensado. No Android e no desktop
// abre o diálogo do navegador; no iPhone (Safari) mostra o passo a passo, porque não existe botão.
export function InstallInvite({ placement }: InstallInviteProps) {
    const mode = useInstallMode()
    const [dismissed, setDismissed] = useState(() => placement === 'lesson' && isInstallInviteDismissed())

    if (mode === 'none' || dismissed) return null

    function handleDismiss() {
        dismissInstallInvite()
        setDismissed(true)
    }

    return (
        <section className={styles.invite} aria-label="Instalar o app">
            <h3 className={styles.title}>Instale a Selucra no seu celular</h3>
            {mode === 'native' ? (
                <>
                    <p className={styles.text}>Abra direto da tela inicial, em tela cheia, sem passar pelo navegador.</p>
                    <div className={styles.actions}>
                        <Button onClick={() => void promptInstall()}>Instalar</Button>
                        {placement === 'lesson' && (
                            <button type="button" className={styles.dismiss} onClick={handleDismiss}>
                                Agora não
                            </button>
                        )}
                    </div>
                </>
            ) : (
                <>
                    <p className={styles.text}>No iPhone, a instalação é feita pelo Safari:</p>
                    <ol className={styles.steps}>
                        <li>Toque em Compartilhar, o botão com a seta para cima, na barra do Safari.</li>
                        <li>Escolha Adicionar à Tela de Início.</li>
                        <li>Toque em Adicionar.</li>
                    </ol>
                    {placement === 'lesson' && (
                        <div className={styles.actions}>
                            <button type="button" className={styles.dismiss} onClick={handleDismiss}>
                                Entendi
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    )
}
