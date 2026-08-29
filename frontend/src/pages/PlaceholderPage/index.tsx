import type { PlaceholderPageProps } from './types'

export type { PlaceholderPageProps } from './types'

// Rota existe e navega de verdade (tarefa 6.1) — conteúdo é tarefa futura
// do backlog (Trilha 6.4, Mercado 6.5, Calculadora 6.7, Classificação
// 6.10, Amigos 6.9, Conquistas 6.8, Configurações 6.8, Admin 6.11).
export function PlaceholderPage({ title }: PlaceholderPageProps) {
    return (
        <div>
            <h1>{title}</h1>
        </div>
    )
}
