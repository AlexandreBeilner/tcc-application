package tick

import (
	"context"
	"sort"
	"sync"

	"tcc-investimentos/engine/internal/domain/ipca"
	"tcc-investimentos/engine/internal/domain/selic"
)

// Service executa um tick completo (ler estado → calcular próximo passo →
// executar as rodadas de negociação de bot (Fase D.2, rounds.go) → persistir),
// tanto pro job diário automático quanto pro disparo manual via POST
// /admin/tick (tarefa 3.11) — os dois caminhos chamam Run, a única diferença
// é quem aciona. mu serializa as duas chamadas dentro do mesmo processo
// (achado do review do PR da Fase D, backlog-motor-mercado-realista): sem
// ela, o job diário (scheduler.RunDaily) e um POST /admin/tick concorrente
// podiam ler o mesmo State.Day, cada um rodar suas próprias rodadas
// intradiárias e os dois chamarem SaveTick, quebrando a invariante de uma
// linha de asset_quotes por ativo por dia. A Fase D.2 tornou essa janela
// bem mais larga (Run passou de poucas queries pra O(rodadas × bots
// elegíveis) round trips síncronos), por isso a proteção passou a valer a
// pena mesmo sem lock distribuído — motor roda como processo único (sem
// múltiplas réplicas), então sync.Mutex já basta.
type Service struct {
	repo           Repository
	bots           BotRoster
	priceHistory   PriceHistoryReader
	tradedVolume   TradedVolumeReader
	orderContext   OrderContextLoader
	orderSubmitter OrderSubmitter
	orderLifecycle OrderLifecycleManager
	selicCfg       selic.Config
	ipcaCfg        ipca.Config
	seed           int64
	mu             sync.Mutex
}

// NewService monta o orquestrador do Temporizador. selicCfg.Initial é
// ignorado (Advance usa o estado persistido); os demais campos (Neutral,
// ReversionSpeed, Volatility) calibram a reversão à média da Selic
// simulada, mesma calibração de selic.DefaultConfig. ipcaCfg (tarefa M.1)
// calibra o IPCA mensal sintético (ipca.DefaultConfig) — diferente de
// selicCfg, não tem um campo "Initial" (IPCA não tem estado/memória entre
// meses, ver doc do pacote ipca). seed é a seed base da
// simulação (RNF08) — fixa entre reinícios, configurada uma vez na
// composição (cmd/api/main.go). bots/priceHistory/tradedVolume/orderContext/
// orderSubmitter/orderLifecycle (Fase D.2/achado 005, rounds.go) alimentam
// runIntradayRounds/Run — concretamente *db.BotRepository, *db.TickRepository
// (repassado duas vezes: PriceHistoryReader e TradedVolumeReader),
// *db.OrderExecutionRepository (repassado duas vezes: OrderContextLoader e
// OrderLifecycleManager) e *orderexecution.Service (submissão — o mesmo já
// usado por POST /orders, sem caminho paralelo pra ordem de bot).
func NewService(repo Repository, bots BotRoster, priceHistory PriceHistoryReader, tradedVolume TradedVolumeReader, orderContext OrderContextLoader, orderSubmitter OrderSubmitter, orderLifecycle OrderLifecycleManager, selicCfg selic.Config, ipcaCfg ipca.Config, seed int64) *Service {
	return &Service{
		repo:           repo,
		bots:           bots,
		priceHistory:   priceHistory,
		tradedVolume:   tradedVolume,
		orderContext:   orderContext,
		orderSubmitter: orderSubmitter,
		orderLifecycle: orderLifecycle,
		selicCfg:       selicCfg,
		ipcaCfg:        ipcaCfg,
		seed:           seed,
	}
}

// Run lê o último estado persistido, calcula o próximo tick (Advance) e
// grava o resultado. Se o Temporizador nunca rodou (motor recém-subido,
// sem linha em market_calendar), começa do dia 0 com a Selic neutra de
// selicCfg como taxa inicial.
func (s *Service) Run(ctx context.Context) (Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

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

	result := Advance(current, assets, companies, macroEvents, dividendPayers, pendingDividends, s.selicCfg, s.ipcaCfg, s.seed)

	dayIndex := result.State.Day - 1 // 0-based, mesma convenção de Advance

	// Achado 005 parte A.3: expira ordens obsoletas (pending/partially_filled
	// de um dia simulado anterior) antes de rodar as rodadas do dia novo —
	// nenhuma ordem de um dia anterior chega a competir pela liquidez de
	// hoje. currentSimulatedDay = dayIndex porque market_calendar.current_day
	// ainda não foi atualizado por SaveTick neste ponto: seu valor de agora
	// é exatamente current.Day, que é igual a dayIndex por construção
	// (dayIndex = result.State.Day - 1 = (current.Day+1) - 1 = current.Day)
	// — o mesmo dia que toda ordem nova (humana ou de bot) submetida durante
	// este tick carimba via orderexecution.Context.SimulatedDay.
	expiredOrdersCount, err := s.orderLifecycle.ExpireStaleOrders(ctx, dayIndex)
	if err != nil {
		return Result{}, err
	}

	closingPrices, volumeByAssetID, fillsExecuted, err := s.runIntradayRounds(ctx, dayIndex, result.IntradayRounds, assets, result.CompanyContext, result.State.SelicRate, s.selicCfg.Neutral)
	if err != nil {
		return Result{}, err
	}
	// Ordenado por AssetID (não a ordem de iteração do map, não-determinística
	// em Go) — RNF08 exige que a mesma seed produza o mesmo Result inteiro,
	// Quotes incluso, não só os mesmos preços.
	closingAssetIDs := make([]string, 0, len(closingPrices))
	for assetID := range closingPrices {
		closingAssetIDs = append(closingAssetIDs, assetID)
	}
	sort.Strings(closingAssetIDs)
	for _, assetID := range closingAssetIDs {
		result.Quotes = append(result.Quotes, Quote{AssetID: assetID, Price: closingPrices[assetID], Quantity: volumeByAssetID[assetID]})
	}
	result.IntradayFillsCount = fillsExecuted
	result.ExpiredOrdersCount = expiredOrdersCount

	if err := s.repo.SaveTick(ctx, result); err != nil {
		return Result{}, err
	}
	return result, nil
}
