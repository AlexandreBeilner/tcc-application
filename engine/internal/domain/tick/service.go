package tick

import (
	"context"

	"tcc-investimentos/engine/internal/domain/selic"
)

// Service executa um tick completo (ler estado → calcular próximo passo →
// executar as rodadas de negociação de bot (Fase D.2, rounds.go) → persistir),
// tanto pro job diário automático quanto pro disparo manual via POST
// /admin/tick (tarefa 3.11) — os dois caminhos chamam Run, a única diferença
// é quem aciona.
type Service struct {
	repo           Repository
	bots           BotRoster
	priceHistory   PriceHistoryReader
	orderContext   OrderContextLoader
	orderSubmitter OrderSubmitter
	selicCfg       selic.Config
	seed           int64
}

// NewService monta o orquestrador do Temporizador. selicCfg.Initial é
// ignorado (Advance usa o estado persistido); os demais campos (Neutral,
// ReversionSpeed, Volatility) calibram a reversão à média da Selic
// simulada, mesma calibração de selic.DefaultConfig. seed é a seed base da
// simulação (RNF08) — fixa entre reinícios, configurada uma vez na
// composição (cmd/api/main.go). bots/priceHistory/orderContext/orderSubmitter
// (Fase D.2, rounds.go) alimentam runIntradayRounds — concretamente
// *db.BotRepository, *db.TickRepository, *db.OrderExecutionRepository e
// *orderexecution.Service (o mesmo já usado por POST /orders, sem caminho
// paralelo pra ordem de bot).
func NewService(repo Repository, bots BotRoster, priceHistory PriceHistoryReader, orderContext OrderContextLoader, orderSubmitter OrderSubmitter, selicCfg selic.Config, seed int64) *Service {
	return &Service{
		repo:           repo,
		bots:           bots,
		priceHistory:   priceHistory,
		orderContext:   orderContext,
		orderSubmitter: orderSubmitter,
		selicCfg:       selicCfg,
		seed:           seed,
	}
}

// Run lê o último estado persistido, calcula o próximo tick (Advance) e
// grava o resultado. Se o Temporizador nunca rodou (motor recém-subido,
// sem linha em market_calendar), começa do dia 0 com a Selic neutra de
// selicCfg como taxa inicial.
func (s *Service) Run(ctx context.Context) (Result, error) {
	current, found, err := s.repo.LoadState(ctx)
	if err != nil {
		return Result{}, err
	}
	if !found {
		current = State{Day: 0, SelicRate: s.selicCfg.Neutral}
	}

	assets, err := s.repo.ListPricingAssets(ctx)
	if err != nil {
		return Result{}, err
	}

	companies, err := s.repo.ListCompaniesForFundamentals(ctx)
	if err != nil {
		return Result{}, err
	}

	macroEvents, err := s.repo.ListPendingMacroEvents(ctx)
	if err != nil {
		return Result{}, err
	}

	dividendPayers, err := s.repo.ListDividendPayerAssets(ctx)
	if err != nil {
		return Result{}, err
	}

	pendingDividends, err := s.repo.ListPendingDividendPayments(ctx)
	if err != nil {
		return Result{}, err
	}

	result := Advance(current, assets, companies, macroEvents, dividendPayers, pendingDividends, s.selicCfg, s.seed)

	dayIndex := result.State.Day - 1 // 0-based, mesma convenção de Advance
	closingPrices, fillsExecuted, err := s.runIntradayRounds(ctx, dayIndex, result.IntradayRounds, assets, result.CompanyContext, result.State.SelicRate, s.selicCfg.Neutral)
	if err != nil {
		return Result{}, err
	}
	for assetID, price := range closingPrices {
		result.Quotes = append(result.Quotes, Quote{AssetID: assetID, Price: price})
	}
	result.IntradayFillsCount = fillsExecuted

	if err := s.repo.SaveTick(ctx, result); err != nil {
		return Result{}, err
	}
	return result, nil
}
