import { beforeEach, describe, expect, it } from 'vitest'
import { readStored, removeStored, STORAGE_KEYS, writeStored } from '.'

describe('storage com chave legada', () => {
    beforeEach(() => localStorage.clear())

    it('lê a chave nova quando existe', () => {
        localStorage.setItem(STORAGE_KEYS.theme.current, 'light')
        expect(readStored(STORAGE_KEYS.theme)).toBe('light')
    })

    it('migra o valor da chave antiga para a nova na primeira leitura', () => {
        localStorage.setItem(STORAGE_KEYS.authToken.legacy, 'jwt-antigo')
        expect(readStored(STORAGE_KEYS.authToken)).toBe('jwt-antigo')
        expect(localStorage.getItem(STORAGE_KEYS.authToken.current)).toBe('jwt-antigo')
        expect(localStorage.getItem(STORAGE_KEYS.authToken.legacy)).toBeNull()
    })

    it('devolve null sem nenhuma das duas chaves', () => {
        expect(readStored(STORAGE_KEYS.lastSeenNewsId)).toBeNull()
    })

    it('escrever e remover limpam a chave antiga também', () => {
        localStorage.setItem(STORAGE_KEYS.theme.legacy, 'dark')
        writeStored(STORAGE_KEYS.theme, 'light')
        expect(localStorage.getItem(STORAGE_KEYS.theme.legacy)).toBeNull()
        expect(readStored(STORAGE_KEYS.theme)).toBe('light')
        removeStored(STORAGE_KEYS.theme)
        expect(readStored(STORAGE_KEYS.theme)).toBeNull()
    })
})
