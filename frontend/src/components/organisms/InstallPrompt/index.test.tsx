import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isInstallInviteDismissed, listenForInstall, resetInstallState } from '../../../features/pwa/install'
import { readStored, STORAGE_KEYS } from '../../../utils/storage'
import { InstallPrompt } from '.'

const IPHONE_SAFARI =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'

function installPromptEvent(outcome: 'accepted' | 'dismissed') {
    const event = new Event('beforeinstallprompt', { cancelable: true }) as Event & {
        prompt: () => Promise<void>
        userChoice: Promise<unknown>
    }
    event.prompt = vi.fn().mockResolvedValue(undefined)
    event.userChoice = Promise.resolve({ outcome })
    return event
}

function renderPrompt(state: unknown = { fromOnboarding: true }) {
    return render(
        <MemoryRouter initialEntries={[{ pathname: '/trilha', state }]}>
            <InstallPrompt />
        </MemoryRouter>,
    )
}

const hasSeen = () => readStored(STORAGE_KEYS.installPromptSeen) !== null

describe('InstallPrompt (popup de instalação depois do onboarding)', () => {
    beforeEach(() => {
        localStorage.clear()
        resetInstallState()
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    })

    afterEach(() => vi.unstubAllGlobals())

    it('não aparece fora do fluxo do onboarding, mesmo com a instalação disponível', async () => {
        listenForInstall()
        renderPrompt(null)
        act(() => {
            window.dispatchEvent(installPromptEvent('accepted'))
        })

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(hasSeen()).toBe(false)
    })

    it('não aparece, e não gasta a única chance, quando o navegador não suporta a instalação', () => {
        renderPrompt()

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
        expect(hasSeen()).toBe(false)
    })

    it('aparece uma vez com o evento do navegador e "Instalar" abre o diálogo nativo', async () => {
        listenForInstall()
        renderPrompt()
        const event = installPromptEvent('accepted')

        act(() => {
            window.dispatchEvent(event)
        })
        expect(await screen.findByRole('dialog', { name: 'Instale a Selucra no seu celular' })).toBeInTheDocument()
        expect(hasSeen()).toBe(true)

        fireEvent.click(screen.getByRole('button', { name: 'Instalar' }))

        await waitFor(() => expect(event.prompt).toHaveBeenCalled())
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    })

    it('"Agora não" mostra onde instalar depois e adia o convite da trilha', async () => {
        listenForInstall()
        renderPrompt()
        act(() => {
            window.dispatchEvent(installPromptEvent('accepted'))
        })

        fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))

        expect(screen.getByRole('heading', { name: 'Tudo bem, fica para depois' })).toBeInTheDocument()
        expect(screen.getByText(/Configurações/)).toBeInTheDocument()
        expect(isInstallInviteDismissed()).toBe(true)

        fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('recusar no diálogo do navegador também mostra onde instalar depois', async () => {
        listenForInstall()
        renderPrompt()
        act(() => {
            window.dispatchEvent(installPromptEvent('dismissed'))
        })

        fireEvent.click(await screen.findByRole('button', { name: 'Instalar' }))

        expect(await screen.findByRole('heading', { name: 'Tudo bem, fica para depois' })).toBeInTheDocument()
    })

    it('Esc na pergunta vale como "agora não"', async () => {
        listenForInstall()
        renderPrompt()
        act(() => {
            window.dispatchEvent(installPromptEvent('accepted'))
        })
        await screen.findByRole('dialog')

        fireEvent.keyDown(document, { key: 'Escape' })

        expect(screen.getByRole('heading', { name: 'Tudo bem, fica para depois' })).toBeInTheDocument()
    })

    it('não repete: quem já viu o popup não o vê de novo, nem recarregando a página', async () => {
        listenForInstall()
        localStorage.clear()
        const first = renderPrompt()
        act(() => {
            window.dispatchEvent(installPromptEvent('accepted'))
        })
        fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
        fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
        first.unmount()

        resetInstallState()
        listenForInstall()
        renderPrompt()
        act(() => {
            window.dispatchEvent(installPromptEvent('accepted'))
        })

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('no iPhone (Safari) traz o passo a passo, sem botão de instalar', async () => {
        vi.stubGlobal('navigator', { ...navigator, userAgent: IPHONE_SAFARI, maxTouchPoints: 5 })
        renderPrompt()

        expect(await screen.findByRole('dialog', { name: 'Instale a Selucra no seu iPhone' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
})
