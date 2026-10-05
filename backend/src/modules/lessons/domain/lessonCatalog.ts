import type { LessonSummary } from './lesson'

// Lição como o painel a enxerga (N.18/N.23): o conteúdo inteiro mais o estado de publicação,
// que o jogador nunca vê (`listAll` do jogador já devolve só as publicadas).
export interface CatalogLesson extends LessonSummary {
  published: boolean
}

// Agregados brutos de `user_lesson_progress` de uma lição, como o repositório os entrega.
// "Iniciou" = qualquer linha que não seja só uma dispensa nunca aberta (N.24): a dispensa grava
// uma linha no passo 0 sem o usuário ter feito nada, e contá-la inflaria "iniciaram" e o abandono.
export interface LessonFunnelCounts {
  started: number
  completed: number
  // Tempo entre iniciar e concluir, só de quem concluiu sem dispensa. Inclui pausas (quem volta
  // no dia seguinte entra com a pausa), por isso a mediana vem junto da média.
  avgSecondsToComplete: number | null
  medianSecondsToComplete: number | null
  // Só lição com aposta real (opções + resposta certa) e só quem concluiu com a escolha gravada.
  betAnswered: number
  betCorrect: number
  // Quem iniciou e não concluiu, por passo gravado (0 cenário, 1 micro-decisão, 2 revelação,
  // 3 desbloqueio). Sempre 4 posições.
  abandonedByStep: number[]
}

export interface LessonFunnel extends LessonFunnelCounts {
  // `null` quando não há base (ninguém iniciou, lição sem aposta): a tela mostra "sem dados".
  completionRate: number | null
  betAccuracy: number | null
  abandoned: number
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : part / whole
}

export function buildLessonFunnel(counts: LessonFunnelCounts): LessonFunnel {
  return {
    ...counts,
    completionRate: ratio(counts.completed, counts.started),
    betAccuracy: ratio(counts.betCorrect, counts.betAnswered),
    abandoned: counts.abandonedByStep.reduce((sum, n) => sum + n, 0),
  }
}

export interface LessonCatalogEntry {
  lesson: CatalogLesson
  // Código da lição publicada imediatamente anterior na ordem da trilha (a progressão é linear,
  // spec 5.1): é o "pré-requisito" da lição. `null` na primeira.
  prerequisiteCode: string | null
  funnel: LessonFunnel
}

// Pré-requisito = a publicada anterior na ordem. Lição despublicada não tem pré-requisito (não
// está na trilha) e também não é pré-requisito de ninguém.
export function prerequisiteCodes(lessons: CatalogLesson[]): Map<string, string | null> {
  const published = lessons.filter((l) => l.published).sort((a, b) => a.sortOrder - b.sortOrder)
  const result = new Map<string, string | null>()
  published.forEach((lesson, index) => {
    result.set(lesson.id, index === 0 ? null : published[index - 1].code)
  })
  return result
}
