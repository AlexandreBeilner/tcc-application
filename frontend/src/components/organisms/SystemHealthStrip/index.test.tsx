import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SystemHealthStrip } from '.'

describe('SystemHealthStrip', () => {
    it('mostra cada componente com rótulo, estado e latência', () => {
        render(
            <SystemHealthStrip
                components={[
                    { key: 'backend', status: 'ok', latency_ms: 0, detail: null },
                    { key: 'engine', status: 'degradado', latency_ms: 1500, detail: null },
                    { key: 'redis', status: 'fora', latency_ms: null, detail: 'ECONNREFUSED' },
                ]}
            />,
        )

        const items = screen.getAllByRole('listitem')
        expect(items).toHaveLength(3)
        expect(items[0]).toHaveTextContent('BackendNo ar')
        expect(items[0]).not.toHaveTextContent('ms')
        expect(items[1]).toHaveTextContent('MotorLento1500 ms')
        expect(items[2]).toHaveTextContent('RedisForaECONNREFUSED')
    })

    it('mostra a fila de e-mail com rótulo próprio, os contadores e sem latência', () => {
        render(
            <SystemHealthStrip
                components={[
                    {
                        key: 'email_outbox',
                        status: 'degradado',
                        latency_ms: 4,
                        detail: 'pendente mais antigo espera há 12 min (3 pendente(s), 0 falha(s) em 24 h)',
                    },
                ]}
            />,
        )

        const item = screen.getByRole('listitem')
        expect(item).toHaveTextContent('Fila de e-mailAtenção')
        expect(item).toHaveTextContent('espera há 12 min')
        expect(item).not.toHaveTextContent('4 ms')
    })
})
