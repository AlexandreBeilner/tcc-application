import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listenForInstall, resetInstallState } from '../../../features/pwa/install'
import { InstallInvite } from '.'

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

describe('InstallInvite (LW.2.4)', () => {
    beforeEach(() => {
        localStorage.clear()
        resetInstallState()
        vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }))
    })

    afterEach(() => vi.unstubAllGlobals())

    it('não aparece em navegador sem suporte à instalação', () => {
        render(<InstallInvite placement="settings" />)

        expect(screen.queryByRole('region', { name: 'Instalar o app' })).not.toBeInTheDocument()
    })

    it('com o evento do navegador oferece "Instalar" e usa o diálogo nativo', async () => {
        listenForInstall()
        render(<InstallInvite placement="settings" />)
        const event = installPromptEvent('accepted')

        act(() => {
            window.dispatchEvent(event)
        })
        fireEvent.click(await screen.findByRole('button', { name: 'Instalar' }))

        await waitFor(() => expect(event.prompt).toHaveBeenCalled())
        expect(event.defaultPrevented).toBe(true)
        // Depois de aceitar, o convite some.
        await waitFor(() => expect(screen.queryByRole('region', { name: 'Instalar o app' })).not.toBeInTheDocument())
    })

    it('some quando o app é instalado', async () => {
        listenForInstall()
        render(<InstallInvite placement="settings" />)
        act(() => {
            window.dispatchEvent(installPromptEvent('dismissed'))
        })
        expect(await screen.findByRole('button', { name: 'Instalar' })).toBeInTheDocument()

        act(() => {
            window.dispatchEvent(new Event('appinstalled'))
        })

        expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument()
    })

    it('no Safari do iPhone mostra o passo a passo', () => {
        vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(IPHONE_SAFARI)
        render(<InstallInvite placement="settings" />)

        expect(screen.getByText(/Adicionar à Tela de Início/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Instalar' })).not.toBeInTheDocument()
        vi.restoreAllMocks()
    })

    it('depois da lição pode ser dispensado e não volta na visita seguinte', async () => {
        listenForInstall()
        const { unmount } = render(<InstallInvite placement="lesson" />)
        act(() => {
            window.dispatchEvent(installPromptEvent('dismissed'))
        })

        fireEvent.click(await screen.findByRole('button', { name: 'Agora não' }))
        expect(screen.queryByRole('region', { name: 'Instalar o app' })).not.toBeInTheDocument()
        unmount()

        render(<InstallInvite placement="lesson" />)
        expect(screen.queryByRole('region', { name: 'Instalar o app' })).not.toBeInTheDocument()
    })

    it('em Configurações não tem "Agora não" (o convite fica à mão)', async () => {
        listenForInstall()
        render(<InstallInvite placement="settings" />)
        act(() => {
            window.dispatchEvent(installPromptEvent('dismissed'))
        })

        expect(await screen.findByRole('button', { name: 'Instalar' })).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Agora não' })).not.toBeInTheDocument()
    })
})
