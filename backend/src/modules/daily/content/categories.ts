import type { ContentScope } from '../domain/content'

// Categorias do conteúdo do Diário (seção 3.3 do backlog), uma lista fechada compartilhada por
// palavras e perguntas. A agenda evita a mesma categoria em dias seguidos no mesmo cartão,
// então cada banco precisa usar várias. A coluna no banco é texto livre; esta lista é a regra do seed.
export const DAILY_CATEGORIES = [
  'planos-e-moeda',
  'juros-e-inflacao',
  'instituicoes',
  'crises-e-choques',
  'produtos-e-regras',
  'bolsa-e-acoes',
  'risco-e-analise',
  'economia-geral',
  // Acrescentadas em 2026-10-18 (foco em investimentos, política econômica e choques externos).
  'politica-fiscal',
  'cambio-e-setor-externo',
  'eventos-globais',
  'commodities-e-setores',
] as const

export type DailyCategory = (typeof DAILY_CATEGORIES)[number]

export type { ContentScope }
