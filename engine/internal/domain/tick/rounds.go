// Package tick — execução das rodadas de negociação de bot dentro do
// sub-tick (tarefa D.2, backlog-motor-mercado-realista) — consome
// Result.IntradayRounds (Fase D.1) depois que Advance devolve, coletando a
// decisão de cada bot elegível (bot.Decide, C.2-C.6/D.2) e submetendo contra
// orderexecution (já sem liquidez sintética, A.2). Diferente de Advance,
// este arquivo não é puro: precisa de leitura/escrita ao vivo (caixa/posição
// mudam a cada fill dentro do próprio dia, coisa que Result.Quotes/
// asset_quotes só reflete no fechamento) — por isso vive como método de
// *Service, não como função de domínio testável isoladamente igual a
// Advance. Escopo restrito a Ação por enquanto (tick.go já exclui Ação do
// GBM, ver assetTypeAcao) — FII/ETF continuam fora até as Fases G/H
// estenderem o mesmo motor.
package tick

import (
	"context"
	"math/rand"
	"sort"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// ChartistPriceHistoryDays é o tamanho da janela de fechamentos diários
// (asset_quotes) que o arquétipo Chartista usa pra avaliar tendência
// (bot.DecideChartistOrder) — a proposta 2.4/C.4 não fixa "quantos dias",
// mesma nota de "valor ilustrativo, sujeito a calibração futura" já dada a
// outros coeficientes do motor.
const ChartistPriceHistoryDays = 5

// CompanyRoundContext é "o que se sabe hoje" sobre uma empresa — financeiros
// derivados (fundamentals.DeriveFinancials) e crescimento esperado
// (fundamentals.ExpectedGrowth), calculados por Advance pra TODA empresa
// (companyRoundContexts, tick.go), não só as que bateram dia de relatório
// neste tick. Consumido só pelo arquétipo Fundamentalista dentro de
// runIntradayRounds.
type CompanyRoundContext struct {
	Financials fundamentals.Financials
	GrowthRate float64
}

// BotForRound é o roster de um bot elegível pra uma rodada de negociação
// (account.EligibleForTradingRound: is_bot && is_active) com sua
// personalidade persistida (C.6) — insumo de BotRoster.ListEligibleForTradingRound.
type BotForRound struct {
	UserID      string
	Personality bot.Personality
}

// BotRoster lista os bots elegíveis pra participar de uma rodada de
// negociação (Fase D.2) — implementado por *db.BotRepository.
type BotRoster interface {
	ListEligibleForTradingRound(ctx context.Context) ([]BotForRound, error)
}

// PriceHistoryReader lê os últimos fechamentos diários (asset_quotes) de um
// ativo, em ordem cronológica — insumo do arquétipo Chartista
// (ChartistPriceHistoryDays). Implementado por *db.TickRepository.
type PriceHistoryReader interface {
	RecentClosingPrices(ctx context.Context, assetID string, days int) ([]float64, error)
}

// OrderContextLoader é o "peek" de saldo/posição/float finito que a coleta
// de decisão de bot precisa antes de decidir uma ordem — mesmo LoadContext
// que orderexecution.Repository já expõe (implementado pelo mesmo
// *db.OrderExecutionRepository), redeclarado aqui como interface de 1
// método só, no ponto de consumo (.claude/arquitetura-engine-go.md). O
// ReferencePrice devolvido por este LoadContext é ignorado por
// runIntradayRounds (vem de asset_quotes, que só reflete o fechamento do
// dia anterior) — o preço de referência intradiário é rastreado à parte, em
// memória, a partir dos fills reais desta mesma chamada (ver
// runIntradayRounds).
type OrderContextLoader interface {
	LoadContext(ctx context.Context, assetID, userID string) (orderexecution.Context, error)
}

// OrderSubmitter executa e persiste a ordem decidida por um bot — mesmo
// Submit que orderexecution.Service já expõe pro fluxo HTTP de usuário
// humano (POST /orders); um bot é só mais uma conta real (A.1), então o
// mesmíssimo caminho (Event Sourcing, validação de saldo/posição/float)
// vale pra ordem de bot sem nenhum caso especial.
type OrderSubmitter interface {
	Submit(ctx context.Context, req orderexecution.Request) (orderexecution.Outcome, error)
}

// equityRoundState é o estado mutável (em memória, só durante esta chamada
// de runIntradayRounds) de um ativo de Ação ao longo do dia — Price começa
// no último fechamento conhecido (ou DefaultInitialPrice, sem nenhum ainda)
// e é atualizado a cada fill real, refletindo o preço da negociação mais
// recente pra qualquer bot que decida depois dentro do mesmo dia (mesma e
// qualquer rodada seguinte) — é isso que dá a "path-dependence" intradiária
// que asset_quotes (só 1 linha por dia) não consegue expressar sozinho.
type equityRoundState struct {
	Sector    catalog.Sector
	RiskClass equity.RiskClass
	CompanyID *string
	Price     float64
}

// roundSeed deriva uma seed determinística e independente por (dia, rodada,
// bot, propósito) — mesma técnica de isolamento de processo por entidade já
// usada em deterministicSeed (tick.go)/bot.InitialAllocation, aqui composta
// com dois inteiros a mais (dayIndex, roundIndex) pra nenhum bot repetir a
// mesma sequência aleatória em dois (dia, rodada) diferentes. purpose separa
// o sorteio de "qual ativo negociar" (SelectAssetForRound) do sorteio
// "qual ordem gerar" (bot.Decide, só Ruído/Fundamentalista usam seed) —
// duas decisões independentes do mesmo bot na mesma rodada não podem
// compartilhar o mesmo stream de números aleatórios. roundIndex nunca passa
// de 4 (IntradayRounds, D.1), então multiplicar dayIndex por 10 é suficiente
// pra nunca colidir os dois.
func roundSeed(baseSeed int64, dayIndex, roundIndex int, botUserID, purpose string) int64 {
	return deterministicSeed(baseSeed, botUserID+":"+purpose) + int64(dayIndex)*10 + int64(roundIndex)
}

// buildEquityUniverse filtra assets pras Ações (Fase D.2 — FII/ETF ainda
// fora, ver assetTypeAcao) e monta tanto o estado mutável por ativo
// (equities, indexado por AssetID) quanto o universo pequeno que
// bot.SelectAssetForRound precisa (sem preço/CompanyID, só o que importa pra
// checar escopo).
func buildEquityUniverse(assets []AssetForPricing) (map[string]*equityRoundState, []bot.EquityForRound) {
	equities := make(map[string]*equityRoundState)
	universe := make([]bot.EquityForRound, 0, len(assets))
	for _, a := range assets {
		if a.Type != assetTypeAcao {
			continue
		}

		var sector catalog.Sector
		if a.Sector != nil {
			sector = catalog.Sector(*a.Sector)
		}
		riskClass := riskClassForPricing(a.RiskClass)

		price := DefaultInitialPrice
		if a.LastPrice != nil {
			price = *a.LastPrice
		}

		equities[a.AssetID] = &equityRoundState{Sector: sector, RiskClass: riskClass, CompanyID: a.CompanyID, Price: price}
		universe = append(universe, bot.EquityForRound{AssetID: a.AssetID, Sector: sector, RiskClass: riskClass})
	}
	return equities, universe
}

// decisionInputFor monta o bot.DecisionInput de um bot pro ativo escolhido
// nesta rodada — campos comuns aos 4 arquétipos vêm de state/execCtx/Selic;
// PriceHistory (Chartista) e Financials/GrowthRate/OutstandingShares
// (Fundamentalista) só são resolvidos quando o arquétipo do bot realmente
// precisa (evita ler asset_quotes pra todo bot de todo arquétipo). Devolve
// ok = false quando o arquétipo do bot precisa de um insumo que não está
// disponível agora (ex: Fundamentalista sem CompanyID/OutstandingShares/
// CompanyContext) — mesmo tratamento de "bot não participa desta rodada"
// que os erros de bot.Decide já dão, só que resolvido antes de chamar
// Decide.
func (s *Service) decisionInputFor(
	ctx context.Context,
	personality bot.Personality,
	state *equityRoundState,
	execCtx orderexecution.Context,
	companyContext map[string]CompanyRoundContext,
	selicRate, selicNeutral float64,
	seed int64,
	priceHistoryCache map[string][]float64,
	assetID string,
) (bot.DecisionInput, bool, error) {
	input := bot.DecisionInput{
		ReferencePrice:  state.Price,
		AvailableCash:   execCtx.IncomingUserBalance,
		CurrentPosition: execCtx.IncomingUserPosition,
		// bot.FundamentalistFairPrice divide ROE (fração decimal, ex: 0.08)
		// por requiredReturn — os dois precisam estar na mesma escala pra
		// essa razão fazer sentido (fundamentalist_test.go já testa isso com
		// Selic em fração decimal, ex: 0.10 = 10%). selicRate/selicNeutral
		// aqui chegam na escala 0-100 do resto do motor (selic.Config/
		// equity.Config, ex: 10.0 = 10%) — convertidos pra fração decimal
		// só neste ponto de fronteira, não em fundamentals.ExpectedGrowth
		// (companyRoundContexts, tick.go), que já usa a escala 0-100
		// corretamente há várias sessões (a mesma usada por
		// selic.NextCalendarRate/equity.NextPrice).
		SelicAnnualRate: selicRate / 100,
		SelicNeutral:    selicNeutral / 100,
		RiskClass:       state.RiskClass,
		Seed:            seed,
	}

	switch personality.Archetype {
	case bot.ArchetypeChartista:
		history, cached := priceHistoryCache[assetID]
		if !cached {
			var err error
			history, err = s.priceHistory.RecentClosingPrices(ctx, assetID, ChartistPriceHistoryDays)
			if err != nil {
				return bot.DecisionInput{}, false, err
			}
			priceHistoryCache[assetID] = history
		}
		input.PriceHistory = append(append([]float64{}, history...), state.Price)

	case bot.ArchetypeFundamentalista:
		if state.CompanyID == nil || execCtx.OutstandingShares == nil {
			return bot.DecisionInput{}, false, nil
		}
		cc, ok := companyContext[*state.CompanyID]
		if !ok {
			return bot.DecisionInput{}, false, nil
		}
		input.Financials = cc.Financials
		input.GrowthRate = cc.GrowthRate
		input.OutstandingShares = *execCtx.OutstandingShares
	}

	return input, true, nil
}

// runIntradayRounds executa, pra cada rodada sorteada em D.1, a coleta de
// decisão de cada bot elegível (roster ordenado por UserID — mesma
// determinismo de qualquer outra iteração do motor, RNF08) mais o matching
// via orderexecution (D.2, proposta 2.4). Bots são processados
// sequencialmente dentro de cada rodada (não em paralelo): o preço de
// referência de um ativo (equityRoundState.Price) é atualizado a cada fill
// real, então o próximo bot da mesma rodada já decide contra o preço
// pós-negociação do bot anterior — é assim que o motor ganha
// path-dependence intradiária de verdade, não só entre dias.
//
// Erro de decisão (bot.ErrNoViableOrder/ErrNoClearTrend/
// ErrNoMispricingDetected/ErrInsufficientPriceHistory, ou insumo ausente pro
// arquétipo — ver decisionInputFor) só pula o bot nesta rodada, nunca aborta
// o tick inteiro (mesmo contrato documentado em cada Decide*, C.2-C.5). Erro
// de IO (LoadContext/Submit/RecentClosingPrices/ListEligibleForTradingRound)
// propaga e aborta — mesmo padrão de qualquer outra leitura de Run.
//
// Devolve o preço de fechamento (última negociação real de todo o dia,
// nenhuma se nada negociou) de cada Ação negociável — vazio se não há
// nenhuma Ação no catálogo ainda (Fases G/H, quando FII/ETF entrarem aqui,
// vão alimentar o mesmo mecanismo) — e quantos fills reais aconteceram no
// total, só pra observabilidade (ver tickResponse, httpserver/admin.go).
func (s *Service) runIntradayRounds(
	ctx context.Context,
	dayIndex int,
	rounds []IntradayRound,
	assets []AssetForPricing,
	companyContext map[string]CompanyRoundContext,
	selicRate, selicNeutral float64,
) (map[string]float64, int, error) {
	equities, universe := buildEquityUniverse(assets)
	if len(universe) == 0 || len(rounds) == 0 {
		return nil, 0, nil
	}

	roster, err := s.bots.ListEligibleForTradingRound(ctx)
	if err != nil {
		return nil, 0, err
	}
	sort.Slice(roster, func(i, j int) bool { return roster[i].UserID < roster[j].UserID })

	priceHistoryCache := make(map[string][]float64)
	fillsExecuted := 0

	for _, round := range rounds {
		for _, b := range roster {
			assetRng := rand.New(rand.NewSource(roundSeed(s.seed, dayIndex, round.SequenceIndex, b.UserID, "asset")))
			chosen, err := bot.SelectAssetForRound(b.Personality.Scope, universe, assetRng)
			if err != nil {
				continue
			}
			state := equities[chosen.AssetID]

			execCtx, err := s.orderContext.LoadContext(ctx, chosen.AssetID, b.UserID)
			if err != nil {
				return nil, fillsExecuted, err
			}

			decisionSeed := roundSeed(s.seed, dayIndex, round.SequenceIndex, b.UserID, "decision")
			input, ok, err := s.decisionInputFor(ctx, b.Personality, state, execCtx, companyContext, selicRate, selicNeutral, decisionSeed, priceHistoryCache, chosen.AssetID)
			if err != nil {
				return nil, fillsExecuted, err
			}
			if !ok {
				continue
			}

			decisions, err := bot.Decide(b.Personality, input)
			if err != nil {
				continue
			}

			for _, d := range decisions {
				outcome, err := s.orderSubmitter.Submit(ctx, orderexecution.Request{
					UserID:   b.UserID,
					AssetID:  chosen.AssetID,
					Side:     d.Side,
					Type:     d.Type,
					Price:    d.Price,
					Quantity: d.Quantity,
				})
				if err != nil {
					return nil, fillsExecuted, err
				}
				fillsExecuted += len(outcome.Fills)
				if len(outcome.Fills) > 0 {
					state.Price = outcome.Fills[len(outcome.Fills)-1].Price
				}
			}
		}
	}

	closingPrices := make(map[string]float64, len(equities))
	for assetID, state := range equities {
		closingPrices[assetID] = state.Price
	}
	return closingPrices, fillsExecuted, nil
}
