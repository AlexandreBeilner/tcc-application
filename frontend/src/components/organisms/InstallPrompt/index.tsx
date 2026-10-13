import { useEffect, useId, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
    dismissInstallInvite,
    hasSeenInstallPrompt,
    markInstallPromptSeen,
    promptInstall,
    useInstallMode,
} from '../../../features/pwa/install'
import { Button } from '../../atoms/Button'
import styles from './index.module.css'

type Variant = 'native' | 'ios'
type Step = 'ask' | 'later'

// Popup de instalação do app (LW.2.4), mostrado UMA vez, logo depois da apresentação (onboarding):
// o Onboarding navega para a trilha com `state.fromOnboarding`. Antes ele só existia em Configurações
// e depois da primeira lição, e quase ninguém achava. É convite, nunca insistência (M6):
// - "Instalar" abre o diálogo do navegador; se a pessoa recusar lá, vale como recusa;
// - "Agora não" mostra onde instalar depois (Configurações) e adia também o convite da trilha por
//   30 dias, para não perguntar de novo logo em seguida;
// - no iPhone não existe botão, então o popup traz o passo a passo do Safari.
// Só abre se o navegador suportar a instalação (`mode !== 'none'`); se o evento do navegador chegar
// atrasado, o popup espera por ele. A marca de "já mostrei" é gravada na hora em que o popup abre.
export function InstallPrompt() {
    const location = useLocation()
    const mode = useInstallMode()
    const fromOnboarding = (location.state as { fromOnboarding?: boolean } | null)?.fromOnboarding === true
    const [variant, setVariant] = useState<Variant | null>(null)
    const [step, setStep] = useState<Step>('ask')
    const [isInstalling, setIsInstalling] = useState(false)
    const titleId = useId()
    const panelRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (variant !== null || !fromOnboarding || mode === 'none' || hasSeenInstallPrompt()) return
        markInstallPromptSeen()
        setVariant(mode)
    }, [variant, fromOnboarding, mode])

    const isOpen = variant !== null

    function close() {
        setVariant(null)
    }

    function later() {
        dismissInstallInvite()
        setStep('later')
    }

    async function install() {
        setIsInstalling(true)
        const accepted = await promptInstall()
        setIsInstalling(false)
        if (accepted) close()
        else later()
    }

    // Esc fecha como "agora não" na pergunta e simplesmente fecha nos outros passos.
    useEffect(() => {
        if (!isOpen) return
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return
            if (variant === 'native' && step === 'ask') later()
            else close()
        }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
    }, [isOpen, variant, step])

    useEffect(() => {
        if (isOpen) panelRef.current?.querySelector<HTMLButtonElement>('[data-autofocus]')?.focus()
    }, [isOpen, step])

    if (variant === null) return null

    return (
        <div className={styles.backdrop} data-testid="install-prompt-backdrop">
            <div ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-labelledby={titleId}>
                {step === 'later' ? (
                    <>
                        <h2 id={titleId} className={styles.title}>
                            Tudo bem, fica para depois
                        </h2>
                        <p className={styles.text}>
                            Quando quiser instalar, abra <strong>Configurações</strong> e procure o bloco{' '}
                            <strong>Instale a Selucra no seu celular</strong>.
                        </p>
                        <div className={styles.actions}>
                            <Button data-autofocus onClick={close}>
                                Entendi
                            </Button>
                        </div>
                    </>
                ) : variant === 'native' ? (
                    <>
                        <h2 id={titleId} className={styles.title}>
                            Instale a Selucra no seu celular
                        </h2>
                        <p className={styles.text}>
                            Abra direto da tela inicial, em tela cheia, como um app. Leva poucos segundos e você pode remover quando quiser.
                        </p>
                        <div className={styles.actions}>
                            <button type="button" className={styles.secondary} disabled={isInstalling} onClick={later}>
                                Agora não
                            </button>
                            <Button data-autofocus disabled={isInstalling} onClick={() => void install()}>
                                Instalar
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 id={titleId} className={styles.title}>
                            Instale a Selucra no seu iPhone
                        </h2>
                        <p className={styles.text}>No Safari, a instalação é feita assim:</p>
                        <ol className={styles.steps}>
                            <li>Toque em Compartilhar, o botão com a seta para cima, na barra do Safari.</li>
                            <li>Escolha Adicionar à Tela de Início.</li>
                            <li>Toque em Adicionar.</li>
                        </ol>
                        <p className={styles.hint}>
                            Para ver isso de novo depois, abra <strong>Configurações</strong>.
                        </p>
                        <div className={styles.actions}>
                            <Button data-autofocus onClick={close}>
                                Entendi
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
