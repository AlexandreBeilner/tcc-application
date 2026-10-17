import { describe, expect, it } from 'vitest'
import type { Lesson } from '../../../services/lessons'
import { learnMoreDestination } from '.'

const lesson = (code: string, status: Lesson['status']) => ({ id: `id-${code}`, code, status }) as Lesson

describe('learnMoreDestination (DI.4.2)', () => {
    const lessons = [lesson('1.1', 'completed'), lesson('1.2', 'available'), lesson('3.4', 'locked')]

    it('glossário: termo existente (sem diferenciar caixa) vira busca no glossário', () => {
        expect(learnMoreDestination({ kind: 'glossary', ref: 'Selic' }, lessons)).toBe('/glossario?termo=Selic')
        expect(learnMoreDestination({ kind: 'glossary', ref: 'etf' }, lessons)).toBe('/glossario?termo=ETF')
    })

    it('glossário: termo desconhecido não gera link', () => {
        expect(learnMoreDestination({ kind: 'glossary', ref: 'termo-que-nao-existe' }, lessons)).toBeNull()
    })

    it('lição: só disponível ou concluída; bloqueada ou desconhecida não gera link', () => {
        expect(learnMoreDestination({ kind: 'lesson', ref: '1.1' }, lessons)).toBe('/trilha/id-1.1')
        expect(learnMoreDestination({ kind: 'lesson', ref: '1.2' }, lessons)).toBe('/trilha/id-1.2')
        expect(learnMoreDestination({ kind: 'lesson', ref: '3.4' }, lessons)).toBeNull()
        expect(learnMoreDestination({ kind: 'lesson', ref: '9.9' }, lessons)).toBeNull()
        expect(learnMoreDestination({ kind: 'lesson', ref: '1.1' }, [])).toBeNull()
    })

    it('guia: não existe no app', () => {
        expect(learnMoreDestination({ kind: 'guide', ref: 'o-que-e-etf' }, lessons)).toBeNull()
    })
})
