// Package tick — execução das rodadas de negociação de bot dentro do
// sub-tick (tarefa D.2, backlog-motor-mercado-realista) — consome
// Result.IntradayRounds (Fase D.1) depois que Advance devolve, coletando a
// decisão de cada bot elegível (bot.Decide, C.2-C.6/D.2) e submetendo contra
// orderexecution (já sem liquidez sintética, A.2). Diferente de Advance,
// este arquivo não é puro: precisa de leitura/escrita ao vivo (caixa/posição
// mudam a cada fill dentro do próprio dia, coisa que Result.Quotes/
// asset_quotes só reflete no fechamento) — por isso vive como método de
// *Service, não como função de domínio testável isoladamente igual a
// Advance. Escopo cobre Ação e FII (tick.go já exclui as duas classes do
// GBM, ver assetTypeAcao/assetTypeFII) desde a tarefa G.1 — ETF continua
// fora até a Fase H estender o mesmo motor.
package tick

import (
	"context"
	"errors"
	"math/rand"
	"sort"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// MaxOrderPctOfAverageVolumePct (achado 005 parte B, pontos-em-aberto-
// decisao-produto.md) é a fração do volume médio negociado recente
// (RecentTradedVolume, janela de ChartistPriceHistoryDays dias — mesma
// janela do Chartista, sem introduzir uma constante nova só pra dividir o
// conceito) que uma única ordem de compra pode representar — substitui
// "100% do float" como único teto de tamanho de ordem: 100% do float
// sozinho era um teto gigante, sem relação com o que o mercado de fato
// absorve num dia (a causa raiz de ordens de bot nunca preenchíveis
// travando o preço de fechamento por dias/semanas simulados). Valor
// ilustrativo desta sessão, mesma nota de "sujeito à calibração da tarefa
// 8.1" já dada a outros coeficientes do motor (NoisePriceBandPct,
// ChartistTrendThresholdPct etc.) — a causa raiz de fundo (caixa de bot
// ordens de grandeza maior que qualquer float individual) fica deferida
// pra Fase K (calibração com dados reais B3/CVM), decisão confirmada com o
// autor: este teto já torna qualquer ordem matematicamente impossível de
// exceder o que o mercado suporta, independente do caixa do bot.
const MaxOrderPctOfAverageVolumePct = 0.20

// MinOrderSizeCeiling (achado 005 parte C, pontos-em-aberto-decisao-
// produto.md, tarefa J.6) é o piso mínimo do teto de volume — sem ele,
// vários dias simulados seguidos de volume real zero (RecentTradedVolume
// devolvendo só zeros, diferente de "sem dado ainda") produzem
// avgVolume == 0, então volumeCeiling == 0, e capToFloat/quantityForSide
// (marketmaker.go) zeram toda ordem de compra nova pra sempre: sem
// contraparte de compra o lado de venda também para de casar,
// autoperpetuando o travamento sem nenhum caminho de recuperação sozinho
// (achado do teste de ponta a ponta da Fase J, 2026-09-19/20 — 2 de 5
// ativos negociáveis do catálogo mínimo travaram assim dentro de ~50 dias
// simulados). 1 (a menor quantidade não-zero possível) é o piso mínimo que
// corrige isso sem remover o teto em si — effectiveOrderSizeCeiling ainda
// escolhe o menor entre o float e o teto de volume, só nunca deixa o teto
// de volume colapsar a zero quando o float disponível é positivo.
const MinOrderSizeCeiling = 1

// MinOrderPctOfFloat (achado 009, calibracao-liquidez-bots.md) é o piso do
// teto de volume proporcional ao float do ativo, em fração (0.004 = 0,4%).
// O piso absoluto de 1 unidade (MinOrderSizeCeiling) evitava o zero, mas não
// o colapso: o teto é MaxOrderPctOfAverageVolumePct do volume recente, e o
// volume de hoje é feito de ordens limitadas por esse teto, então cada
// janela de ChartistPriceHistoryDays negociava uma fração da anterior até
// sobrar ~1 unidade por dia (VALR3: 23,8M/dia no dia 1, 10/dia no dia 40).
// Com o piso proporcional ao float o mercado converge pra um regime estável
// em vez de morrer. Valor calibrado por simulação de 60 dias mirando ~0,3-0,7%
// do float por dia (giro da B3 ~135% ao ano sobre valor de mercado, ~0,54% ao
// dia) — ilustrativo, uniforme entre ativos: liquidez por ativo (opção C do
// doc) ficou deliberadamente de fora, decisão do autor de não fixar um valor
// por ativo já que liquidez real depende de vários fatores.
const MinOrderPctOfFloat = 0.004

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
	// MacroEffectPct (tarefa E.2) é o efeito de preço macro combinado
	// (macroPriceEffectsByCompany, tick.go) que atinge esta empresa hoje —
	// 0 quando nenhum evento macro ativo afeta a empresa. Repassado ao
	// arquétipo Fundamentalista via decisionInputFor/bot.DecisionInput.
	// MacroEffectPct — o único consumidor: Chartista/Ruído nunca leem o
	// evento diretamente (proposta 2.3.2/3).
	MacroEffectPct float64
	// PnDividendPremiumPct (tarefa J.3) é CompanyForFundamentals.
	// PnDividendPremiumPct (J.2) repassado sem alteração — o Fundamentalista
	// usa esse mesmo valor pra deslocar sua estimativa de preço justo quando
	// o ativo sendo avaliado é PN (equityRoundState.ShareClass, ver
	// decisionInputFor), 0 pra ON. Compartilhado pelas duas classes da mesma
	// empresa igual a Financials/GrowthRate acima — é a empresa que declara
	// o percentual, não o ativo.
	PnDividendPremiumPct float64
}

// BotForRound é o roster de um bot elegível pra uma rodada de negociação
// (account.EligibleForTradingRound: is_bot && is_active) com sua
// personalidade persistida (C.6) — insumo de BotRoster.ListEligibleForTradingRound.
type BotForRound struct {
	UserID      string
	Personality bot.Personality
	// CoveredAssetIDs (tarefa P.3) são os ativos que um Market Maker cobre
	// (market_maker_coverage, P.1), em ordem por ID. Vazio pros outros 3
	// arquétipos, que negociam um ativo sorteado por rodada
	// (bot.SelectAssetForRound).
	CoveredAssetIDs []string
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

// TradedVolumeReader lê o volume total negociado nos últimos dias
// (asset_quotes.total_quantity, achado 005 parte B) de um ativo, em ordem
// cronológica — insumo do teto de tamanho de ordem por volume médio
// recente (effectiveOrderSizeCeiling), mesmo contrato de
// PriceHistoryReader.RecentClosingPrices (devolve menos que `days` sem erro
// quando não há histórico suficiente). Implementado por *db.TickRepository.
type TradedVolumeReader interface {
	RecentTradedVolume(ctx context.Context, assetID string, days int) ([]int, error)
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
// vale pra ordem de bot sem nenhum caso especial. SubmitWithContext é o
// mesmo Submit pulando o LoadContext interno — runIntradayRounds usa pra
// primeira ordem de cada bot/rodada, reaproveitando o OrderContextLoader.
// LoadContext que já leu pra montar a decisão (ver doc de
// orderexecution.Service.SubmitWithContext).
type OrderSubmitter interface {
	Submit(ctx context.Context, req orderexecution.Request) (orderexecution.Outcome, error)
	SubmitWithContext(ctx context.Context, req orderexecution.Request, execCtx orderexecution.Context) (orderexecution.Outcome, error)
}

// OrderLifecycleManager agrupa as duas operações de ciclo de vida de ordem
// do achado 005 parte A (pontos-em-aberto-decisao-produto.md) que tocam
// order_book fora do caminho normal de matching (orderexecution.Execute):
// expirar ordens obsoletas entre dias simulados e cancelar a cotação
// anterior de um Market Maker antes de recotar dentro do mesmo dia.
// Implementado por *db.OrderExecutionRepository (mesma tabela order_book
// que OrderContextLoader/OrderSubmitter já tocam).
type OrderLifecycleManager interface {
	// ExpireStaleOrders cancela toda ordem pending/partially_filled de um
	// dia simulado anterior a currentSimulatedDay — chamado por
	// Service.Run (service.go) antes de runIntradayRounds do dia novo, não
	// por runIntradayRounds em si. Devolve quantas ordens expiraram, só
	// pra observabilidade (Result.ExpiredOrdersCount).
	ExpireStaleOrders(ctx context.Context, currentSimulatedDay int) (int, error)
	// CancelUserRestingOrders cancela toda ordem pending/partially_filled
	// de userID em assetID — chamado por runIntradayRounds logo antes de
	// um bot ArchetypeMarketMaker recotar, pra nunca acumular mais de 1
	// ordem de compra + 1 de venda pendente por ativo (achado 005 A.4).
	CancelUserRestingOrders(ctx context.Context, userID, assetID string) error
}

// businessRejection reporta se err é uma rejeição de negócio normal de
// orderexecution.Service.Submit (saldo/posição/float insuficiente pra ESTA
// ordem, no estado do book já refletindo os fills de bots anteriores nesta
// mesma rodada) — nunca uma falha de infraestrutura. Submit devolve esses
// três erros pelo mesmo canal usado por uma falha real de IO (achado de
// review: runIntradayRounds tratava qualquer erro de Submit como abortante,
// contradizendo o próprio contrato documentado acima de "erro de decisão só
// pula o bot"), então precisa deste distinguishing explícito via errors.Is.
func businessRejection(err error) bool {
	return errors.Is(err, orderexecution.ErrInsufficientBalance) ||
		errors.Is(err, orderexecution.ErrInsufficientPosition) ||
		errors.Is(err, orderexecution.ErrFloatExceeded) ||
		// ErrRestingOrderNoLongerAvailable (achado ao vivo, sessão da tarefa
		// O.1): um bot pode tentar casar contra a ordem pendurada de um
		// usuário no meio da janela em que POST /orders/:id/cancel (tarefa
		// O.1) está cancelando essa mesma ordem — mesma rejeição de negócio
		// normal das três acima, não uma falha de infraestrutura.
		errors.Is(err, orderexecution.ErrRestingOrderNoLongerAvailable)
}

// equityRoundState é o estado mutável (em memória, só durante esta chamada
// de runIntradayRounds) de um ativo de Ação ou FII (tarefa G.1) ao longo do
// dia — Price começa no último fechamento conhecido (ou DefaultInitialPrice,
// sem nenhum ainda) e é atualizado a cada fill real, refletindo o preço da
// negociação mais recente pra qualquer bot que decida depois dentro do mesmo
// dia (mesma e qualquer rodada seguinte) — é isso que dá a "path-dependence"
// intradiária que asset_quotes (só 1 linha por dia) não consegue expressar
// sozinho. Sector/RiskClass ficam zero value ("") pra FII (spec 3.6: sem
// setor nem risk_class própria) — CompanyID nil é o mesmo sinal que já fazia
// fundamentalistHasCompanyContext descartar o Fundamentalista pra qualquer
// ativo sem empresa emissora, agora também o caso natural de FII.
type equityRoundState struct {
	Sector    catalog.Sector
	RiskClass equity.RiskClass
	CompanyID *string
	Price     float64
	// ShareClass (tarefa J.3) espelha AssetForPricing.ShareClass — nil (FII,
	// ou Ação sem classe reconhecida) conta como ON, mesma convenção de
	// equityShareClassesByCompany (tick.go). Consumido só por decisionInputFor
	// (case ArchetypeFundamentalista) pra decidir se o premium de dividendo
	// da PN entra na estimativa de preço justo deste ativo.
	ShareClass *string
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

// buildEquityUniverse filtra assets pras Ações e FIIs (Fase D.2 / tarefa
// G.1 — ETF ainda fora, ver assetTypeAcao/assetTypeFII) e monta tanto o
// estado mutável por ativo (equities, indexado por AssetID) quanto o
// universo pequeno que bot.SelectAssetForRound precisa (sem preço/CompanyID,
// só o que importa pra checar escopo). Sector/RiskClass só são resolvidos
// pra Ação — FII (tarefa G.1) fica com os dois em zero value de propósito
// (remove o tratamento "Conservador" que riskClassForPricing dava a ele
// enquanto passava por GBM): o único jeito de um bot alcançar FII agora é
// via AssetClasses (bot.EquityForRound.Type, bot.MatchesEquity), nunca por
// setor/risk_class que ele não tem.
func buildEquityUniverse(assets []AssetForPricing) (map[string]*equityRoundState, []bot.EquityForRound) {
	equities := make(map[string]*equityRoundState)
	universe := make([]bot.EquityForRound, 0, len(assets))
	for _, a := range assets {
		if a.Type != assetTypeAcao && a.Type != assetTypeFII {
			continue
		}

		var sector catalog.Sector
		var riskClass equity.RiskClass
		if a.Type == assetTypeAcao {
			if a.Sector != nil {
				sector = catalog.Sector(*a.Sector)
			}
			riskClass = riskClassForPricing(a.RiskClass)
		}

		price := DefaultInitialPrice
		if a.LastPrice != nil {
			price = *a.LastPrice
		}

		equities[a.AssetID] = &equityRoundState{Sector: sector, RiskClass: riskClass, CompanyID: a.CompanyID, Price: price, ShareClass: a.ShareClass}
		universe = append(universe, bot.EquityForRound{AssetID: a.AssetID, Sector: sector, RiskClass: riskClass, Type: catalog.AssetType(a.Type)})
	}
	return equities, universe
}

// fundamentalistHasCompanyContext reporta se um bot Fundamentalista tem o
// que precisa pra participar da rodada (state.CompanyID e uma entrada
// correspondente em companyContext) — checagem em memória, sem custo de IO,
// que decisionInputFor também faz (ver seu case ArchetypeFundamentalista)
// mas só depois de já ter pago o round trip de LoadContext. Chamar isto
// antes de LoadContext evita esse round trip pra bots que vão ser
// descartados de qualquer forma; devolve true pra qualquer outro arquétipo
// (sem precondição própria que não dependa de execCtx).
func fundamentalistHasCompanyContext(personality bot.Personality, state *equityRoundState, companyContext map[string]CompanyRoundContext) bool {
	if personality.Archetype != bot.ArchetypeFundamentalista {
		return true
	}
	if state.CompanyID == nil {
		return false
	}
	_, ok := companyContext[*state.CompanyID]
	return ok
}

// effectiveOrderSizeCeiling combina o float finito do ativo (floatCeiling,
// execCtx.OutstandingShares) com o teto de volume médio negociado recente
// (MaxOrderPctOfAverageVolumePct × média de recentVolume, achado 005 parte
// B) — devolve o menor dos dois quando ambos existem. Sem histórico de
// volume ainda (recentVolume vazio — ativo novo, RecentTradedVolume nunca
// achou nenhuma linha) cai pro float sozinho, nunca bloqueia a negociação
// por falta de dado, só fica mais permissivo até o histórico se formar;
// float nil (ex: sandbox) com histórico de volume disponível usa o teto de
// volume sozinho; os dois nil/vazios devolve nil (nenhum teto se aplica).
// Histórico real todo zerado (achado 005 parte C, MinOrderSizeCeiling) nunca
// produz um teto de volume menor que o piso mínimo — sem esse piso,
// volumeCeiling zerava pra sempre e nenhuma ordem de compra nova conseguia
// tamanho >= 1 (capToFloat/quantityForSide, marketmaker.go), travando a
// liquidez do ativo indefinidamente.
func effectiveOrderSizeCeiling(floatCeiling *int64, recentVolume []int) *int64 {
	if len(recentVolume) == 0 {
		return floatCeiling
	}

	var sum int
	for _, v := range recentVolume {
		sum += v
	}
	avgVolume := float64(sum) / float64(len(recentVolume))
	volumeCeiling := int64(avgVolume * MaxOrderPctOfAverageVolumePct)
	if floor := minOrderSizeCeiling(floatCeiling); volumeCeiling < floor {
		volumeCeiling = floor
	}

	if floatCeiling == nil || volumeCeiling < *floatCeiling {
		return &volumeCeiling
	}
	return floatCeiling
}

// minOrderSizeCeiling é o piso do teto de volume: MinOrderPctOfFloat do float
// (achado 009), nunca abaixo de MinOrderSizeCeiling. Sem float conhecido (nil,
// ex: sandbox) só o piso absoluto se aplica.
func minOrderSizeCeiling(floatCeiling *int64) int64 {
	if floatCeiling == nil {
		return MinOrderSizeCeiling
	}
	if floor := int64(float64(*floatCeiling) * MinOrderPctOfFloat); floor > MinOrderSizeCeiling {
		return floor
	}
	return MinOrderSizeCeiling
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
	volumeCache map[string][]int,
	assetID string,
) (bot.DecisionInput, bool, error) {
	recentVolume, cached := volumeCache[assetID]
	if !cached {
		var err error
		recentVolume, err = s.tradedVolume.RecentTradedVolume(ctx, assetID, ChartistPriceHistoryDays)
		if err != nil {
			return bot.DecisionInput{}, false, err
		}
		volumeCache[assetID] = recentVolume
	}

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
		// OrderSizeCeiling (achado 005 partes A/B, pontos-em-aberto-
		// decisao-produto.md) combina o float finito do ativo
		// (execCtx.OutstandingShares, que o case ArchetypeFundamentalista
		// abaixo também exige pra VPA) com o volume médio negociado recente
		// — repassado pros 4 arquétipos (bot.capToFloat), não só o
		// Fundamentalista: sem nenhum teto, o caixa acumulado de um bot
		// podia gerar uma ordem de compra maior que 100% do float, nunca
		// preenchível; só com o float como teto, uma ordem ainda podia ser
		// gigante demais pro que o mercado de fato absorve num dia — os
		// dois travavam o preço de fechamento no mesmo valor por dias/
		// semanas simulados.
		OrderSizeCeiling: effectiveOrderSizeCeiling(execCtx.OutstandingShares, recentVolume),
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
		input.MacroEffectPct = cc.MacroEffectPct
		input.OutstandingShares = *execCtx.OutstandingShares
		// PnDividendPremiumPct (tarefa J.3) só se aplica a um ativo PN —
		// state.ShareClass nil ou qualquer valor != "PN" conta como ON
		// (mesma convenção de equityShareClassesByCompany, tick.go), então
		// fica em 0 (fórmula original de FundamentalistFairPrice).
		if state.ShareClass != nil && *state.ShareClass == "PN" {
			input.PnDividendPremiumPct = cc.PnDividendPremiumPct
		}
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
// o tick inteiro (mesmo contrato documentado em cada Decide*, C.2-C.5).
// Rejeição de negócio do Submit (businessRejection — saldo/posição/float
// insuficiente pra ESTA ordem, mesmo canal de erro de orderexecution.Execute)
// tem o mesmo tratamento: um bot perdeu a corrida por liquidez/float pra
// outro bot que já negociou nesta mesma rodada, só essa ordem é descartada.
// Qualquer outro erro (LoadContext/Submit por falha de IO/
// RecentClosingPrices/ListEligibleForTradingRound) propaga e aborta — mesmo
// padrão de qualquer outra leitura de Run.
//
// Devolve o preço de fechamento (última negociação real de todo o dia,
// nenhuma se nada negociou) e o total negociado (achado 005 parte B) de
// cada Ação/FII negociável — vazios se não há nenhum dos dois no catálogo
// ainda (Fase H, quando ETF entrar aqui, vai alimentar o mesmo mecanismo) —
// quantos fills reais aconteceram no total e quantos ativos negociáveis
// estão sem Market Maker ativo cobrindo (P.3, proposta seção 3.9), só pra
// observabilidade (ver tickResponse, httpserver/admin.go).
//
// Tarefa P.3: o Market Maker não sorteia mais um ativo por rodada. Em cada
// rodada ele cota TODOS os ativos que cobre (BotForRound.CoveredAssetIDs), em
// ordem por ID; um ativo coberto que não está no universo negociável é
// ignorado sem erro. Os outros 3 arquétipos seguem com um ativo sorteado.
func (s *Service) runIntradayRounds(
	ctx context.Context,
	dayIndex int,
	rounds []IntradayRound,
	assets []AssetForPricing,
	companyContext map[string]CompanyRoundContext,
	selicRate, selicNeutral float64,
) (map[string]float64, map[string]int, int, int, error) {
	equities, universe := buildEquityUniverse(assets)
	if len(universe) == 0 || len(rounds) == 0 {
		return nil, nil, 0, 0, nil
	}

	roster, err := s.bots.ListEligibleForTradingRound(ctx)
	if err != nil {
		return nil, nil, 0, 0, err
	}
	sort.Slice(roster, func(i, j int) bool { return roster[i].UserID < roster[j].UserID })

	run := &roundRun{
		dayIndex:          dayIndex,
		equities:          equities,
		companyContext:    companyContext,
		selicRate:         selicRate,
		selicNeutral:      selicNeutral,
		priceHistoryCache: make(map[string][]float64),
		volumeCache:       make(map[string][]int),
		volumeByAssetID:   make(map[string]int),
	}
	uncovered := countUncoveredAssets(roster, equities)

	for _, round := range rounds {
		for _, b := range roster {
			for _, assetID := range s.assetsForBot(b, universe, equities, dayIndex, round) {
				if err := s.runBotOnAsset(ctx, run, round, b, assetID); err != nil {
					return nil, nil, run.fillsExecuted, uncovered, err
				}
			}
		}
	}

	closingPrices := make(map[string]float64, len(equities))
	for assetID, state := range equities {
		closingPrices[assetID] = state.Price
	}
	return closingPrices, run.volumeByAssetID, run.fillsExecuted, uncovered, nil
}

// roundRun agrupa o estado mutável que as rodadas de um tick compartilham
// entre bots e ativos: preço de referência por ativo (dentro de equities),
// caches de leitura e os contadores devolvidos por runIntradayRounds.
type roundRun struct {
	dayIndex          int
	equities          map[string]*equityRoundState
	companyContext    map[string]CompanyRoundContext
	selicRate         float64
	selicNeutral      float64
	priceHistoryCache map[string][]float64
	volumeCache       map[string][]int
	volumeByAssetID   map[string]int
	fillsExecuted     int
}

// assetsForBot devolve os ativos em que o bot atua nesta rodada: o Market
// Maker cota toda a sua cobertura que existe no universo negociável (ordem
// por ID, P.3); os demais arquétipos, o ativo sorteado por
// bot.SelectAssetForRound (nenhum se o sorteio falha).
func (s *Service) assetsForBot(b BotForRound, universe []bot.EquityForRound, equities map[string]*equityRoundState, dayIndex int, round IntradayRound) []string {
	if b.Personality.Archetype == bot.ArchetypeMarketMaker {
		covered := make([]string, 0, len(b.CoveredAssetIDs))
		for _, assetID := range b.CoveredAssetIDs {
			if _, tradable := equities[assetID]; tradable {
				covered = append(covered, assetID)
			}
		}
		sort.Strings(covered)
		return covered
	}

	assetRng := rand.New(rand.NewSource(roundSeed(s.seed, dayIndex, round.SequenceIndex, b.UserID, "asset")))
	chosen, err := bot.SelectAssetForRound(b.Personality.Scope, universe, assetRng)
	if err != nil {
		return nil
	}
	return []string{chosen.AssetID}
}

// countUncoveredAssets conta os ativos negociáveis que nenhum Market Maker
// elegível (ativo) cobre (proposta seção 3.9): sem cobertura o ativo fica sem
// formador de mercado, o que o motor só reporta. Reatribuir é do painel de
// bots (Fase N).
func countUncoveredAssets(roster []BotForRound, equities map[string]*equityRoundState) int {
	covered := make(map[string]bool)
	for _, b := range roster {
		if b.Personality.Archetype != bot.ArchetypeMarketMaker {
			continue
		}
		for _, assetID := range b.CoveredAssetIDs {
			covered[assetID] = true
		}
	}
	uncovered := 0
	for assetID := range equities {
		if !covered[assetID] {
			uncovered++
		}
	}
	return uncovered
}

// runBotOnAsset é a participação de um bot em um ativo numa rodada: decide e
// submete as ordens, atualizando o preço de referência do ativo a cada fill.
// Erro de decisão ou rejeição de negócio só pulam o bot neste ativo (ver doc
// de runIntradayRounds); qualquer outro erro propaga.
func (s *Service) runBotOnAsset(ctx context.Context, run *roundRun, round IntradayRound, b BotForRound, assetID string) error {
	state := run.equities[assetID]

	if !fundamentalistHasCompanyContext(b.Personality, state, run.companyContext) {
		return nil
	}

	// Achado 005 parte A.4: um Market Maker nunca deixa a própria cotação da
	// rodada anterior pendurada — cancela antes de recotar o mesmo (bot,
	// ativo), incondicionalmente (mesmo que bot.Decide abaixo não gere
	// nenhuma ordem nova nesta rodada, ex: sem caixa nem posição). Os outros
	// 3 arquétipos colocam uma ordem oportunista por sinal, não uma cotação
	// contínua — não cancelar a deles entre rodadas é comportamento correto,
	// não um gap.
	if b.Personality.Archetype == bot.ArchetypeMarketMaker {
		if err := s.orderLifecycle.CancelUserRestingOrders(ctx, b.UserID, assetID); err != nil {
			return err
		}
	}

	execCtx, err := s.orderContext.LoadContext(ctx, assetID, b.UserID)
	if err != nil {
		return err
	}

	decisionSeed := roundSeed(s.seed, run.dayIndex, round.SequenceIndex, b.UserID, "decision")
	input, ok, err := s.decisionInputFor(ctx, b.Personality, state, execCtx, run.companyContext, run.selicRate, run.selicNeutral, decisionSeed, run.priceHistoryCache, run.volumeCache, assetID)
	if err != nil {
		return err
	}
	if !ok {
		return nil
	}

	decisions, err := bot.Decide(b.Personality, input)
	if err != nil {
		return nil
	}

	for i, d := range decisions {
		req := orderexecution.Request{
			UserID:   b.UserID,
			AssetID:  assetID,
			Side:     d.Side,
			Type:     d.Type,
			Price:    d.Price,
			Quantity: d.Quantity,
		}

		var outcome orderexecution.Outcome
		var err error
		if i == 0 {
			// execCtx já foi lido acima (decisionInputFor) e nada mudou desde
			// então (bots são processados sequencialmente, doc de
			// runIntradayRounds) — reaproveita em vez de recarregar o mesmo
			// contexto.
			outcome, err = s.orderSubmitter.SubmitWithContext(ctx, req, execCtx)
		} else {
			// Da segunda ordem em diante (só ArchetypeMarketMaker decide mais
			// de uma por rodada), o fill da anterior pode ter mudado
			// saldo/posição — precisa recarregar.
			outcome, err = s.orderSubmitter.Submit(ctx, req)
		}
		if err != nil {
			if businessRejection(err) {
				continue
			}
			return err
		}
		run.fillsExecuted += len(outcome.Fills)
		run.volumeByAssetID[assetID] += outcome.FilledQuantity
		if len(outcome.Fills) > 0 {
			state.Price = outcome.Fills[len(outcome.Fills)-1].Price
		}
	}
	return nil
}
