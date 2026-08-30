import { useEffect, useRef, useState } from 'react'

// Price-flash (identidade-visual-padroes.md §2) pro pódio/lista da
// Classificação: qualquer troca de critério/janela recalcula os valores
// ao vivo, e essa troca precisa disparar o flash — não só uma ação local
// de input como o stepper do `EquityOrderTicket`. Compara o valor atual
// de cada `id` contra o valor da renderização anterior; só entra no
// conjunto "piscando" quem realmente mudou (nunca no primeiro render, sem
// isso o carregamento inicial "piscaria" tudo à toa).
export function useValueFlash(values: Map<string, number | null>, durationMs = 400): Set<string> {
    const previousRef = useRef<Map<string, number | null>>(new Map())
    const [flashingIds, setFlashingIds] = useState<Set<string>>(new Set())

    useEffect(() => {
        const previous = previousRef.current
        const changed = new Set<string>()
        for (const [id, value] of values) {
            const prevValue = previous.get(id)
            if (prevValue !== undefined && prevValue !== value) {
                changed.add(id)
            }
        }
        previousRef.current = new Map(values)

        if (changed.size === 0) return

        setFlashingIds(changed)
        const timer = setTimeout(() => setFlashingIds(new Set()), durationMs)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [values])

    return flashingIds
}
