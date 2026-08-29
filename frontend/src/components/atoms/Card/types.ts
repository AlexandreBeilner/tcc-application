import type { ButtonHTMLAttributes } from 'react'

export interface CardProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    // Borda de destaque (brand-500) — usada pelo card "Retomar lição"
    // (ResumeLessonCard) pra se diferenciar dos demais cards clicáveis.
    accent?: boolean
}
