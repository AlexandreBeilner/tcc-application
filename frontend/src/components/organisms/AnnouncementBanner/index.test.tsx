import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ActiveAnnouncement } from '../../../services/announcements'
import { AnnouncementBanner } from '.'

const base: ActiveAnnouncement = {
    id: 'a1',
    title: 'Aviso',
    body: 'Texto',
    severity: 'info',
    kind: 'notice',
    dismissible: true,
    starts_at: '2026-10-06T10:00:00Z',
    ends_at: null,
}

describe('AnnouncementBanner', () => {
    it('não renderiza nada sem comunicados', () => {
        const { container } = render(<AnnouncementBanner announcements={[]} onDismiss={vi.fn()} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('mostra o texto como texto, sem interpretar HTML', () => {
        render(<AnnouncementBanner announcements={[{ ...base, body: '<img src=x onerror=alert(1)> oi' }]} onDismiss={vi.fn()} />)
        expect(screen.getByText('<img src=x onerror=alert(1)> oi')).toBeInTheDocument()
        expect(document.querySelector('img')).toBeNull()
    })

    it('dispensável tem botão de dispensar que chama onDismiss com o id', () => {
        const onDismiss = vi.fn()
        render(<AnnouncementBanner announcements={[base]} onDismiss={onDismiss} />)
        fireEvent.click(screen.getByRole('button', { name: 'Dispensar comunicado: Aviso' }))
        expect(onDismiss).toHaveBeenCalledWith('a1')
    })

    it('manutenção é anunciada como alerta, rotulada em texto e sem botão de dispensar', () => {
        render(
            <AnnouncementBanner
                announcements={[{ ...base, kind: 'maintenance', severity: 'critical', dismissible: false, title: 'Manutenção às 22h' }]}
                onDismiss={vi.fn()}
            />,
        )
        expect(screen.getByRole('alert')).toHaveTextContent('Manutenção')
        expect(screen.queryByRole('button')).not.toBeInTheDocument()
    })

    it('severidade aparece em texto: atenção e aviso', () => {
        render(
            <AnnouncementBanner
                announcements={[
                    { ...base, id: 'w', severity: 'warning', title: 'W' },
                    { ...base, id: 'i', severity: 'info', title: 'I' },
                ]}
                onDismiss={vi.fn()}
            />,
        )
        expect(screen.getByText('Atenção')).toBeInTheDocument()
        expect(screen.getByText('Aviso')).toBeInTheDocument()
    })
})
