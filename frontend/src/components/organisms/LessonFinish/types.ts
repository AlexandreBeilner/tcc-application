import type { ReactNode } from 'react'
import type { MarkerState } from '../../../features/lessons/lessonProgress'
import type { NextLessonTeaser } from '../../../features/lessons/nextLessonTeaser'

export interface LessonFinishProps {
    lessonTitle: string
    // Título do resultado ("Na mosca!", "Mandou bem!", "Lição concluída").
    resultTitle: string
    // Placar; omitido quando a lição não tem perguntas.
    score?: { states: MarkerState[]; summary: string }
    // XP creditado agora; omitido em revisão e quando a conclusão não creditou nada.
    xpAwarded?: number
    // "O que ficou"; sem itens o bloco não aparece.
    summary?: string[]
    // Texto do que a lição libera.
    nextStepText: string
    teaser?: NextLessonTeaser | null
    // Botão de compartilhar o resultado (LJ.5.10), logo abaixo do placar.
    share?: ReactNode
    // Botões do próximo passo.
    actions: ReactNode
}
