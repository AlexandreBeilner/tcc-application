import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ADMIN_SECTIONS } from '../../../features/admin/adminSections'
import { AdminNav } from '.'

function renderNav(path = '/admin', onNavigate?: () => void) {
    return render(
        <MemoryRouter initialEntries={[path]}>
            <AdminNav onNavigate={onNavigate} />
        </MemoryRouter>,
    )
}

describe('AdminNav (N.3)', () => {
    it('lista as 9 seções na ordem do backlog', () => {
        renderNav()
        const labels = screen.getAllByRole('listitem').map((item) => item.textContent)
        expect(labels).toHaveLength(ADMIN_SECTIONS.length)
        expect(labels[0]).toContain('Visão geral')
        expect(labels[8]).toContain('Auditoria')
    })

    it('seção com rota vira link e seção sem tela aparece desabilitada com "Em breve"', () => {
        renderNav()
        expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveAttribute('href', '/admin')
        expect(screen.getByRole('link', { name: 'Mercado' })).toHaveAttribute('href', '/admin/mercado')
        expect(screen.getByRole('link', { name: 'Bots' })).toHaveAttribute('href', '/admin/bots')
        expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios')
        expect(screen.queryByRole('link', { name: /Conteúdo/ })).not.toBeInTheDocument()
        const content = screen.getByText('Conteúdo').closest('span[aria-disabled]')
        expect(content).toHaveAttribute('aria-disabled', 'true')
        expect(content).toHaveTextContent('Em breve')
    })

    it('Visão geral não fica ativa em sub-rota; Mercado fica ativa em /admin/eventos/novo', () => {
        renderNav('/admin/eventos/novo')
        expect(screen.getByRole('link', { name: 'Visão geral' })).not.toHaveAttribute('aria-current')
        expect(screen.getByRole('link', { name: 'Mercado' })).toHaveAttribute('aria-current', 'page')
    })

    it('Mercado fica ativa no monitor, no detalhe de um ativo e no histórico de eventos', () => {
        for (const path of ['/admin/mercado', '/admin/mercado/ativos/a1', '/admin/eventos']) {
            const { unmount } = renderNav(path)
            expect(screen.getByRole('link', { name: 'Mercado' })).toHaveAttribute('aria-current', 'page')
            unmount()
        }
    })

    it('clicar numa seção disponível chama onNavigate', () => {
        const onNavigate = vi.fn()
        renderNav('/admin', onNavigate)
        fireEvent.click(screen.getByRole('link', { name: 'Mercado' }))
        expect(onNavigate).toHaveBeenCalledTimes(1)
    })
})
