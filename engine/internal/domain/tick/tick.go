// Package tick implementa o "ator Temporizador" da spec (seção 3.2.1) — o
// orquestrador que avança o Mercado Ao Vivo em um dia simulado por vez.
// Decisão de arquitetura confirmada com o usuário em 2026-08-22 (backlog
// 3.11, não estava em nenhum dos três documentos de referência): 1 tick = 1
// dia real, sem multiplicador de velocidade configurável, sempre
// path-dependent — cada tick lê o último estado persistido (dia atual,
// Selic simulada, último preço por ativo) e gera só o próximo passo, nunca
// regenera a série do zero (ver selic.NextCalendarRate/equity.NextPrice).
// O Mercado Ao Vivo é único e global (spec 3.3), por isso State não tem
// escopo por usuário.
package tick

import (
	"context"
	"hash/fnv"

	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/selic"
)

// DefaultInitialPrice é o preço de partida de um ativo de renda variável
// antes do primeiro tick gerar uma cotação — dado ilustrativo sem fórmula
// de geração ainda, mesmo tratamento dado a outros parâmetros "sujeitos à
// calibração da tarefa 8.1" (precedente: interest_rate/maturity_date da
// tarefa 3.9).
const DefaultInitialPrice = 100.00

// State é o estado do calendário simulado do Mercado Ao Vivo — Day é o dia
// simulado atual (0 = nenhum tick rodou ainda; contagem 1-based depois do
// primeiro tick, mesma convenção de selic.IsCopomMeetingDay/
// fundamentals.IsReportDay: o dia 1 nunca é reunião/relatório).
type State struct {
	Day       int
	SelicRate float64
}

// AssetForPricing é o insumo mínimo do catálogo que Advance precisa por
// ativo de renda variável ativo (não-sandbox) pra gerar o próximo preço.
// RiskClass vem cru do catálogo (nil pra ETF/FII, que não têm risk_class
// hoje — só ações) porque a decisão de qual classe usar como calibração de
// GBM é política de precificação, resolvida em Advance, não no repositório.
// LastPrice nil significa "nenhuma cotação anterior" (ativo nunca teve tick
// gerado) — Advance aplica DefaultInitialPrice nesse caso.
type AssetForPricing struct {
	AssetID   string
	RiskClass *string
	LastPrice *float64
}

// Quote é o novo preço gerado pra um ativo num tick, pronto pra persistir
// em asset_quotes.
type Quote struct {
	AssetID string
	Price   float64
}

// Result é o resultado de um tick — o novo estado do calendário e as
// cotações geradas nesse dia, prontos pra persistir atomicamente
// (Repository.SaveTick). IsCopomDay/IsReportDay sinalizam o calendário de
// eventos (spec 3.2.1) pra quem consumir o tick — IsReportDay é consumido
// pela tarefa 3.14 (ciclo de relatórios), ainda não implementada; aqui só
// o sinal existe, a geração de company_fundamentals fica pra lá.
type Result struct {
	State       State
	Quotes      []Quote
	IsCopomDay  bool
	IsReportDay bool
}

// Repository é o colaborador que Advance precisa pra ler o último estado
// persistido e gravar o próximo — implementado por *db.TickRepository,
// injetado em NewService.
type Repository interface {
	// LoadState devolve o estado persistido do calendário simulado, ou
	// found = false se o Temporizador nunca rodou (motor recém-subido).
	LoadState(ctx context.Context) (state State, found bool, err error)
	// ListPricingAssets devolve todo ativo de renda variável ativo
	// (is_sandbox = false, type em acao/etf/fii) com sua última cotação
	// conhecida, se houver.
	ListPricingAssets(ctx context.Context) ([]AssetForPricing, error)
	// SaveTick persiste o novo estado do calendário e as cotações geradas,
	// atomicamente — nem calendário nem cotações são escrita de
	// saldo/posição de usuário, por isso não passa por Event Sourcing
	// (mesma distinção já documentada em catalog.Asset pra dado cadastral).
	SaveTick(ctx context.Context, result Result) error
}

// riskClassForPricing resolve a risk_class usada como calibração do GBM —
// ETF/FII não têm risk_class própria no catálogo hoje (a spec só define a
// tabela de volatilidade/drift por risk_class pra ações, seção 3.2); até um
// modelo de precificação próprio pra ETF/FII existir, tratamos como
// Conservador (mais estável), decisão de escopo desta tarefa (3.11), não
// uma calibração fechada da spec.
func riskClassForPricing(riskClass *string) equity.RiskClass {
	if riskClass == nil {
		return equity.RiskClassConservador
	}
	return equity.RiskClass(*riskClass)
}

// assetSeed deriva uma seed determinística por ativo a partir de assetID
// (UUID) e da seed base da simulação — cada ativo precisa de um processo
// GBM independente dos outros (senão todos os ativos da mesma risk_class
// se moveriam em uníssono), mas ainda determinístico por (baseSeed,
// assetID, dayIndex) — ver equity.NextPrice.
func assetSeed(baseSeed int64, assetID string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(assetID))
	return baseSeed + int64(h.Sum64())
}

// Advance calcula o próximo tick a partir do estado persistido — nunca
// regenera a série do zero (ver doc do pacote). selicCfg parametriza a
// reversão à média da Selic (mesmo Config de selic.Series/CalendarSeries,
// Initial ignorado — quem manda a taxa inicial é current.SelicRate); seed é
// a seed base da simulação (RNF08: fixa entre reinícios, configurada uma
// vez na composição).
func Advance(current State, assets []AssetForPricing, selicCfg selic.Config, seed int64) Result {
	newDay := current.Day + 1
	dayIndex := newDay - 1 // 0-based, mesma convenção de IsCopomMeetingDay/IsReportDay

	newSelicRate := selic.NextCalendarRate(selicCfg, dayIndex, current.SelicRate)

	quotes := make([]Quote, 0, len(assets))
	for _, a := range assets {
		lastPrice := DefaultInitialPrice
		if a.LastPrice != nil {
			lastPrice = *a.LastPrice
		}

		cfg := equity.Config{
			RiskClass: riskClassForPricing(a.RiskClass),
			Seed:      assetSeed(seed, a.AssetID),
		}
		price, ok := equity.NextPrice(cfg, dayIndex, lastPrice, newSelicRate)
		if !ok {
			continue
		}
		quotes = append(quotes, Quote{AssetID: a.AssetID, Price: price})
	}

	return Result{
		State:       State{Day: newDay, SelicRate: newSelicRate},
		Quotes:      quotes,
		IsCopomDay:  selic.IsCopomMeetingDay(dayIndex),
		IsReportDay: fundamentals.IsReportDay(dayIndex, fundamentals.DefaultReportFrequencyDays),
	}
}
