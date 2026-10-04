// Tipos do contrato `blocks` do conteúdo visual das lições (RC.3.1). A
// validação (Zod) vive em `infrastructure/content/lessonBlocks.ts`: o domínio
// não importa biblioteca externa. Cada fase vira uma lista de blocos tipados;
// `lessons.blocks` nulo faz o player usar o texto legado.
export type WidgetId =
  'callout' | 'growth-calculator' | 'fixed-income-comparison' | 'live-indicator' | 'live-macro'

export type LessonBlock =
  | { type: 'text'; markup: string }
  | { type: 'widget'; id: string; widget: WidgetId; props?: unknown; caption?: string }

export interface LessonBlocks {
  schemaVersion: 1
  phases: {
    scenario: LessonBlock[]
    microDecision: LessonBlock[]
    revelation: LessonBlock[]
  }
}
