package bot

import "math"

// Tamanho do pool de bots direcionais (Ruído, Chartista e Fundamentalista),
// tarefa Q.2 (achado 014 de pontos-em-aberto-decisao-produto.md). Desde a Q.8 o
// pool NÃO determina o custo nem o volume do tick (o orçamento de turnos,
// TurnBudget, faz isso): ele só garante diversidade de perfis (arquétipos,
// setores e classes de ativo) para escolher o bot de cada turno. Todos os
// valores são ilustrativos, a validar no benchmark da tarefa Q.4.
const (
	// MinPoolSize é o pool mínimo: a faixa de 15 a 25 bots da proposta 2.3.2, que
	// também garante que todo setor e classe de ativo tenha os 3 arquétipos.
	MinPoolSize = 19
	// BotsPerAsset é quantos bots direcionais o catálogo ganha por ativo.
	BotsPerAsset = 2.0
	// MaxPoolSize é o teto de bots: acima dele mais bots não mudam a diversidade
	// de perfis e só custam contas e caixa no seed.
	MaxPoolSize = 150
)

// PoolSize devolve quantos bots direcionais um catálogo de assetCount ativos
// negociáveis precisa: BotsPerAsset por ativo, entre MinPoolSize e MaxPoolSize.
// Função pura e monotônica, reaproveitável pelo painel de bots (Fase N).
func PoolSize(assetCount int) int {
	size := int(math.Ceil(BotsPerAsset * float64(assetCount)))
	if size < MinPoolSize {
		return MinPoolSize
	}
	if size > MaxPoolSize {
		return MaxPoolSize
	}
	return size
}
