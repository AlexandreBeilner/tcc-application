package db

import (
	"context"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// quoteCache é a porta pequena (2 métodos) que CatalogRepository,
// TickRepository e OrderExecutionRepository consomem pro cache de leitura
// da última cotação (tarefa 5.7) — implementada por
// infra/cache.RedisQuoteCache contra o Redis (REDIS_URL) ou por
// infra/cache.NoopQuoteCache quando não há cache configurado, declarada
// aqui, no ponto de consumo, não numa pasta ports/ central
// (.claude/arquitetura-engine-go.md). Nenhum dos dois adapters concretos
// precisa saber que esta interface existe.
type quoteCache interface {
	Get(ctx context.Context, assetID string) (catalog.Quote, bool, error)
	Set(ctx context.Context, assetID string, quote catalog.Quote) error
}

// cachedQuote resolve assetID checando o cache primeiro — hit devolve
// direto, sem chamar load. Miss (ou erro de cache, tratado como miss) cai
// pra load, e populada o cache com o resultado antes de devolver, pronto
// pra a próxima leitura. Extraída como função só dependente das duas
// interfaces recebidas por parâmetro (sem acessar *sql.DB direto) pra ficar
// testável com fakes espiões, sem precisar de Postgres/Redis reais (ver
// quote_cache_test.go) — os três repositórios acima chamam esta função com
// o load específico de cada um (query de 1 ou 2 linhas em asset_quotes).
func cachedQuote(
	ctx context.Context,
	cache quoteCache,
	assetID string,
	load func(context.Context, string) (catalog.Quote, bool, error),
) (catalog.Quote, bool, error) {
	if quote, found, err := cache.Get(ctx, assetID); err == nil && found {
		return quote, true, nil
	}

	quote, found, err := load(ctx, assetID)
	if err != nil || !found {
		return quote, found, err
	}

	_ = cache.Set(ctx, assetID, quote)
	return quote, true, nil
}
