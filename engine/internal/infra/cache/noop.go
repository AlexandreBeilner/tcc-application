package cache

import (
	"context"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// NoopQuoteCache satisfaz a mesma porta de RedisQuoteCache sem nenhum
// efeito — usada quando REDIS_URL não está configurada (fora do
// docker-compose, ex: cmd/seed, um script standalone que não precisa de
// cache) ou quando o cache não deve participar de um caminho. Sempre um
// valor concreto (nunca um ponteiro nil embrulhado numa interface) pra não
// cair na armadilha clássica de Go de "typed nil" — todo método é seguro de
// chamar em qualquer instância de NoopQuoteCache{}.
type NoopQuoteCache struct{}

func (NoopQuoteCache) Get(ctx context.Context, assetID string) (catalog.Quote, bool, error) {
	return catalog.Quote{}, false, nil
}

func (NoopQuoteCache) Set(ctx context.Context, assetID string, quote catalog.Quote) error {
	return nil
}
