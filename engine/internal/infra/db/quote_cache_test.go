package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// spyQuoteCache é o "espião" pedido pelo critério de aceite da tarefa 5.7 —
// conta chamadas a Get/Set em memória, sem Redis real, e deixa o cenário de
// cache frio/quente determinístico (nada de latência de parede).
type spyQuoteCache struct {
	store   map[string]catalog.Quote
	getHits int
	setHits int
}

func newSpyQuoteCache() *spyQuoteCache {
	return &spyQuoteCache{store: make(map[string]catalog.Quote)}
}

func (s *spyQuoteCache) Get(_ context.Context, assetID string) (catalog.Quote, bool, error) {
	s.getHits++
	quote, found := s.store[assetID]
	return quote, found, nil
}

func (s *spyQuoteCache) Set(_ context.Context, assetID string, quote catalog.Quote) error {
	s.setHits++
	s.store[assetID] = quote
	return nil
}

func TestCachedQuote_CacheFrioCaiParaLoadEPopulaCache(t *testing.T) {
	cache := newSpyQuoteCache()
	loadCalls := 0
	pct := 1.5
	load := func(context.Context, string) (catalog.Quote, bool, error) {
		loadCalls++
		return catalog.Quote{Price: 10, DailyChangePct: &pct}, true, nil
	}

	quote, found, err := cachedQuote(context.Background(), cache, "asset-1", load)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !found || quote.Price != 10 {
		t.Fatalf("esperado found=true price=10, veio found=%v quote=%+v", found, quote)
	}
	if loadCalls != 1 {
		t.Fatalf("esperado 1 chamada a load (cache frio), veio %d", loadCalls)
	}
	if cache.setHits != 1 {
		t.Fatalf("esperado cache populado (1 Set) após o miss, veio %d", cache.setHits)
	}
}

func TestCachedQuote_SegundaLeituraNaoChamaLoadDeNovo(t *testing.T) {
	cache := newSpyQuoteCache()
	loadCalls := 0
	load := func(context.Context, string) (catalog.Quote, bool, error) {
		loadCalls++
		return catalog.Quote{Price: 20}, true, nil
	}

	if _, _, err := cachedQuote(context.Background(), cache, "asset-1", load); err != nil {
		t.Fatalf("erro na primeira leitura: %v", err)
	}
	quote, found, err := cachedQuote(context.Background(), cache, "asset-1", load)
	if err != nil {
		t.Fatalf("erro na segunda leitura: %v", err)
	}
	if !found || quote.Price != 20 {
		t.Fatalf("esperado found=true price=20 (do cache), veio found=%v quote=%+v", found, quote)
	}
	if loadCalls != 1 {
		t.Fatalf("esperado load chamado só na primeira leitura (cache quente na segunda), veio %d chamadas", loadCalls)
	}
}

func TestCachedQuote_AssetNaoEncontradoNaoPopulaCache(t *testing.T) {
	cache := newSpyQuoteCache()
	load := func(context.Context, string) (catalog.Quote, bool, error) {
		return catalog.Quote{}, false, nil
	}

	_, found, err := cachedQuote(context.Background(), cache, "asset-inexistente", load)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if found {
		t.Fatalf("esperado found=false")
	}
	if cache.setHits != 0 {
		t.Fatalf("esperado nenhum Set pra asset sem cotação, veio %d", cache.setHits)
	}
}
