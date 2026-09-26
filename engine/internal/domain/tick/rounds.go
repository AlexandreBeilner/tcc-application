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
	"fmt"
	"math"
	"math/rand"
	"sort"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderbook"
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
	// (bot.AllocateTurns).
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
	// WithReadScope (tarefa Q.1) devolve um contexto cujas leituras que não mudam
	// durante o tick (dados estáticos do ativo e o dia simulado) ficam em cache
	// até ele ser descartado. runIntradayRounds abre um por tick: são centenas
	// de LoadContext nas rodadas, e sem isso cada um relia as mesmas coisas.
	WithReadScope(ctx context.Context) context.Context
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

// OrderLifecycleManager agrupa as operações de ciclo de vida de ordem que
// tocam order_book fora do caminho normal de matching
// (orderexecution.Execute): expirar ordens obsoletas entre dias simulados
// (achado 005 parte A.3) e manter a cotação do Market Maker (achado 005 A.4,
// refeito na tarefa P.4). Implementado por *db.OrderExecutionRepository
// (mesma tabela order_book que OrderContextLoader/OrderSubmitter já tocam).
type OrderLifecycleManager interface {
	// ExpireStaleOrders cancela toda ordem pending/partially_filled de um
	// dia simulado anterior a currentSimulatedDay — chamado por
	// Service.Run (service.go) antes de runIntradayRounds do dia novo, não
	// por runIntradayRounds em si. Devolve quantas ordens expiraram, só
	// pra observabilidade (Result.ExpiredOrdersCount).
	ExpireStaleOrders(ctx context.Context, currentSimulatedDay int) (int, error)
	// ListRestingOrders devolve, numa consulta só, as ordens
	// pending/partially_filled de userID em cada um de assetIDs, indexadas por
	// ativo (P.4: leitura em lote por Market Maker, não uma por ativo).
	ListRestingOrders(ctx context.Context, userID string, assetIDs []string) (map[string][]bot.RestingQuote, error)
	// CancelRestingOrders cancela as ordens orderIDs com o motivo "requoted"
	// (P.4): só o lado da cotação que o Market Maker vai substituir, não
	// mais toda a cotação do ativo.
	CancelRestingOrders(ctx context.Context, orderIDs []string) error
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
	// OutstandingShares é o float do ativo (nil se desconhecido), usado para o
	// mínimo de quantidade restante de uma cotação de Market Maker (P.4)
	// sem precisar de uma leitura por ativo.
	OutstandingShares *int64
}

// roundSeed deriva uma seed determinística e independente por (dia, rodada,
// bot, propósito) — mesma técnica de isolamento de processo por entidade já
// usada em deterministicSeed (tick.go)/bot.InitialAllocation, aqui composta
// com dois inteiros a mais (dayIndex, roundIndex) pra nenhum bot repetir a
// mesma sequência aleatória em dois (dia, rodada) diferentes. purpose separa
// o sorteio de "qual ativo negociar" (bot.AllocateTurns) do sorteio
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
// universo pequeno que bot.AllocateTurns e bot.SelectBotForTurn precisam (sem preço/CompanyID,
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
		if a.Type != assetTypeAcao && a.Type != assetTypeFII && a.Type != assetTypeETF {
			continue
		}
		// ETF sem cota emitida (antes da emissão inicial, R.3/R.4) não tem float
		// nem book: fica fora do universo até ter cotas.
		if a.Type == assetTypeETF && (a.OutstandingShares == nil || *a.OutstandingShares <= 0) {
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

		equities[a.AssetID] = &equityRoundState{Sector: sector, RiskClass: riskClass, CompanyID: a.CompanyID, Price: price, ShareClass: a.ShareClass, OutstandingShares: a.OutstandingShares}
		var marketValue float64
		if a.OutstandingShares != nil {
			marketValue = float64(*a.OutstandingShares) * price
		}
		universe = append(universe, bot.EquityForRound{AssetID: a.AssetID, Sector: sector, RiskClass: riskClass, Type: catalog.AssetType(a.Type), MarketValue: marketValue})
	}
	// Ordem estável por ID: a alocação de turnos (Q.8) sorteia percorrendo o
	// universo, e a ordem em que o banco devolve os ativos muda quando as linhas
	// são atualizadas (RNF08, mesma seed, mesmo mercado).
	sort.Slice(universe, func(i, j int) bool { return universe[i].AssetID < universe[j].AssetID })
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
// achou nenhuma linha) o teto é o piso proporcional (floorPct do float, o
// giro-alvo do ativo na Q.9), nunca zero: não bloqueia a negociação por falta
// de dado, mas também não deixa o primeiro dia negociar o float inteiro;
// float nil (ex: sandbox) com histórico de volume disponível usa o teto de
// volume sozinho; os dois nil/vazios devolve nil (nenhum teto se aplica).
// Histórico real todo zerado (achado 005 parte C, MinOrderSizeCeiling) nunca
// produz um teto de volume menor que o piso mínimo — sem esse piso,
// volumeCeiling zerava pra sempre e nenhuma ordem de compra nova conseguia
// tamanho >= 1 (capToFloat/quantityForSide, marketmaker.go), travando a
// liquidez do ativo indefinidamente.
func effectiveOrderSizeCeiling(floatCeiling *int64, recentVolume []int, floorPct float64) *int64 {
	if len(recentVolume) == 0 {
		// Sem histórico (ativo novo, primeiro dia do mercado): o teto é o giro-alvo
		// do ativo (floorPct do float), não o float inteiro. Com o float como teto
		// o primeiro dia negociava até 99% do float numa ordem só e inflava o
		// volume médio que dimensiona o teto dos dias seguintes (achado do teste
		// ponta a ponta da Fase Q).
		if floatCeiling == nil {
			return nil
		}
		if floor := minOrderSizeCeilingPct(floatCeiling, floorPct); floor < *floatCeiling {
			return &floor
		}
		return floatCeiling
	}

	var sum int
	for _, v := range recentVolume {
		sum += v
	}
	avgVolume := float64(sum) / float64(len(recentVolume))
	volumeCeiling := int64(avgVolume * MaxOrderPctOfAverageVolumePct)
	if floor := minOrderSizeCeilingPct(floatCeiling, floorPct); volumeCeiling < floor {
		volumeCeiling = floor
	}

	if floatCeiling == nil || volumeCeiling < *floatCeiling {
		return &volumeCeiling
	}
	return floatCeiling
}

// minOrderSizeCeiling é o piso do teto de volume com o percentual fixo
// MinOrderPctOfFloat (a cotação do Market Maker usa este).
func minOrderSizeCeiling(floatCeiling *int64) int64 {
	return minOrderSizeCeilingPct(floatCeiling, MinOrderPctOfFloat)
}

// minOrderSizeCeilingPct é o piso do teto de volume: pct do float (achado 009 e,
// para os bots direcionais, o percentual do giro-alvo do ativo, Q.9), nunca
// abaixo de MinOrderSizeCeiling. Sem float conhecido (nil, ex: sandbox) só o
// piso absoluto se aplica.
func minOrderSizeCeilingPct(floatCeiling *int64, pct float64) int64 {
	if floatCeiling == nil {
		return MinOrderSizeCeiling
	}
	if floor := int64(float64(*floatCeiling) * pct); floor > MinOrderSizeCeiling {
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
	orderCeilingPct float64,
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
		OrderSizeCeiling: effectiveOrderSizeCeiling(execCtx.OutstandingShares, recentVolume, orderCeilingPct),
		// Piso de tamanho da cotação do Market Maker (P.6): uma cotação
		// menor não conta como cobertura. Só o Market Maker lê.
		MinQuoteQuantity: int(minOrderSizeCeiling(execCtx.OutstandingShares)),
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
	ctx = s.orderContext.WithReadScope(ctx)

	// Liquidez dos ETFs (R.4): antes de ler o roster, pra Market Maker recém
	// atribuído e a cobertura nova já entrarem nas rodadas de hoje.
	if err := s.coverETFs(ctx, equities); err != nil {
		return nil, nil, 0, 0, err
	}

	etfFunds, err := s.loadETFFunds(ctx)
	if err != nil {
		return nil, nil, 0, 0, err
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
		etfFunds:          etfFunds,
	}
	uncovered := countUncoveredAssets(roster, equities)

	directional := directionalBots(roster)
	candidates := make([]bot.TurnCandidate, len(directional))
	for i, b := range directional {
		candidates[i] = bot.TurnCandidate{Scope: b.Personality.Scope, Archetype: b.Personality.Archetype}
	}
	applyEventAttention(universe, equities, companyContext)
	turnRng := rand.New(rand.NewSource(deterministicSeed(s.seed, "turns") + int64(dayIndex)))
	dayTurns := bot.AllocateTurns(universe, bot.TurnBudget(len(universe)), turnRng)
	run.orderCeilingPct = orderCeilingPcts(universe, dayTurns)
	turnsByRound := splitTurns(dayTurns, len(rounds))
	universeByID := make(map[string]bot.EquityForRound, len(universe))
	for _, e := range universe {
		universeByID[e.AssetID] = e
	}

	for i, round := range rounds {
		// O Market Maker cota primeiro em toda rodada, para os bots direcionais
		// encontrarem a cotação dele (ver a passada final abaixo).
		for _, b := range roster {
			if b.Personality.Archetype != bot.ArchetypeMarketMaker {
				continue
			}
			if _, err := s.maintainMarketMakerQuotes(ctx, run, b); err != nil {
				return nil, nil, run.fillsExecuted, uncovered, err
			}
		}
		for k, turn := range turnsByRound[i] {
			if err := s.runTurn(ctx, run, round, k, turn, universeByID, directional, candidates); err != nil {
				return nil, nil, run.fillsExecuted, uncovered, err
			}
		}
	}

	// Passada final (P.4), ver finalQuotePass.
	if err := s.finalQuotePass(ctx, run, roster); err != nil {
		return nil, nil, run.fillsExecuted, uncovered, err
	}

	// Arbitragem do Participante Autorizado (R.6): depois da passada final, pra
	// vender as cotas criadas (ou comprar as do resgate) contra uma cotação de
	// Market Maker que existe; se ela negociou, uma segunda passada recota o que
	// a arbitragem consumiu, e o mercado ainda fecha com os dois lados cotados.
	fillsBefore := run.fillsExecuted
	// Rebalanceamento dos fundos (R.7) antes da arbitragem: a arbitragem usa a
	// composição do fundo já rebalanceada.
	if rebalanced, err := s.rebalanceETFs(ctx, run); err != nil {
		return nil, nil, run.fillsExecuted, uncovered, err
	} else if rebalanced {
		if run.etfFunds, err = s.loadETFFunds(ctx); err != nil {
			return nil, nil, run.fillsExecuted, uncovered, err
		}
	}
	if err := s.arbitrageETFs(ctx, run); err != nil {
		return nil, nil, run.fillsExecuted, uncovered, err
	}
	if run.fillsExecuted != fillsBefore {
		if err := s.finalQuotePass(ctx, run, roster); err != nil {
			return nil, nil, run.fillsExecuted, uncovered, err
		}
	}

	// Emissão inicial de ETF (R.3): depois das rodadas, com o mercado cotado.
	if err := s.issueETFs(ctx, run); err != nil {
		return nil, nil, run.fillsExecuted, uncovered, err
	}

	closingPrices := make(map[string]float64, len(equities))
	for assetID, state := range equities {
		closingPrices[assetID] = state.Price
	}
	return closingPrices, run.volumeByAssetID, run.fillsExecuted, uncovered, nil
}

// finalQuotePass é a passada final de cotação (P.4): o Market Maker é o primeiro do roster em cada
// rodada, então os bots direcionais podem consumir a cotação dele depois
// da última recotação do dia. Sem esta passada, o mercado fecharia sem
// contraparte no lado consumido (caso do achado 013). Com a manutenção de
// cotação, ela só custa escrita onde algo foi consumido. Repete até nada
// mudar (no máximo finalPassMaxIterations vezes): uma recotação pode casar de
// cara com uma ordem de bot que ficou do outro lado do preço e ser consumida
// inteira, deixando o ativo sem aquele lado (achado da Q.9).
func (s *Service) finalQuotePass(ctx context.Context, run *roundRun, roster []BotForRound) error {
	for i := 0; i < finalPassMaxIterations; i++ {
		changed := false
		for _, b := range roster {
			if b.Personality.Archetype != bot.ArchetypeMarketMaker {
				continue
			}
			requoted, err := s.maintainMarketMakerQuotes(ctx, run, b)
			if err != nil {
				return err
			}
			changed = changed || requoted
		}
		if !changed {
			break
		}
	}
	return nil
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
	// orderCeilingPct (Q.9) é, por ativo, o piso do teto de tamanho de ordem dos
	// bots direcionais (fração do float): dimensiona a ordem para o giro-alvo do
	// ativo dado quantos turnos ele recebe hoje.
	orderCeilingPct map[string]float64
	// etfFunds (R.5) é o estado dos fundos de ETF lido uma vez no início do
	// tick, por ETF: dele sai o iNAV em memória (inav), a cada recotação, a
	// partir dos preços correntes dos constituintes.
	etfFunds map[string]etf.FundSnapshot
}

// inav devolve o valor patrimonial intradiário de um ETF (R.5): posições do
// fundo lidas no início do tick, preços correntes dos constituintes (os fills
// já feitos nas rodadas). nil para ativo que não é ETF com fundo carregado ou
// quando falta preço de algum constituinte (o Market Maker cai no último
// preço). Em memória, sem comando de banco.
func (r *roundRun) inav(assetID string) *float64 {
	fund, ok := r.etfFunds[assetID]
	if !ok {
		return nil
	}
	prices := make(map[string]float64, len(fund.Holdings))
	for _, h := range fund.Holdings {
		state, ok := r.equities[h.AssetID]
		if !ok {
			return nil
		}
		prices[h.AssetID] = state.Price
	}
	nav, err := etf.NAVFromSnapshot(fund, prices)
	if err != nil {
		return nil
	}
	return &nav
}

// directionalBots filtra o roster pelos bots que negociam por turno (Ruído,
// Chartista e Fundamentalista), na ordem recebida.
func directionalBots(roster []BotForRound) []BotForRound {
	directional := make([]BotForRound, 0, len(roster))
	for _, b := range roster {
		if b.Personality.Archetype != bot.ArchetypeMarketMaker {
			directional = append(directional, b)
		}
	}
	return directional
}

// orderCeilingPcts (Q.9) calcula, por ativo, o piso do teto de tamanho de ordem
// dos bots direcionais: o suficiente para o ativo render o giro-alvo dado quantos
// turnos recebeu hoje (bot.OrderCeilingPct), nunca abaixo de MinOrderPctOfFloat
// (que evita o colapso do volume, achado 009).
func orderCeilingPcts(universe []bot.EquityForRound, turns []bot.Turn) map[string]float64 {
	perAsset := make(map[string]int, len(universe))
	for _, t := range turns {
		perAsset[t.AssetID]++
	}
	median := bot.MedianMarketValue(universe)
	pcts := make(map[string]float64, len(universe))
	for _, e := range universe {
		target := bot.TargetTurnoverPct(e.MarketValue, median)
		if e.Attention > 1 {
			target *= e.Attention // pico de volume enquanto o evento dura (Q.10)
		}
		pct := bot.OrderCeilingPct(target, perAsset[e.AssetID])
		pcts[e.AssetID] = math.Max(pct, MinOrderPctOfFloat)
	}
	return pcts
}

// directionalCeilingPct devolve o piso do teto de ordem de um ativo para os bots
// direcionais, ou MinOrderPctOfFloat se o ativo não tem giro-alvo calculado.
func (r *roundRun) directionalCeilingPct(assetID string) float64 {
	if pct, ok := r.orderCeilingPct[assetID]; ok {
		return pct
	}
	return MinOrderPctOfFloat
}

// applyEventAttention (Q.10) marca no universo o multiplicador de atenção dos
// ativos cuja empresa sofre hoje o efeito de preço de um evento macro
// (CompanyRoundContext.MacroEffectPct, que só é diferente de zero enquanto o
// evento dura): eles ganham turnos e volume, e os turnos preferem
// Fundamentalistas.
func applyEventAttention(universe []bot.EquityForRound, equities map[string]*equityRoundState, companyContext map[string]CompanyRoundContext) {
	for i := range universe {
		state := equities[universe[i].AssetID]
		if state == nil || state.CompanyID == nil {
			continue
		}
		if cc, ok := companyContext[*state.CompanyID]; ok && cc.MacroEffectPct != 0 {
			universe[i].Attention = bot.AttentionMultiplier(cc.MacroEffectPct)
		}
	}
}

// splitTurns reparte os turnos do dia entre as rodadas em fatias contíguas de
// tamanho quase igual (as primeiras rodadas ficam com o resto). O orçamento é do
// tick, não da rodada: um dia de 4 rodadas não custa mais turnos que um de 1.
func splitTurns(turns []bot.Turn, rounds int) [][]bot.Turn {
	if rounds <= 0 {
		return nil
	}
	out := make([][]bot.Turn, rounds)
	base, extra := len(turns)/rounds, len(turns)%rounds
	start := 0
	for i := range out {
		size := base
		if i < extra {
			size++
		}
		out[i] = turns[start : start+size]
		start += size
	}
	return out
}

// finalPassMaxIterations limita as repetições da passada final de manutenção de
// cotação do Market Maker (ver runIntradayRounds).
const finalPassMaxIterations = 3

// floorTurnAttempts é quantos bots o turno de piso de um ativo tenta até um
// deles conseguir negociar (um bot pode não ter sinal, caixa ou posição).
const floorTurnAttempts = 4

// runTurn executa um turno de bot num ativo (Q.8): escolhe o bot pelo escopo e
// roda a participação dele. O turno de piso do ativo é executado a mercado e
// repete com outro bot até haver um fill, para o ativo imprimir um negócio real
// todo dia.
func (s *Service) runTurn(ctx context.Context, run *roundRun, round IntradayRound, index int, turn bot.Turn, universeByID map[string]bot.EquityForRound, directional []BotForRound, candidates []bot.TurnCandidate) error {
	asset := universeByID[turn.AssetID]
	attempts := 1
	if turn.Floor {
		attempts = floorTurnAttempts
	}
	// Fundamentalista não negocia ativo sem empresa/fundamentos (FII, ou uma empresa
	// ainda sem relatório): sorteá-lo desperdiçaria o turno, e o turno de piso
	// esgotava as tentativas mais vezes em FII (3,8% dos dias sem negócio contra
	// 0,2% nas ações no teste ponta a ponta da Fase Q).
	eligible, indexes := candidates, []int(nil)
	if !assetHasCompanyContext(run.equities[turn.AssetID], run.companyContext) {
		eligible = make([]bot.TurnCandidate, 0, len(candidates))
		indexes = make([]int, 0, len(candidates))
		for i, c := range candidates {
			if c.Archetype != bot.ArchetypeFundamentalista {
				eligible = append(eligible, c)
				indexes = append(indexes, i)
			}
		}
	}
	for attempt := 0; attempt < attempts; attempt++ {
		purpose := fmt.Sprintf("turn:%d:%d", index, attempt)
		botRng := rand.New(rand.NewSource(roundSeed(s.seed, run.dayIndex, round.SequenceIndex, turn.AssetID, purpose)))
		pick := bot.SelectBotForTurn(asset, eligible, turn.Attention, botRng)
		if pick < 0 {
			return nil
		}
		if indexes != nil {
			pick = indexes[pick]
		}
		filled, err := s.runBotOnAsset(ctx, run, round, directional[pick], turn.AssetID, purpose, turn.Floor)
		if err != nil {
			return err
		}
		if filled > 0 {
			return nil
		}
	}
	return nil
}

// assetHasCompanyContext reporta se o ativo tem empresa com fundamentos no dia, o
// que um Fundamentalista precisa para decidir (ver fundamentalistHasCompanyContext).
func assetHasCompanyContext(state *equityRoundState, companyContext map[string]CompanyRoundContext) bool {
	if state == nil || state.CompanyID == nil {
		return false
	}
	_, ok := companyContext[*state.CompanyID]
	return ok
}

// marketMakerCoveredAssets devolve os ativos que o Market Maker cota: toda a
// sua cobertura que existe no universo negociável, em ordem por ID (P.3).
func marketMakerCoveredAssets(b BotForRound, equities map[string]*equityRoundState) []string {
	covered := make([]string, 0, len(b.CoveredAssetIDs))
	for _, assetID := range b.CoveredAssetIDs {
		if _, tradable := equities[assetID]; tradable {
			covered = append(covered, assetID)
		}
	}
	sort.Strings(covered)
	return covered
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

// runBotOnAsset é a participação de um bot em um ativo num turno: decide e
// submete as ordens, atualizando o preço de referência do ativo a cada fill, e
// devolve quantos fills aconteceram. purpose separa o sorteio de decisão dos
// outros turnos do mesmo bot; floor converte as ordens em ordens a mercado (turno
// de piso, Q.8). Erro de decisão ou rejeição de negócio só pulam o bot neste
// ativo (ver doc de runIntradayRounds); qualquer outro erro propaga.
func (s *Service) runBotOnAsset(ctx context.Context, run *roundRun, round IntradayRound, b BotForRound, assetID, purpose string, floor bool) (int, error) {
	state := run.equities[assetID]

	if !fundamentalistHasCompanyContext(b.Personality, state, run.companyContext) {
		return 0, nil
	}

	execCtx, err := s.orderContext.LoadContext(ctx, assetID, b.UserID)
	if err != nil {
		return 0, err
	}

	decisionSeed := roundSeed(s.seed, run.dayIndex, round.SequenceIndex, b.UserID, "decision:"+purpose)
	input, ok, err := s.decisionInputFor(ctx, b.Personality, state, execCtx, run.companyContext, run.selicRate, run.selicNeutral, decisionSeed, run.priceHistoryCache, run.volumeCache, assetID, run.directionalCeilingPct(assetID))
	if err != nil {
		return 0, err
	}
	if !ok {
		return 0, nil
	}

	decisions, err := bot.Decide(b.Personality, input)
	if err != nil {
		return 0, nil
	}
	if floor {
		for i := range decisions {
			decisions[i].Type = orderbook.TypeMarket
			decisions[i].Price = 0
		}
	}

	return s.submitDecisions(ctx, run, b, assetID, state, execCtx, decisions)
}

// submitDecisions envia as ordens decididas de um bot num ativo e atualiza o
// preço de referência a cada fill. Rejeição de negócio só descarta a ordem.
func (s *Service) submitDecisions(ctx context.Context, run *roundRun, b BotForRound, assetID string, state *equityRoundState, execCtx orderexecution.Context, decisions []bot.Decision) (int, error) {
	fills := 0
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
			return fills, err
		}
		fills += len(outcome.Fills)
		run.fillsExecuted += len(outcome.Fills)
		run.volumeByAssetID[assetID] += outcome.FilledQuantity
		if len(outcome.Fills) > 0 {
			state.Price = outcome.Fills[len(outcome.Fills)-1].Price
		}
	}
	return fills, nil
}

// maintainMarketMakerQuotes é a vez de um Market Maker numa rodada (P.3/P.4):
// lê numa consulta só as ordens em repouso de todos os ativos que cobre e
// mantém a cotação de cada um, em ordem por ID.
func (s *Service) maintainMarketMakerQuotes(ctx context.Context, run *roundRun, b BotForRound) (bool, error) {
	assetIDs := marketMakerCoveredAssets(b, run.equities)
	if len(assetIDs) == 0 {
		return false, nil
	}

	resting, err := s.orderLifecycle.ListRestingOrders(ctx, b.UserID, assetIDs)
	if err != nil {
		return false, err
	}
	changed := false
	for _, assetID := range assetIDs {
		requoted, err := s.maintainQuote(ctx, run, b, assetID, resting[assetID])
		if err != nil {
			return changed, err
		}
		changed = changed || requoted
	}
	return changed, nil
}

// maintainQuote mantém a cotação de um Market Maker em um ativo (tarefa P.4,
// proposta-cobertura-market-maker.md seção 3.6). Cotação que ainda vale não
// gera nenhum comando de banco: só o lado consumido, abaixo do mínimo ou fora
// da tolerância do preço ideal é cancelado e recotado. Substitui o "cancelar
// tudo e recotar tudo" do achado 005 A.4, que custava escrita proporcional ao
// tamanho do catálogo em vez da atividade do mercado.
func (s *Service) maintainQuote(ctx context.Context, run *roundRun, b BotForRound, assetID string, resting []bot.RestingQuote) (bool, error) {
	state := run.equities[assetID]

	// ETF cota em torno do iNAV (R.5); Ação e FII, do último preço.
	reference := bot.QuoteReferencePrice(state.Price, run.inav(assetID))
	idealBid, idealAsk, err := bot.MarketMakerQuotePrices(b.Personality, reference)
	if err != nil {
		return false, nil
	}
	tolerance := bot.EffectiveQuoteTolerance(b.Personality.RiskProfile.SpreadWidthPct)
	requoteBuy, requoteSell := bot.NeedsRequote(resting, idealBid, idealAsk, tolerance, int(minOrderSizeCeiling(state.OutstandingShares)))
	if !requoteBuy && !requoteSell {
		return false, nil
	}

	var staleIDs []string
	for _, q := range resting {
		if (q.Side == orderbook.SideBuy && requoteBuy) || (q.Side == orderbook.SideSell && requoteSell) {
			staleIDs = append(staleIDs, q.ID)
		}
	}
	if len(staleIDs) > 0 {
		if err := s.orderLifecycle.CancelRestingOrders(ctx, staleIDs); err != nil {
			return true, err
		}
	}

	execCtx, err := s.orderContext.LoadContext(ctx, assetID, b.UserID)
	if err != nil {
		return true, err
	}
	// O Market Maker é determinístico (sem seed) e não usa insumos além do
	// preço, do caixa, da posição e do teto de ordem.
	// A cotação sai do preço de referência (iNAV, no ETF); o estado real, com o
	// último preço, segue sendo o que os fills atualizam.
	quoteState := *state
	quoteState.Price = reference
	input, ok, err := s.decisionInputFor(ctx, b.Personality, &quoteState, execCtx, run.companyContext, run.selicRate, run.selicNeutral, 0, run.priceHistoryCache, run.volumeCache, assetID, MinOrderPctOfFloat)
	if err != nil {
		return true, err
	}
	if !ok {
		return true, nil
	}
	decisions, err := bot.Decide(b.Personality, input)
	if err != nil {
		return true, nil
	}

	toSubmit := make([]bot.Decision, 0, len(decisions))
	for _, d := range decisions {
		if (d.Side == orderbook.SideBuy && requoteBuy) || (d.Side == orderbook.SideSell && requoteSell) {
			toSubmit = append(toSubmit, d)
		}
	}
	_, err = s.submitDecisions(ctx, run, b, assetID, state, execCtx, toSubmit)
	return true, err
}
