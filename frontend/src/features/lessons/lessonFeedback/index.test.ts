import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playLessonCue, readLessonFeedbackPrefs, writeLessonFeedbackPref } from '.'

const play = vi.fn().mockResolvedValue(undefined)
const audioCtor = vi.fn()
const vibrate = vi.fn()

function stubReducedMotion(reduced: boolean) {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: reduced }))
}

describe('lessonFeedback', () => {
    beforeEach(() => {
        window.localStorage.clear()
        play.mockClear()
        audioCtor.mockClear()
        vibrate.mockClear()
        vi.stubGlobal(
            'Audio',
            class {
                volume = 1
                constructor(src: string) {
                    audioCtor(src)
                }
                play = play
            },
        )
        Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true })
        stubReducedMotion(false)
    })
    afterEach(() => {
        vi.unstubAllGlobals()
        Reflect.deleteProperty(navigator, 'vibrate')
    })

    it('padrão: som desligado e vibração ligada', () => {
        expect(readLessonFeedbackPrefs()).toEqual({ sound: false, vibration: true })
    })

    it('com o padrão, vibra e não toca som', () => {
        playLessonCue('correct')

        expect(audioCtor).not.toHaveBeenCalled()
        expect(vibrate).toHaveBeenCalledWith([30])
    })

    it('com o som ligado toca o arquivo do cue', () => {
        writeLessonFeedbackPref('sound', true)

        playLessonCue('complete')

        expect(audioCtor).toHaveBeenCalledTimes(1)
        expect(play).toHaveBeenCalled()
    })

    it('respeita as duas preferências desligadas', () => {
        writeLessonFeedbackPref('vibration', false)

        playLessonCue('goal')

        expect(vibrate).not.toHaveBeenCalled()
        expect(audioCtor).not.toHaveBeenCalled()
    })

    it('não vibra com prefers-reduced-motion', () => {
        stubReducedMotion(true)

        playLessonCue('correct')

        expect(vibrate).not.toHaveBeenCalled()
    })

    it('sem navigator.vibrate (desktop, iOS) segue sem erro', () => {
        Reflect.deleteProperty(navigator, 'vibrate')

        expect(() => playLessonCue('correct')).not.toThrow()
    })

    it('áudio recusado pelo navegador não derruba nada', () => {
        writeLessonFeedbackPref('sound', true)
        play.mockRejectedValueOnce(new Error('NotAllowedError'))

        expect(() => playLessonCue('correct')).not.toThrow()
    })

    it('armazenamento bloqueado cai no padrão', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })

        expect(readLessonFeedbackPrefs()).toEqual({ sound: false, vibration: true })
        vi.restoreAllMocks()
    })
})
