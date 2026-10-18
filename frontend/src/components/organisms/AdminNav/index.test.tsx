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
    it('lista as seções na ordem do backlog', () => {
        renderNav()
        const labels = screen.getAllByRole('listitem').map((item) => item.textContent)
        expect(labels).toHaveLength(ADMIN_SECTIONS.length)
        expect(labels[0]).toContain('Visão geral')
        expect(labels[6]).toContain('Diário')
        expect(labels.at(-1)).toContain('Auditoria')
    })

    it('seção com rota vira link, inclusive Sistema (N.20)', () => {
        renderNav()
        expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveAttribute('href', '/admin')
        expect(screen.getByRole('link', { name: 'Mercado' })).toHaveAttribute('href', '/admin/mercado')
        expect(screen.getByRole('link', { name: 'Bots' })).toHaveAttribute('href', '/admin/bots')
        expect(screen.getByRole('link', { name: 'Usuários' })).toHaveAttribute('href', '/admin/usuarios')
        expect(screen.getByRole('link', { name: 'Conteúdo' })).toHaveAttribute('href', '/admin/conteudo')
        expect(screen.getByRole('link', { name: 'Sistema' })).toHaveAttribute('href', '/admin/sistema')
    })

    it('seção sem tela ainda aparece desabilitada com "Em breve", nunca como link morto', () => {
        // Todas as seções já têm tela; uma temporária sem `to` cobre o ramo de "em breve".
        const pending = { ...ADMIN_SECTIONS[0], key: 'pending', label: 'Futura', to: undefined, task: 'X' }
        ADMIN_SECTIONS.push(pending)
        try {
            renderNav()
            expect(screen.queryByRole('link', { name: /Futura/ })).not.toBeInTheDocument()
            const future = screen.getByText('Futura').closest('span[aria-disabled]')
            expect(future).toHaveAttribute('aria-disabled', 'true')
            expect(future).toHaveTextContent('Em breve')
        } finally {
            ADMIN_SECTIONS.pop()
        }
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
