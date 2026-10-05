import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AuditLogEntry } from '../../../services/admin'
import { AuditLogList } from '.'

const success: AuditLogEntry = {
    id: 'a1',
    admin_id: 'u1',
    admin_username: 'adminn3',
    action: 'tick.trigger',
    target_type: 'tick',
    target_id: '369',
    payload: { day: 369 },
    result: 'success',
    error_message: null,
    occurred_at: '2026-10-03T14:28:54.580Z',
}

const failed: AuditLogEntry = {
    ...success,
    id: 'a2',
    action: 'macro_event.trigger',
    target_type: 'macro_event',
    target_id: null,
    payload: { template_key: 'nao-existe' },
    result: 'failed',
    error_message: 'template de evento macro desconhecido',
}

describe('AuditLogList (tela 10.4)', () => {
    it('mostra mensagem de vazio sem entradas', () => {
        render(<AuditLogList entries={[]} />)
        expect(screen.getByText('Nenhuma ação administrativa registrada para esse filtro.')).toBeInTheDocument()
    })

    it('lista ação, resultado e admin de cada entrada', () => {
        render(<AuditLogList entries={[success, failed]} />)
        expect(screen.getByText('Disparo de tick')).toBeInTheDocument()
        expect(screen.getByText('Disparo de evento macro')).toBeInTheDocument()
        expect(screen.getByText('Sucesso')).toBeInTheDocument()
        expect(screen.getByText('Falha')).toBeInTheDocument()
        expect(screen.getAllByText('adminn3')).toHaveLength(2)
    })

    it('detalhe mostra o payload em JSON, o alvo e, na falha, o motivo', () => {
        render(<AuditLogList entries={[success, failed]} />)
        expect(screen.getByText(/"day": 369/)).toBeInTheDocument()
        expect(screen.getByText('Id: 369')).toBeInTheDocument()
        expect(screen.getByText(/"template_key": "nao-existe"/)).toBeInTheDocument()
        expect(screen.getByText('Motivo: template de evento macro desconhecido')).toBeInTheDocument()
    })

    it('admin sem username aparece como "admin removido"', () => {
        render(<AuditLogList entries={[{ ...success, admin_username: null }]} />)
        expect(screen.getByText('admin removido')).toBeInTheDocument()
    })
})
