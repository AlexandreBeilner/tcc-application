package coverage

import "context"

// MarketMakerLister é o colaborador de leitura do provisionamento
// (EnsureCoverage, tarefa P.2): todos os Market Makers, ativos ou não, com o
// teto e os ativos que já cobrem, pra Assign decidir.
type MarketMakerLister interface {
	ListMarketMakers(ctx context.Context) ([]MarketMaker, error)
}

// Writer grava uma cobertura nova. Idempotente: repetir um par
// (assetID, mmAccountID) já gravado não é erro nem duplica.
type Writer interface {
	AddCoverage(ctx context.Context, assetID, mmAccountID string) error
}
