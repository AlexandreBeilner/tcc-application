import { readStored, STORAGE_KEYS, writeStored } from '../../../utils/storage'
import completeSound from './sounds/complete.wav'
import correctSound from './sounds/correct.wav'
import goalSound from './sounds/goal.wav'

// Som e vibração curtos nos momentos de vitória da lição (LJ.5.4): acerto de pergunta, missão atingida e
// conclusão. Erro é sempre silencioso: não existe cue para ele. A preferência vive só no navegador.

export type LessonCue = 'correct' | 'goal' | 'complete'

export interface LessonFeedbackPrefs {
    sound: boolean
    vibration: boolean
}

const SOUNDS: Record<LessonCue, string> = { correct: correctSound, goal: goalSound, complete: completeSound }
const VIBRATIONS: Record<LessonCue, number[]> = { correct: [30], goal: [40, 40, 40], complete: [60, 50, 90] }
const VOLUME = 0.6

// Som nasce desligado e vibração ligada; leitura bloqueada (janela privada) cai no padrão.
export function readLessonFeedbackPrefs(): LessonFeedbackPrefs {
    try {
        return {
            sound: readStored(STORAGE_KEYS.lessonSound) === '1',
            vibration: readStored(STORAGE_KEYS.lessonVibration) !== '0',
        }
    } catch {
        return { sound: false, vibration: true }
    }
}

export function writeLessonFeedbackPref(name: keyof LessonFeedbackPrefs, enabled: boolean): void {
    try {
        writeStored(name === 'sound' ? STORAGE_KEYS.lessonSound : STORAGE_KEYS.lessonVibration, enabled ? '1' : '0')
    } catch {
        // Sem armazenamento a escolha vale só até recarregar, e tudo bem.
    }
}

export function vibrationSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

function prefersReducedMotion(): boolean {
    return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Dispara o som e a vibração do cue, conforme a preferência. Quem chama decide se é o caso (nunca em revisão).
export function playLessonCue(cue: LessonCue): void {
    const prefs = readLessonFeedbackPrefs()
    if (prefs.sound) {
        try {
            const audio = new Audio(SOUNDS[cue])
            audio.volume = VOLUME
            // O navegador pode recusar (sem gesto do usuário, sem dispositivo de áudio): o som é só um agrado.
            audio.play().catch(() => undefined)
        } catch {
            // Ambiente sem áudio.
        }
    }
    if (prefs.vibration && vibrationSupported() && !prefersReducedMotion()) {
        navigator.vibrate(VIBRATIONS[cue])
    }
}
