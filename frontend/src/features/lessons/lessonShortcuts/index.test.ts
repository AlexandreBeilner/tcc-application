import { describe, expect, it } from 'vitest'
import { resolveShortcut, swipeAction } from '.'
import type { ShortcutInput } from '.'

const base: ShortcutInput = { key: '', hasModifier: false, editable: false, inWidget: false, interactive: false }
const press = (overrides: Partial<ShortcutInput>) => resolveShortcut({ ...base, ...overrides })

describe('resolveShortcut', () => {
    it.each([
        { key: 'ArrowLeft', expected: { type: 'back' } },
        { key: 'ArrowRight', expected: { type: 'continue' } },
        { key: 'Enter', expected: { type: 'enter' } },
        { key: '1', expected: { type: 'option', index: 0 } },
        { key: '4', expected: { type: 'option', index: 3 } },
    ])('$key vira $expected', ({ key, expected }) => {
        expect(press({ key })).toEqual(expected)
    })

    it.each(['5', '0', 'a', ' ', 'Escape', 'ArrowUp'])('a tecla %s não é atalho', (key) => {
        expect(press({ key })).toBeNull()
    })

    it.each(['ArrowLeft', 'ArrowRight', 'Enter', '1'])('%s não dispara em campo editável', (key) => {
        expect(press({ key, editable: true })).toBeNull()
    })

    it.each(['ArrowLeft', 'ArrowRight', 'Enter', '2'])('%s não dispara com o foco dentro de um widget', (key) => {
        expect(press({ key, inWidget: true })).toBeNull()
    })

    it.each(['ArrowLeft', 'ArrowRight', 'Enter', '1'])('%s não dispara com Ctrl, Alt, Meta ou Shift', (key) => {
        expect(press({ key, hasModifier: true })).toBeNull()
    })

    it('Enter com o foco num botão fica com o botão (senão avançaria duas vezes)', () => {
        expect(press({ key: 'Enter', interactive: true })).toBeNull()
        expect(press({ key: 'ArrowRight', interactive: true })).toEqual({ type: 'continue' })
    })
})

describe('swipeAction', () => {
    it.each([
        { dx: -120, dy: 10, durationMs: 200, expected: 'continue' },
        { dx: 120, dy: -20, durationMs: 200, expected: 'back' },
        { dx: -60, dy: 0, durationMs: 800, expected: 'continue' },
    ])('dx $dx dy $dy em $durationMs ms: $expected', ({ expected, ...input }) => {
        expect(swipeAction(input)).toBe(expected)
    })

    it.each([
        { name: 'curto demais', dx: -40, dy: 0, durationMs: 100 },
        { name: 'devagar demais (arrasto de seleção)', dx: -150, dy: 0, durationMs: 1200 },
        { name: 'diagonal, é rolagem da página', dx: -100, dy: 80, durationMs: 200 },
        { name: 'quase vertical', dx: -70, dy: 200, durationMs: 200 },
    ])('ignora gesto $name', (input) => {
        expect(swipeAction(input)).toBeNull()
    })
})
