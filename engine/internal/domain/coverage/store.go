package coverage

import (
	"context"

	"tcc-investimentos/engine/internal/domain/bot"
)

// MarketMakerLister é o colaborador de leitura do provisionamento: todos os
// Market Makers, ativos ou não, com o teto e os ativos que já cobrem.
type MarketMakerLister interface {
	ListMarketMakers(ctx context.Context) ([]MarketMaker, error)
}

// Provision é o que a cobertura de um ativo por um Market Maker grava.
type Provision struct {
	AssetID     string
	MMAccountID string
	// Shares é a posição inicial do Market Maker no ativo (0 = só cobertura).
	Shares int64
	// Price é o preço de referência da posição (average_price inicial).
	Price float64
	// Cash é o caixa somado ao saldo do Market Maker.
	Cash float64
	// OutstandingShares é o teto de float do ativo, validado ao gravar.
	OutstandingShares int64
}

// Provisioner é o colaborador de escrita do provisionamento.
type Provisioner interface {
	// CreateMarketMaker cria a conta (saldo zero) e a personalidade de um
	// Market Maker novo. Idempotente: retomar depois de uma falha no meio
	// completa só o que falta.
	CreateMarketMaker(ctx context.Context, accountID string, personality bot.Personality) error
	// ProvisionCoverage grava, atomicamente, a cobertura, a posição e o
	// caixa, tudo por Event Sourcing. Idempotente: par já coberto não
	// grava nada de novo.
	ProvisionCoverage(ctx context.Context, provision Provision) error
}
