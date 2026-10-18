import { useEffect, useState } from 'react'

const STORAGE_KEY = 'selucra:lesson-shortcut-hint-seen'

function hasKeyboardAndMouse(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function wasSeen(): boolean {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
        // Armazenamento bloqueado (janela privada): trata como já visto, a dica é só um agrado.
        return true
    }
}

function markSeen() {
    try {
        window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
        // Sem armazenamento a dica não é lembrada, e tudo bem.
    }
}

// Dica dos atalhos (LJ.5.3): só em tela com mouse e teclado, e uma única vez por pessoa. Decide uma vez ao
// montar (por isso fica na tela a lição inteira, e a próxima lição, que remonta, já não mostra) e só grava
// que viu quando a dica de fato apareceu (`visible`).
export function useShortcutHint(visible: boolean): boolean {
    const [show] = useState(() => hasKeyboardAndMouse() && !wasSeen())

    useEffect(() => {
        if (show && visible) markSeen()
    }, [show, visible])

    return show && visible
}
