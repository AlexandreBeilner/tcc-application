export interface RequiresUnlockProps {
    // Chave do vocabulário fixo de `unlocksKeys` (tarefa 7.0.1) — 'portfolio'
    // ou 'calculator' nesta fase (as únicas duas rotas gateadas por
    // navegação, ver `routes/router.tsx`).
    unlockKey: string
}
