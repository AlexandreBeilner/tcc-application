import { useEffect, useState } from 'react'
import { useMediaQuery } from '../../../hooks/useMediaQuery'

const DEFAULT_DURATION_MS = 900

// Número que sobe de 0 até `target` (LJ.1.4). Com `prefers-reduced-motion` (ou sem nada para animar) mostra o
// valor final de uma vez.
export function useCountUp(target: number, durationMs = DEFAULT_DURATION_MS): number {
    const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
    const animate = !reducedMotion && target > 0 && typeof requestAnimationFrame === 'function'
    const [value, setValue] = useState(0)

    useEffect(() => {
        if (!animate) return
        let frame = 0
        const start = performance.now()
        const tick = (now: number) => {
            const progress = Math.min((now - start) / durationMs, 1)
            // Desacelera no fim (ease-out cúbico) para o valor "assentar".
            setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))))
            if (progress < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    }, [animate, target, durationMs])

    return animate ? value : target
}
