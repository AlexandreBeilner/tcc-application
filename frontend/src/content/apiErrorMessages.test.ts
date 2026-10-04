import { describe, expect, it } from 'vitest'

// RC.1.5: tela nunca mostra `err.message`/`error.message` cru; o texto de erro
// de API passa por `formatApiError` (utils/formatApiError). Serviços e o
// próprio formatador ficam de fora.
const SOURCES = import.meta.glob(
    [
        '../{pages,components,features}/**/*.{ts,tsx}',
        '!../**/*.test.{ts,tsx}',
        '!../**/admin/**',
        '!../pages/{PainelAdmin,CriarEventoMacro}/**',
    ],
    { query: '?raw', import: 'default', eager: true },
) as Record<string, string>

const RAW_MESSAGE = /\b(?:err|error|e)\.message\b/

describe('mensagem de erro de API (RC.1.5)', () => {
    it('nenhuma tela ou componente usa err.message direto', () => {
        const offenders: string[] = []
        for (const [file, source] of Object.entries(SOURCES)) {
            source.split('\n').forEach((line, i) => {
                const code = line.replace(/\/\/.*$/, '')
                if (RAW_MESSAGE.test(code)) offenders.push(`${file.replace('../', '')}:${i + 1}: ${line.trim()}`)
            })
        }
        expect(offenders, 'use formatApiError(err, fallback) em vez de err.message').toEqual([])
    })
})
