// Listas fixas usadas pra montar um alvo de evento macro na tela 10.2
// (`sector`/`risk_class`, o terceiro caso — `asset_id` — vem do catálogo
// de ativos via `useAssetsQuery`, não é uma lista fixa). Espelha as
// mesmas 6 categorias de `companies.sector` (`engine/internal/domain/
// catalog/company.go`, spec 3.3.2 linha 145) e as 2 classes de risco de
// `assets.risk_class` (`engine/internal/domain/equity/gbm.go`, spec 3.2)
// — nenhuma delas exposta por endpoint próprio hoje, então fixadas aqui
// como no motor.
export const MACRO_EVENT_SECTORS = ['Mineração', 'Agronegócio', 'Bancário/Financeiro', 'Varejo', 'Energia', 'Tecnologia'] as const

export const MACRO_EVENT_RISK_CLASSES = ['Conservador', 'Sofisticado'] as const
