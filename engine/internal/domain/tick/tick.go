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
	"tcc-investimentos/engine/internal/domain/macroevent"
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
	// CompanyID identifica a empresa emissora, pra ações vinculadas a uma
	// company (variable_income_assets.company_id) — nil pra ETF/FII, que
	// não têm empresa individual (spec 3.6). Usado por Advance (tarefa
	// 3.14) pra saber em qual cotação aplicar o efeito de preço do
	// resultado divulgado no dia do relatório da empresa correspondente.
	CompanyID *string
	// Sector é o setor (company_sector, mesma string crua de
	// macro_event_targets.sector/companies.sector — não catalog.Sector
	// tipado, mesma convenção de RiskClass acima) da empresa emissora, nil
	// pra ETF/FII (sem CompanyID) — usado por Advance (tarefa 4.5) pra
	// resolver o fan-out de um evento macro de alvo setorial pros ativos
	// das empresas daquele setor.
	Sector *string
}

// CompanyForFundamentals é o insumo mínimo do catálogo que Advance precisa
// por empresa (companies) pra gerar o próximo ciclo de relatório, no dia de
// relatório dessa empresa (tarefa 3.14). LastRevenue nil significa "nenhum
// company_fundamentals gerado ainda pra essa empresa" — Advance aplica
// fundamentals.DefaultBaseRevenue nesse caso, mesmo tratamento de
// AssetForPricing.LastPrice/tick.DefaultInitialPrice.
type CompanyForFundamentals struct {
	CompanyID           string
	ReportFrequencyDays int
	LastRevenue         *float64
	// Sector é company_sector (mesma string crua de AssetForPricing.Sector,
	// sempre presente — coluna NOT NULL) — usado por Advance (tarefa 4.5)
	// pra resolver o fan-out de um evento macro de alvo setorial pras
	// empresas daquele setor.
	Sector string
}

// MacroEventTargetForApplication espelha uma linha de macro_event_targets
// pro consumo de Advance (tarefa 4.5) — mesma forma de macroevent.Target
// (sector/risk_class/asset_id, exatamente um preenchido), mas Sector fica
// cru (*string, não catalog.Sector) pela mesma razão de AssetForPricing.
// RiskClass já ser cru: tick não precisa importar catalog só pra isso.
type MacroEventTargetForApplication struct {
	Sector    *string
	RiskClass *string
	AssetID   *string
}

// MacroEventForApplication é um evento macro com status = 'pendente' —
// insumo que Advance precisa (tarefa 4.5) pra aplicar continuamente, a
// cada tick, o efeito de preço (enquanto macroevent.IsPriceEffectActive)
// e o efeito de fundamentos (no dia exato de FundamentalsReportDay) sobre
// os alvos do evento, e decidir quando o evento passa a status =
// 'aplicado'. ID é necessário aqui (diferente de macroevent.Event) porque
// SaveTick precisa saber qual linha de macro_events atualizar.
type MacroEventForApplication struct {
	ID                    string
	TriggeredOnDay        int
	DurationDays          int
	AffectsPrice          bool
	AffectsFundamentals   bool
	PriceEffectPct        *float64
	FundamentalsEffectPct *float64
	FundamentalsReportDay *int
	Targets               []MacroEventTargetForApplication
}

// FundamentalsRecord é a nova linha de company_fundamentals gerada no dia
// de relatório de uma empresa, pronta pra persistir (Repository.SaveTick).
// Só NetRevenue é preenchido — derivar net_income/ebit/gross_debt/
// cash_equivalents a partir da receita (margens, alavancagem) segue fora de
// escopo, mesma nota já deixada em fundamentals.RevenueSeries (tarefa 3.5):
// a spec não fecha fórmula nenhuma pra esses indicadores.
type FundamentalsRecord struct {
	CompanyID  string
	NetRevenue float64
}

// Quote é o novo preço gerado pra um ativo num tick, pronto pra persistir
// em asset_quotes.
type Quote struct {
	AssetID string
	Price   float64
}

// Result é o resultado de um tick — o novo estado do calendário, as
// cotações e as novas linhas de company_fundamentals (Fundamentals, tarefa
// 3.14) geradas nesse dia, prontos pra persistir atomicamente
// (Repository.SaveTick). IsCopomDay/IsReportDay sinalizam o calendário de
// eventos (spec 3.2.1) pra quem consumir o tick — IsReportDay é o sinal
// global (fundamentals.DefaultReportFrequencyDays); Fundamentals já reflete
// o dia de relatório por empresa (CompanyForFundamentals.ReportFrequencyDays
// individual, ainda que hoje todas as empresas seedadas usem o mesmo valor).
type Result struct {
	State        State
	Quotes       []Quote
	Fundamentals []FundamentalsRecord
	IsCopomDay   bool
	IsReportDay  bool
	// AppliedMacroEventIDs são os ids de evento macro (macro_events, status
	// 'pendente' até aqui) cujos efeitos habilitados já foram todos
	// consumidos neste tick (tarefa 4.5) — evento só com AffectsPrice
	// aplicado assim que DurationDays termina; evento com
	// AffectsFundamentals aplicado só depois do dia de relatório
	// correspondente. SaveTick marca status = 'aplicado' pra cada um,
	// atomicamente com o resto do tick.
	AppliedMacroEventIDs []string
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
	// ListCompaniesForFundamentals devolve toda empresa cadastrada, com sua
	// última net_revenue conhecida (company_fundamentals), se houver — usado
	// por Advance (tarefa 3.14) pra decidir o dia de relatório de cada
	// empresa e encadear a receita a partir do último ciclo persistido.
	ListCompaniesForFundamentals(ctx context.Context) ([]CompanyForFundamentals, error)
	// ListPendingMacroEvents devolve todo evento macro com status =
	// 'pendente' (macroevent.StatusPendente) — usado por Advance (tarefa
	// 4.5) pra aplicar o efeito de preço/fundamentos a cada tick e decidir
	// quando marcar status = 'aplicado' (Result.AppliedMacroEventIDs).
	ListPendingMacroEvents(ctx context.Context) ([]MacroEventForApplication, error)
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

// deterministicSeed deriva uma seed determinística por entidade (asset_id
// ou company_id, ambos UUID) a partir da seed base da simulação — cada
// ativo/empresa precisa de um processo independente dos outros (senão todos
// se moveriam em uníssono), mas ainda determinístico por (baseSeed, id,
// dayIndex/cycleIndex) — ver equity.NextPrice/fundamentals.NextGrowth.
func deterministicSeed(baseSeed int64, id string) int64 {
	h := fnv.New64a()
	_, _ = h.Write([]byte(id))
	return baseSeed + int64(h.Sum64())
}

// companyReportEffect é o resultado do ciclo de relatório de uma empresa no
// dia de relatório — NetRevenue vira uma FundamentalsRecord (persistida em
// company_fundamentals), PriceEffect é aplicado multiplicativamente sobre a
// cotação de cada ativo vinculado à empresa (spec 3.3: efeito de preço da
// surpresa só no dia da divulgação, tarefa 3.14).
type companyReportEffect struct {
	NetRevenue  float64
	PriceEffect float64
}

// fundamentalsConfig monta o fundamentals.Config de uma empresa pro ciclo
// de relatório — Sensitivity vem da risk_class de um ativo de renda
// variável vinculado à empresa (equityRiskClass), a mesma tabela
// (fundamentals.SensitivityByRiskClass) usada pra calibrar o quanto a
// empresa reage a desvios da Selic (spec 3.2.2). Sensitivity fica 0
// (SensitivityByRiskClass[""] , zero value do map) se a empresa não tiver
// nenhum ativo de renda variável vinculado com risk_class conhecida — não
// deveria acontecer com o catálogo seedado (toda ação tem risk_class), mas
// não trava o ciclo de relatório se acontecer.
func fundamentalsConfig(seed int64, companyID string, equityRiskClass equity.RiskClass) fundamentals.Config {
	return fundamentals.Config{
		BaseGrowth:  fundamentals.DefaultBaseGrowth,
		Sensitivity: fundamentals.SensitivityByRiskClass[equityRiskClass],
		NoiseStdDev: fundamentals.DefaultNoiseStdDev,
		Seed:        deterministicSeed(seed, companyID),
	}
}

// companyEquityRiskClasses mapeia company_id -> risk_class de um dos ativos
// de renda variável vinculados a essa empresa — só ações têm CompanyID
// preenchido (ETF/FII não, spec 3.6), então esse mapa nunca mistura risk
// class de ETF/FII na sensibilidade de uma empresa. Uma empresa com mais de
// um ativo vinculado (ON/PN) usa o risk_class do primeiro encontrado —
// catálogo seedado (tarefa 3.9) não tem esse caso, mas a função não trava
// se acontecer.
func companyEquityRiskClasses(assets []AssetForPricing) map[string]equity.RiskClass {
	riskClasses := make(map[string]equity.RiskClass)
	for _, a := range assets {
		if a.CompanyID == nil {
			continue
		}
		if _, seen := riskClasses[*a.CompanyID]; seen {
			continue
		}
		riskClasses[*a.CompanyID] = riskClassForPricing(a.RiskClass)
	}
	return riskClasses
}

// assetCompanies mapeia asset_id -> company_id (só ativos vinculados a uma
// empresa, spec 3.6) — usado por eventTargetsCompany pra resolver um
// macro_event_targets.asset_id ("empresa específica" como alvo, ver doc do
// pacote macroevent) de volta pra qual empresa ele afeta.
func assetCompanies(assets []AssetForPricing) map[string]string {
	companies := make(map[string]string, len(assets))
	for _, a := range assets {
		if a.CompanyID != nil {
			companies[a.AssetID] = *a.CompanyID
		}
	}
	return companies
}

// eventTargetsAsset confere se algum dos targets de um evento macro
// alcança o ativo a (setor da empresa emissora, risk_class ou o próprio
// asset_id) — tarefa 4.5, fan-out de alvo setorial/risk_class deixado em
// aberto pela escrita do alvo (tarefa 4.4).
func eventTargetsAsset(targets []MacroEventTargetForApplication, a AssetForPricing) bool {
	for _, t := range targets {
		if t.AssetID != nil && *t.AssetID == a.AssetID {
			return true
		}
		if t.RiskClass != nil && a.RiskClass != nil && *t.RiskClass == *a.RiskClass {
			return true
		}
		if t.Sector != nil && a.Sector != nil && *t.Sector == *a.Sector {
			return true
		}
	}
	return false
}

// eventTargetsCompany confere se algum dos targets de um evento macro
// alcança a empresa companyID (setor, risk_class de um de seus ativos de
// renda variável, ou asset_id de um ativo que ela emite, via
// assetToCompany) — mesmo fan-out de eventTargetsAsset, do lado de
// company_fundamentals em vez de asset_quotes.
func eventTargetsCompany(targets []MacroEventTargetForApplication, companyID, sector string, riskClass equity.RiskClass, assetToCompany map[string]string) bool {
	for _, t := range targets {
		if t.Sector != nil && *t.Sector == sector {
			return true
		}
		if t.RiskClass != nil && *t.RiskClass == string(riskClass) {
			return true
		}
		if t.AssetID != nil {
			if cid, ok := assetToCompany[*t.AssetID]; ok && cid == companyID {
				return true
			}
		}
	}
	return false
}

// macroPriceMultiplier combina (multiplicativamente — cada evento
// empilha sobre o GBM e sobre os demais eventos ativos, mesma lógica já
// documentada em macroevent.DailyPriceEffectMultiplier) o efeito de preço
// de todo evento macro pendente cujo efeito de preço está ativo em newDay
// (macroevent.IsPriceEffectActive) e cujo alvo alcança o ativo a.
func macroPriceMultiplier(macroEvents []MacroEventForApplication, a AssetForPricing, newDay int) float64 {
	multiplier := 1.0
	for _, ev := range macroEvents {
		if !ev.AffectsPrice || ev.PriceEffectPct == nil {
			continue
		}
		if !macroevent.IsPriceEffectActive(ev.TriggeredOnDay, ev.DurationDays, newDay) {
			continue
		}
		if !eventTargetsAsset(ev.Targets, a) {
			continue
		}
		multiplier *= macroevent.DailyPriceEffectMultiplier(*ev.PriceEffectPct, ev.DurationDays)
	}
	return multiplier
}

// macroFundamentalsEffectsByCompany soma (macroevent.CombinePendingEffects,
// com o teto ±macroevent.DefaultFundamentalsCapPct) o efeito de
// fundamentos de todo evento macro pendente cujo FundamentalsReportDay é
// exatamente newDay (o dia de relatório ao qual o efeito foi atribuído na
// tarefa 4.4) e cujo alvo alcança a empresa — um valor combinado por
// empresa, só pras empresas afetadas nesse ciclo.
func macroFundamentalsEffectsByCompany(macroEvents []MacroEventForApplication, companies []CompanyForFundamentals, equityRiskClasses map[string]equity.RiskClass, assetToCompany map[string]string, newDay int) map[string]float64 {
	pending := make(map[string][]float64)
	for _, ev := range macroEvents {
		if !ev.AffectsFundamentals || ev.FundamentalsEffectPct == nil || ev.FundamentalsReportDay == nil {
			continue
		}
		if *ev.FundamentalsReportDay != newDay {
			continue
		}
		for _, c := range companies {
			if eventTargetsCompany(ev.Targets, c.CompanyID, c.Sector, equityRiskClasses[c.CompanyID], assetToCompany) {
				pending[c.CompanyID] = append(pending[c.CompanyID], *ev.FundamentalsEffectPct)
			}
		}
	}

	combined := make(map[string]float64, len(pending))
	for companyID, effects := range pending {
		combined[companyID] = macroevent.CombinePendingEffects(effects, macroevent.DefaultFundamentalsCapPct)
	}
	return combined
}

// macroEventDone confere se todo efeito habilitado de um evento macro já
// foi consumido em newDay — evento só com AffectsPrice fica pronto assim
// que a janela de macroevent.IsPriceEffectActive termina (newDay >=
// TriggeredOnDay+DurationDays); evento com AffectsFundamentals só depois
// que o dia de relatório correspondente (FundamentalsReportDay) chegou —
// critério de aceite da tarefa 4.5.
func macroEventDone(ev MacroEventForApplication, newDay int) bool {
	priceDone := !ev.AffectsPrice || newDay >= ev.TriggeredOnDay+ev.DurationDays
	fundamentalsDone := !ev.AffectsFundamentals || (ev.FundamentalsReportDay != nil && newDay >= *ev.FundamentalsReportDay)
	return priceDone && fundamentalsDone
}

// Advance calcula o próximo tick a partir do estado persistido — nunca
// regenera a série do zero (ver doc do pacote). selicCfg parametriza a
// reversão à média da Selic (mesmo Config de selic.Series/CalendarSeries,
// Initial ignorado — quem manda a taxa inicial é current.SelicRate); seed é
// a seed base da simulação (RNF08: fixa entre reinícios, configurada uma
// vez na composição). No dia de relatório de uma empresa (companies,
// tarefa 3.14), Advance gera sua FundamentalsRecord (fundamentals.NextGrowth
// encadeado a partir de CompanyForFundamentals.LastRevenue) e aplica o
// efeito de preço da surpresa (fundamentals.ReportDayPriceEffect) só na
// cotação desse mesmo dia dos ativos vinculados à empresa — nos demais dias
// do ciclo o preço não sofre esse efeito, só o drift do GBM. macroEvents são
// os eventos macro pendentes (tarefa 4.5, Repository.ListPendingMacroEvents)
// — seu efeito de preço empilha sobre o GBM (macroPriceMultiplier) enquanto
// ativo, e seu efeito de fundamentos entra no crescimento real do ciclo
// (fundamentals.ActualGrowthWithMacroEffect) no dia de relatório atribuído;
// Result.AppliedMacroEventIDs sinaliza quais desses eventos já podem virar
// status = 'aplicado'.
func Advance(current State, assets []AssetForPricing, companies []CompanyForFundamentals, macroEvents []MacroEventForApplication, selicCfg selic.Config, seed int64) Result {
	newDay := current.Day + 1
	dayIndex := newDay - 1 // 0-based, mesma convenção de IsCopomMeetingDay/IsReportDay

	newSelicRate := selic.NextCalendarRate(selicCfg, dayIndex, current.SelicRate)

	equityRiskClasses := companyEquityRiskClasses(assets)
	assetToCompany := assetCompanies(assets)
	macroFundamentalsEffects := macroFundamentalsEffectsByCompany(macroEvents, companies, equityRiskClasses, assetToCompany, newDay)

	reportEffects := make(map[string]companyReportEffect, len(companies))
	fundamentalsRecords := make([]FundamentalsRecord, 0, len(companies))
	for _, c := range companies {
		if !fundamentals.IsReportDay(dayIndex, c.ReportFrequencyDays) {
			continue
		}

		cfg := fundamentalsConfig(seed, c.CompanyID, equityRiskClasses[c.CompanyID])
		cycleIndex := (dayIndex+1)/c.ReportFrequencyDays - 1 // 0-based, um por ciclo de relatório já fechado
		actualGrowth := fundamentals.NextGrowth(cfg, cycleIndex, newSelicRate, selicCfg.Neutral)
		if macroEffect, affected := macroFundamentalsEffects[c.CompanyID]; affected {
			actualGrowth = fundamentals.ActualGrowthWithMacroEffect(actualGrowth, macroEffect)
		}
		expectedGrowth := fundamentals.ExpectedGrowth(cfg, newSelicRate, selicCfg.Neutral)

		baseRevenue := fundamentals.DefaultBaseRevenue
		if c.LastRevenue != nil {
			baseRevenue = *c.LastRevenue
		}
		netRevenue := fundamentals.RevenueSeries(baseRevenue, []float64{actualGrowth})[0]

		reportEffects[c.CompanyID] = companyReportEffect{
			NetRevenue: netRevenue,
			PriceEffect: fundamentals.ReportDayPriceEffect(
				fundamentals.ReportSurprise(actualGrowth, expectedGrowth),
				fundamentals.DefaultReportPriceSensitivity,
			),
		}
		fundamentalsRecords = append(fundamentalsRecords, FundamentalsRecord{CompanyID: c.CompanyID, NetRevenue: netRevenue})
	}

	quotes := make([]Quote, 0, len(assets))
	for _, a := range assets {
		lastPrice := DefaultInitialPrice
		if a.LastPrice != nil {
			lastPrice = *a.LastPrice
		}

		cfg := equity.Config{
			RiskClass: riskClassForPricing(a.RiskClass),
			Seed:      deterministicSeed(seed, a.AssetID),
		}
		price, ok := equity.NextPrice(cfg, dayIndex, lastPrice, newSelicRate)
		if !ok {
			continue
		}

		price *= macroPriceMultiplier(macroEvents, a, newDay)

		if a.CompanyID != nil {
			if effect, reported := reportEffects[*a.CompanyID]; reported {
				price *= 1 + effect.PriceEffect
			}
		}

		quotes = append(quotes, Quote{AssetID: a.AssetID, Price: price})
	}

	appliedMacroEventIDs := make([]string, 0)
	for _, ev := range macroEvents {
		if macroEventDone(ev, newDay) {
			appliedMacroEventIDs = append(appliedMacroEventIDs, ev.ID)
		}
	}

	return Result{
		State:                State{Day: newDay, SelicRate: newSelicRate},
		Quotes:               quotes,
		Fundamentals:         fundamentalsRecords,
		IsCopomDay:           selic.IsCopomMeetingDay(dayIndex),
		IsReportDay:          fundamentals.IsReportDay(dayIndex, fundamentals.DefaultReportFrequencyDays),
		AppliedMacroEventIDs: appliedMacroEventIDs,
	}
}
