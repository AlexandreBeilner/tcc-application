// Package cache implementa, contra Redis, a porta pequena de cache de
// cotação que internal/infra/db declara no ponto de consumo (tarefa 5.7,
// primeira consumidora real do REDIS_URL provisionado desde 1.2/1.1d —
// confirmado vazio por grep antes desta tarefa). Ver
// .claude/arquitetura-engine-go.md: interface do lado de quem consome, não
// de quem implementa — este pacote nunca importa internal/domain nada além
// de catalog.Quote (o tipo de valor trafegado), e internal/infra/db nunca
// importa este pacote por nome de tipo, só por assinatura estrutural.
package cache

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/redis/go-redis/v9"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// NewClient conecta ao Redis a partir de redisURL (mesmo formato de
// DATABASE_URL — redis://host:porta/db). Não faz PING aqui: falha de rede
// aparece no primeiro Get/Set real, mesmo padrão de db.Open (que também não
// verifica a conexão na hora de abrir o pool).
func NewClient(redisURL string) (*redis.Client, error) {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}
	return redis.NewClient(opts), nil
}

// RedisQuoteCache guarda a última cotação (preço + variação percentual) de
// cada ativo como JSON numa chave por asset_id, sem TTL — write-through
// (TickRepository.SaveTick) garante que o valor nunca fica desatualizado
// enquanto o Temporizador roda; a fonte da verdade continua sendo Postgres
// (asset_quotes), o cache nunca é escrito sem a gravação correspondente já
// commitada (CLAUDE.md, Event Sourcing/write-through).
type RedisQuoteCache struct {
	client *redis.Client
}

func NewRedisQuoteCache(client *redis.Client) *RedisQuoteCache {
	return &RedisQuoteCache{client: client}
}

func quoteKey(assetID string) string {
	return "quote:" + assetID
}

// Get devolve a última cotação em cache de assetID — found = false tanto
// pra chave ausente (cache frio/miss) quanto for construção, nunca por
// erro: falha de rede/serialização devolve err != nil, e cachedQuote (db
// package) trata isso como miss, caindo pro Postgres.
func (c *RedisQuoteCache) Get(ctx context.Context, assetID string) (catalog.Quote, bool, error) {
	raw, err := c.client.Get(ctx, quoteKey(assetID)).Bytes()
	if errors.Is(err, redis.Nil) {
		return catalog.Quote{}, false, nil
	}
	if err != nil {
		return catalog.Quote{}, false, err
	}

	var quote catalog.Quote
	if err := json.Unmarshal(raw, &quote); err != nil {
		return catalog.Quote{}, false, err
	}
	return quote, true, nil
}

func (c *RedisQuoteCache) Set(ctx context.Context, assetID string, quote catalog.Quote) error {
	raw, err := json.Marshal(quote)
	if err != nil {
		return err
	}
	return c.client.Set(ctx, quoteKey(assetID), raw, 0).Err()
}
