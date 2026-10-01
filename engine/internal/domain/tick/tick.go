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

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/dividend"
	"tcc-investimentos/engine/internal/domain/equity"
	"tcc-investimentos/engine/internal/domain/fii"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/ipca"
	"tcc-investimentos/engine/internal/domain/macroevent"
	"tcc-investimentos/engine/internal/domain/selic"
)

// DefaultInitialPrice é o preço de partida de um ativo de renda variável
// antes do primeiro tick gerar uma cotação — dado ilustrativo sem fórmula
// de geração ainda, mesmo tratamento dado a outros parâmetros "sujeitos à
// calibração da tarefa 8.1" (precedente: interest_rate/maturity_date da
// tarefa 3.9).
const DefaultInitialPrice = 100.00

// assetTypeAcao/assetTypeFII/assetTypeETF são os valores crus de
// AssetForPricing.Type — usados só pra decidir quando Advance pula o GBM (Fase
// D.2 pra Ação, tarefa G.1 pra FII, tarefa R.4 pra ETF — preço passa a vir da
// rodada de negociação real, rounds.go). Não é o mesmo conceito de catalog.AssetAcao/
// AssetFII (tick não importa catalog só pra isso, mesma nota de
// Sector/RiskClass).
const (
	assetTypeAcao = "acao"
	assetTypeFII  = "fii"
	assetTypeETF  = "etf"
)

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
	// não têm empresa individual (spec 3.6). Usado por companyEquityRiskClasses/
	// assetCompanies (tick.go) pra resolver o fan-out de risk_class/evento
	// macro por empresa — o efeito de preço do resultado divulgado não é
	// mais aplicado direto numa cotação (tarefa F.1): nasce da negociação
	// real do Fundamentalista contra o net_revenue recém-divulgado
	// (companyRoundContexts).
	CompanyID *string
	// Sector é o setor (company_sector, mesma string crua de
	// macro_event_targets.sector/companies.sector — não catalog.Sector
	// tipado, mesma convenção de RiskClass acima) da empresa emissora, nil
	// pra ETF/FII (sem CompanyID) — usado por Advance (tarefa 4.5) pra
	// resolver o fan-out de um evento macro de alvo setorial pros ativos
	// das empresas daquele setor.
	Sector *string
	// Type é o tipo do ativo (assets.type: "acao"/"etf"/"fii", cru — mesma
	// convenção de Sector/RiskClass acima, tick não importa catalog só pra
	// isso) — usado por Advance pra excluir Ação (Fase D.2) e FII (tarefa
	// G.1) do GBM: preço de ambos passa a nascer só da rodada de negociação
	// real (runIntradayRounds, rounds.go), nunca mais do GBM. ETF continua
	// no GBM até a Fase H estender o mesmo motor de negociação real pra ele.
	Type string
	// ShareClass (tarefa J.3) só vem preenchido pra "acao" — "ON"/"PN"
	// (convenção do seed, catalog.VariableIncomeAsset.ShareClass, mesma de
	// DividendPayerAsset.ShareClass abaixo) — usado por buildEquityUniverse
	// (rounds.go) pra decidir se o Fundamentalista aplica o premium de
	// dividendo da PN (companies.pn_dividend_premium_pct) na estimativa de
	// preço justo desse ativo. nil (ou qualquer valor != "PN") conta como
	// ON, mesma convenção de equityShareClassesByCompany.
	ShareClass *string
	// OutstandingShares é o float do ativo (variable_income_assets.
	// outstanding_shares), nil se desconhecido — insumo do mínimo de
	// quantidade restante da cotação de Market Maker (tarefa P.4).
	OutstandingShares *int64
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
	// PnDividendPremiumPct é companies.pn_dividend_premium_pct (tarefa J.2)
	// — vantagem legal de dividendo da ação PN sobre a ON dessa empresa
	// (Lei 6.404/76, art. 17), consumida por dividend.EquityValuePerShare.
	// Empresa só-ON nunca chega a usar esse valor (pnShares = 0 no cálculo).
	PnDividendPremiumPct float64
	// BaseGrowthPct é companies.base_growth_pct (tarefa 7.2) — crescimento_base
	// desta empresa por ciclo, em % (fundamentalsConfig converte pra fração).
	// Substitui o único valor global (fundamentals.DefaultBaseGrowth) que toda
	// empresa usava antes desta tarefa — ver doc de catalog.Company.BaseGrowthPct.
	BaseGrowthPct float64
	// QualityMultiplier é companies.quality_multiplier (achado 025) — escala
	// margens/alavancagem do setor pra esta empresa (fundamentals.
	// CoefficientsForCompany). Zero (campo não preenchido) vale neutro (1).
	QualityMultiplier float64
}

// MacroEventTargetForApplication espelha uma linha de macro_event_targets
// pro consumo de Advance (tarefa 4.5) — mesma forma de macroevent.Target
// (sector/risk_class/asset_id, exatamente um preenchido), mas Sector fica
// cru (*string, não catalog.Sector) pela mesma razão de AssetForPricing.
// RiskClass já ser cru: tick não precisa importar catalog só pra isso.
// Direction/PriceEffectPct (tarefa E.1) espelham macroevent.Target — nil
// no caso comum (alvo herda a direção/magnitude do evento inteiro,
// MacroEventForApplication.PriceEffectPct), preenchidos só quando este
// alvo declarou direção própria (evento "misto" com sinais diferentes por
// alvo). Só PriceEffectPct é de fato lido, por macroPriceEffectsByCompany
// (tarefa E.2) — o sinal já está embutido nele desde a amostragem
// (macroeventtrigger.sampleTargetEffects), então Direction chega até aqui
// (lido só pelo SELECT de ListPendingMacroEvents) sem nenhum consumidor —
// não confundir com "lido por macroPriceEffectsByCompany" (achado de
// review: comentário anterior alegava isso, nunca foi verdade). Nenhum dos
// dois é usado por macroFundamentalsEffectsByCompany, que continua lendo só
// o valor do evento (granularidade por alvo da parte de fundamentos fica
// fora do escopo da E.2, que é só sobre o preço justo do Fundamentalista).
type MacroEventTargetForApplication struct {
	Sector         *string
	RiskClass      *string
	AssetID        *string
	Direction      *string
	PriceEffectPct *float64
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
// Os cinco campos além de NetRevenue vêm de fundamentals.DeriveFinancials
// (tarefa 4.8) — antes disso só NetRevenue era preenchido, os demais
// ficavam NULL pra sempre.
type FundamentalsRecord struct {
	CompanyID       string
	NetRevenue      float64
	NetIncome       float64
	EBIT            float64
	NetEquity       float64
	GrossDebt       float64
	CashEquivalents float64
}

// Quote é o novo preço gerado pra um ativo num tick, pronto pra persistir
// em asset_quotes.
type Quote struct {
	AssetID string
	Price   float64
	// Quantity (achado 005 parte B) é o total negociado de assetID neste
	// dia simulado, somando todo fill real das rodadas de bot
	// (runIntradayRounds) — 0 pra ativo que não negociou (ou que ainda está
	// no caminho de GBM, ex: ETF). Persistido em asset_quotes.total_quantity
	// (SaveTick), insumo de RecentTradedVolume, que alimenta o teto de
	// tamanho de ordem por volume médio recente (decisionInputFor,
	// rounds.go).
	Quantity int
}

// PositionHolder é a posição de um usuário num ativo pagador de provento,
// no momento em que o Temporizador roda o tick de geração — vira o
// snapshot de elegibilidade de um DividendRecord (a "data ex", tarefa
// 4.9): só quem está nesta lista recebe o pagamento no dia de pagamento,
// mesmo que compre/venda o ativo depois.
type PositionHolder struct {
	UserID   string
	Quantity int
}

// DividendPayerAsset é o insumo do catálogo que Advance precisa por ativo
// pagador de provento (ação ou FII, tarefa 4.9, RF21) — Type é "acao" ou
// "fii" cru (mesma convenção de AssetForPricing.Sector: tick não importa
// catalog só pra isso). CompanyID só vem preenchido pra "acao" (usado por
// Advance pra achar o net_income do ciclo, já calculado no loop de
// empresas); NetWorth/PortfolioValue só pra "fii" — mutuamente exclusivos
// por perfil (fii_details.net_worth pra tijolo, fii_details.portfolio_value
// pra papel desde a tarefa 4.10), ambos consumidos por
// dividend.FIIValuePerShare como a mesma grandeza numérica de origem
// (fórmula não muda, só a coluna). Holders é a posição de cada usuário
// nesse ativo, carregada eagerly pelo Repository — vira Recipients de um
// DividendRecord se o ativo gerar provento neste tick. Desde a tarefa G.2,
// esta mesma lista também alimenta fiiNetWorthUpdatesForCycle — NetWorth
// (tijolo) é o insumo da reavaliação periódica, sem precisar de mais
// nenhuma leitura do catálogo. Indexador (tarefa G.3) só vem preenchido
// pra "fii" perfil papel (fii_details.indexador, mutuamente exclusivo com
// NetWorth/tijolo desde a 3.8) — insumo de fiiPortfolioValueUpdatesForCycle,
// mesma reutilização de lista sem query nova.
type DividendPayerAsset struct {
	AssetID           string
	Type              string
	OutstandingShares *int64
	CompanyID         *string
	// ShareClass (tarefa J.2) só vem preenchido pra "acao" — "ON"/"PN"
	// (convenção do seed, catalog.VariableIncomeAsset.ShareClass) usada por
	// dividendRecordsForCycle pra separar o valor por ação de cada classe
	// (dividend.EquityValuePerShare) e agregar as duas bases de ações em
	// circulação da mesma empresa antes de dividir o provento entre elas.
	ShareClass     *string
	NetWorth       *float64
	PortfolioValue *float64
	Indexador      *string
	// FIIType ("tijolo"/"papel", fii_details.fii_type) e Segment
	// (fii_details.segment, texto livre e nullable) só vêm preenchidos pra
	// "fii" (tarefa U.2): são o insumo de fiiRoundContexts, que resolve o
	// P/VP-alvo do preço justo de FII (fii.TargetPriceToBook) sem nenhuma
	// leitura nova do catálogo, mesma reutilização de lista de NetWorth/
	// PortfolioValue/Indexador acima.
	FIIType *string
	Segment *string
	Holders []PositionHolder
}

// DividendRecord é um novo dividend_events pronto pra persistir — gerado
// no dia de relatório (mesmo calendário quinzenal de fundamentals, tarefa
// 3.14) de um ativo pagador. PaymentDay é o dia simulado (não a data de
// calendário real — diferente de company_fundamentals.period_date, este
// campo precisa ser determinístico e alcançável em poucos ticks de teste,
// porque governa quando um tick futuro credita os Recipients) em que o
// Temporizador paga o provento — sempre newDay + dividend.
// DefaultPaymentLagDays. Recipients é o snapshot de PositionHolder
// capturado na data ex (este mesmo tick), garantindo que só quem tinha
// posição nesse momento recebe, mesmo que a posição mude antes do dia de
// pagamento (critério de aceite da tarefa 4.9).
type DividendRecord struct {
	AssetID       string
	ValuePerShare float64
	PaymentDay    int
	Recipients    []PositionHolder
	// FundLiability (R.8) é, num provento de ETF, o total que o fundo passa a dever
	// na data-ex (valor por cota x cotas dos cotistas); zero nos demais ativos.
	FundLiability float64
}

// NetWorthUpdate é o novo `fii_details.net_worth` de um FII tijolo pronto
// pra persistir (tarefa G.2) — diferente de FundamentalsRecord/
// DividendRecord, não é uma linha nova numa tabela de histórico: `net_worth`
// é uma coluna mutável de `fii_details` (asset_id como chave primária), e
// SaveTick faz um UPDATE simples, não um INSERT. Gerado no mesmo dia de
// relatório global (fundamentals.DefaultReportFrequencyDays) que já dispara
// o relatório de empresas/dividendos.
type NetWorthUpdate struct {
	AssetID  string
	NetWorth float64
}

// PortfolioValueUpdate é o novo `fii_details.portfolio_value` de um FII
// papel pronto pra persistir (tarefa G.3) — mesma natureza de NetWorthUpdate
// (UPDATE de coluna mutável, não uma linha nova de histórico).
type PortfolioValueUpdate struct {
	AssetID        string
	PortfolioValue float64
}

// PendingDividendPayment é um dividend_events com paid = false —
// Repository.ListPendingDividendPayments devolve todos, Advance filtra os
// que vencem em newDay (PaymentDay == newDay), mesmo padrão de
// MacroEventForApplication/ListPendingMacroEvents.
type PendingDividendPayment struct {
	ID            string
	AssetID       string
	ValuePerShare float64
	PaymentDay    int
	Recipients    []PositionHolder
	// FundAccountID (R.8) é a conta do fundo quando o pagador é um ETF: o
	// pagamento debita o caixa dela e quita o passivo; vazio nos demais ativos.
	FundAccountID string
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
	// NewDividends são os novos dividend_events gerados neste tick (tarefa
	// 4.9), no dia de relatório de cada ativo pagador — SaveTick insere a
	// linha e o snapshot de Recipients (dividend_event_recipients)
	// atomicamente com o resto do tick.
	NewDividends []DividendRecord
	// DuePayments são os PendingDividendPayment cujo PaymentDay é
	// exatamente este tick (newDay) — SaveTick credita
	// current_balance/total_dividends_received de cada Recipient, gravando
	// o evento dividend_payment em market_events **antes** de projetar o
	// saldo (Event Sourcing, CLAUDE.md), e marca paid = true.
	DuePayments []PendingDividendPayment
	// NetWorthUpdates são os novos `fii_details.net_worth` de cada FII
	// tijolo reavaliado neste tick (tarefa G.2) — só populado no mesmo dia
	// de relatório global que também gera Fundamentals/NewDividends;
	// SaveTick faz um UPDATE por item, não um INSERT (ver doc de
	// NetWorthUpdate).
	NetWorthUpdates []NetWorthUpdate
	// PortfolioValueUpdates são os novos `fii_details.portfolio_value` de
	// cada FII papel reavaliado neste tick (tarefa G.3) — mesmo calendário
	// de NetWorthUpdates, populado por fiiPortfolioValueUpdatesForCycle;
	// SaveTick faz um UPDATE por item, não um INSERT.
	PortfolioValueUpdates []PortfolioValueUpdate
	// IntradayRounds é a cadência intradiária sorteada pra newDay (Fase
	// D.1, IntradayRounds) — quantas rodadas de negociação de bot o dia
	// terá e em que ponto do expediente simulado cada uma cai. Consumido
	// por Service.Run (Fase D.2, runIntradayRounds, rounds.go) depois de
	// Advance devolver; não afeta nenhum outro campo deste Result — Selic,
	// calendário de relatório e proventos são calculados do jeito que já
	// eram, sem depender desta cadência.
	IntradayRounds []IntradayRound
	// CompanyContext é "o que se sabe hoje" sobre cada empresa (financeiros
	// derivados + crescimento esperado, CompanyRoundContext, rounds.go),
	// pra todas elas — não só as que bateram dia de relatório neste tick
	// (diferente de Fundamentals/reportEffects, que só cobrem o dia exato do
	// relatório). Consumido só pelo arquétipo Fundamentalista dentro de
	// runIntradayRounds (Fase D.2): fora do dia de relatório, ele reavalia o
	// preço justo com os últimos financeiros conhecidos e o crescimento
	// esperado ajustado pela Selic de hoje (fundamentals.ExpectedGrowth),
	// mesmo sem relatório novo — não persistido, existe só pra alimentar a
	// rodada dentro desta mesma chamada de Run.
	CompanyContext map[string]CompanyRoundContext
	// FIIContext (tarefa U.2, achado 024) é o equivalente de CompanyContext
	// pra FII, indexado por AssetID (FII não tem empresa): valor-base por
	// cota já reavaliado neste mesmo tick, P/VP-alvo pra Selic de hoje e
	// efeito de provento (FIIRoundContext, rounds.go). Só montado por
	// fiiRoundContexts, ainda sem consumidor: o Fundamentalista passa a
	// lê-lo na tarefa U.3.
	FIIContext map[string]FIIRoundContext
	// IntradayFillsCount é quantos fills reais aconteceram nas rodadas de
	// negociação de bot deste tick (Fase D.2, runIntradayRounds) — sempre 0
	// vindo de Advance (Advance não roda rodada nenhuma, é puro); Service.Run
	// preenche depois de chamar runIntradayRounds, só pra observabilidade
	// (ver tickResponse, httpserver/admin.go). Não é persistido — os fills em
	// si já estão em order_book/market_events (Event Sourcing),
	// reconstituíveis sem precisar deste contador.
	IntradayFillsCount int
	// ExpiredOrdersCount (achado 005 parte A.3) é quantas ordens
	// pendentes/parciais de um dia simulado anterior foram canceladas por
	// OrderLifecycleManager.ExpireStaleOrders antes das rodadas deste tick
	// rodarem — sempre 0 vindo de Advance (Advance não toca order_book, é
	// puro); Service.Run preenche depois, só pra observabilidade (mesmo
	// padrão de IntradayFillsCount, ver tickResponse, httpserver/admin.go).
	ExpiredOrdersCount int
	// UncoveredAssetsCount (tarefa P.3, proposta-cobertura-market-maker.md
	// seção 3.9) é quantos ativos negociáveis (Ação/FII) ficaram sem Market
	// Maker ativo cobrindo neste tick — só observabilidade, mesma natureza de
	// IntradayFillsCount. A correção (reatribuir) é do painel de bots (Fase N).
	UncoveredAssetsCount int
	// IPCAMonthlyRate (tarefa M.1) é o IPCA mensal sintético (decimal) do
	// mês simulado ao qual newDay pertence (ipca.CurrentMonthIndex) —
	// repete o mesmo valor todo dia dentro do mesmo mês simulado, só muda
	// no dia em que o mês vira (ipca.MonthlyRate, memoryless, sem depender
	// dos meses anteriores).
	IPCAMonthlyRate float64
	// IPCAAccumulated12m (tarefa M.1) é o IPCA acumulado nos últimos 12
	// meses simulados (decimal, composição — não soma simples,
	// ipca.Accumulated12m) — janela parcial (menos de 12 meses compostos)
	// antes do primeiro ano simulado. Persistido junto de
	// IPCAMonthlyRate/State.SelicRate em market_indicator_history
	// (SaveTick), uma linha por dia simulado.
	IPCAAccumulated12m float64
	// ETFNAVs (tarefa R.3) é o NAV de fechamento de cada ETF com cotas emitidas
	// neste tick, com o preço de fechamento e o ágio/deságio — SaveTick grava
	// uma linha de etf_nav_history por item, atomicamente com o resto do tick.
	ETFNAVs []ETFNAVEntry
}

// ETFNAVEntry é o NAV de fechamento de um ETF num dia simulado (R.3).
type ETFNAVEntry struct {
	ETFAssetID string
	NAV        float64
	ClosePrice float64
	PremiumPct float64
	// IndexValue e TrackingErrorPct (R.7): índice teórico do fundo (pesos-alvo,
	// sem atrito) e o desvio acumulado do NAV contra ele, em pontos percentuais.
	IndexValue       float64
	TrackingErrorPct float64
	// ExpenseAccrued e ExpensePaid (R.9): taxa de administração acumulada hoje (passivo
	// do fundo) e a acumulada que o fundo quitou do caixa hoje.
	ExpenseAccrued float64
	ExpensePaid    float64
}

// IndicatorHistoryEntry é uma linha de market_indicator_history (tarefa
// M.1) — usado só pela leitura da série histórica (GET
// /market/indicators/history, tarefa M.2), nunca por Advance/Result (que já
// tem os mesmos três valores achatados em State.SelicRate/IPCAMonthlyRate/
// IPCAAccumulated12m, sem o dia junto, porque Result é sempre "o dia que
// acabou de ser gerado" — aqui é preciso o dia explícito por ser uma série).
type IndicatorHistoryEntry struct {
	SimulatedDay       int
	SelicRate          float64
	IPCAMonthlyRate    float64
	IPCAAccumulated12m float64
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
	// ListDividendPayerAssets devolve todo ativo pagador de provento (ação
	// ou FII, is_sandbox = false) com outstanding_shares/net_worth/
	// portfolio_value/indexador (net_worth/portfolio_value mutuamente
	// exclusivos por perfil de FII, tarefa 4.10; indexador só vem
	// preenchido pro perfil papel, tarefa G.3) do catálogo e a posição de
	// cada usuário nesse ativo — usado por Advance (tarefa 4.9) pra
	// decidir, no dia de relatório, o valor por ação/cota do ciclo e o
	// snapshot de elegibilidade (posição na data ex) de um novo
	// dividend_events, e (tarefas G.2/G.3) pra reavaliar NetWorth/
	// PortfolioValue no mesmo calendário.
	ListDividendPayerAssets(ctx context.Context) ([]DividendPayerAsset, error)
	// ListPendingDividendPayments devolve todo dividend_events com paid =
	// false, com seus Recipients (dividend_event_recipients) — usado por
	// Advance (tarefa 4.9) pra decidir quais vencem (PaymentDay == newDay)
	// e creditar accounts.current_balance/total_dividends_received de cada
	// Recipient.
	ListPendingDividendPayments(ctx context.Context) ([]PendingDividendPayment, error)
	// SaveTick persiste o novo estado do calendário e as cotações geradas,
	// atomicamente — nem calendário nem cotações são escrita de
	// saldo/posição de usuário, por isso não passa por Event Sourcing
	// (mesma distinção já documentada em catalog.Asset pra dado cadastral).
	SaveTick(ctx context.Context, result Result) error
}

// riskClassForPricing resolve a risk_class usada como calibração do GBM —
// ETF não tem risk_class própria no catálogo hoje (a spec só define a
// tabela de volatilidade/drift por risk_class pra ações, seção 3.2); até um
// modelo de precificação próprio pra ETF existir (Fase H), tratamos como
// Conservador (mais estável), decisão de escopo da tarefa 3.11, não uma
// calibração fechada da spec. FII saiu deste tratamento na tarefa G.1 (não
// passa mais por GBM, então não chama mais esta função).
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

// fundamentalsConfig monta o fundamentals.Config de uma empresa pro ciclo
// de relatório — Sensitivity vem do setor da empresa
// (fundamentals.CoefficientsForSector, tarefa K.2) usada pra calibrar o
// quanto a empresa reage a desvios da Selic (spec 3.2.2). Antes da K.2,
// Sensitivity vinha da risk_class de um ativo de renda variável vinculado à
// empresa (fundamentals.SensitivityByRiskClass) — essa tabela continua
// existindo e em uso só por bot.FundamentalistFairPrice (retorno exigido,
// consumo fora do escopo da K.2), não mais aqui. Sensitivity cai no
// fallback genérico (CoefficientsForSector) se sector não for um dos 6
// fixos da spec 3.3.2 — não deveria acontecer com o catálogo seedado
// (catalog.NewCompany já valida o setor na criação), mas não trava o ciclo
// de relatório se acontecer.
// fundamentalsConfig monta o Config de crescimento de uma empresa —
// baseGrowthPct (companies.base_growth_pct, tarefa 7.2) é o crescimento_base
// PRÓPRIO da empresa, não mais fundamentals.DefaultBaseGrowth fixo pra todo
// mundo (ver doc de CompanyForFundamentals.BaseGrowthPct/catalog.Company.
// BaseGrowthPct sobre por que isso importa pra "empresa boa/média/ruim").
func fundamentalsConfig(seed int64, companyID string, sector catalog.Sector, baseGrowthPct float64) fundamentals.Config {
	return fundamentals.Config{
		BaseGrowth:  baseGrowthPct / 100,
		Sensitivity: fundamentals.CoefficientsForSector(sector).SelicSensitivity,
		NoiseStdDev: fundamentals.DefaultNoiseStdDev,
		Seed:        deterministicSeed(seed, companyID),
	}
}

// dividendPriceEffectBandDays é quantos dias simulados, contados a partir
// do dia de relatório inclusive (o mesmo dia em que dividendRecordsForCycle
// gera o provento do ciclo), o provento de ação recém-pago fica ativo na
// estimativa de preço justo do Fundamentalista (tarefa S.13, achado
// 018-023) — janela curta e ilustrativa (mesmo espírito de
// macroevent.EffectRange/DurationDays, sujeita a calibração como os demais
// coeficientes do motor), sempre bem menor que o ciclo trimestral inteiro
// (fundamentals.DefaultReportFrequencyDays): decai a zero sozinha quando a
// janela termina, antes do próximo ciclo recalcular net_equity do zero.
const dividendPriceEffectBandDays = 10

// dividendPriceEffectPct devolve o efeito de preço do provento de ação
// pago no último dia de relatório da empresa (dividend.EquityPriceEffectPct,
// S.13) se dayIndex ainda está dentro de dividendPriceEffectBandDays desde
// esse relatório, 0 fora da janela. "Dias desde o último relatório" não
// precisa de nenhum estado persistido novo — fundamentals.IsReportDay já é
// puramente periódica ((dayIndex+1) % reportFrequencyDays == 0), então a
// distância até o relatório anterior mais recente é sempre
// (dayIndex+1) % reportFrequencyDays, 0 no próprio dia de relatório
// (mesma convenção "ativo do dia do disparo até duration-1 dias depois,
// inclusive" de macroevent.IsPriceEffectActive). financials já é o mesmo
// valor usado pra montar CompanyRoundContext.Financials (baseRevenue =
// reportedRevenue no dia de relatório, c.LastRevenue depois — o net_income
// que gerou o último dividendRecordsForCycle continua sendo o mesmo em
// qualquer dia dentro do ciclo, já que LastRevenue só muda no próximo
// relatório), então não recalcula nada, só decide se o efeito já
// calculado está dentro da janela.
func dividendPriceEffectPct(financials fundamentals.Financials, dayIndex, reportFrequencyDays int) float64 {
	if dayIndex < reportFrequencyDays-1 {
		// Nenhum relatório (e portanto nenhum dividendo) aconteceu ainda —
		// sem essa guarda, (dayIndex+1) % reportFrequencyDays sozinho não
		// distingue "N dias antes do primeiro relatório" de "N dias depois
		// de um relatório", e ativaria o efeito com um net_income que nunca
		// foi de fato distribuído.
		return 0
	}
	daysSinceReport := (dayIndex + 1) % reportFrequencyDays
	if daysSinceReport >= dividendPriceEffectBandDays {
		return 0
	}
	return dividend.EquityPriceEffectPct(financials.NetIncome, financials.NetEquity)
}

// fiiDividendPriceEffectPct (tarefa U.4) é o equivalente de
// dividendPriceEffectPct pro provento mensal de FII: o efeito negativo do
// provento (dividend.FIIPriceEffectPct) enquanto dayIndex está dentro de
// dividendPriceEffectBandDays desde o último pagamento
// (dividend.FIIPayoutIntervalDays, calendário de 30 dias, mesma técnica sem
// estado persistido e mesma guarda de primeiro ciclo), 0 fora da banda. Não é
// permanente: ver o doc de dividend.FIIPriceEffectPct.
func fiiDividendPriceEffectPct(baseValue float64, outstandingShares int64, yieldPerCyclePct float64, dayIndex int) float64 {
	if dayIndex < dividend.FIIPayoutIntervalDays-1 {
		return 0
	}
	if (dayIndex+1)%dividend.FIIPayoutIntervalDays >= dividendPriceEffectBandDays {
		return 0
	}
	perShare, ok := dividend.FIIValuePerShare(baseValue, outstandingShares, yieldPerCyclePct)
	if !ok {
		return 0
	}
	return dividend.FIIPriceEffectPct(perShare, baseValue/float64(outstandingShares))
}

// companyRoundContexts monta, pra CADA empresa (não só as que bateram dia de
// relatório neste tick — diferente do loop que produz reportedRevenue/
// fundamentalsRecords acima), o que a Fase D.2 (runIntradayRounds, rounds.go)
// precisa pro arquétipo Fundamentalista reavaliar seu preço justo hoje:
// financeiros derivados (a partir de reportedRevenue[cid] quando a empresa
// relatou agora nesse mesmo tick; senão c.LastRevenue/
// fundamentals.DefaultBaseRevenue, o mesmo fallback que o loop de relatório
// já usa), o crescimento esperado — sempre fundamentals.ExpectedGrowth
// contra a Selic de hoje (newSelicRate), nunca o crescimento realizado com
// ruído idiossincrático (actualGrowth): o Fundamentalista projeta a
// expectativa sistêmica de todo dia, não o resultado de uma empresa
// específica, que só existe no dia exato do relatório dela — e o efeito de
// preço macro combinado (macroPriceEffects[c.CompanyID], tarefa E.2, zero
// value 0 quando nenhum evento afeta a empresa hoje). É esta combinação —
// VPA derivado do net_revenue recém-divulgado (com o ruído idiossincrático
// do ciclo já embutido) contra um GrowthRate sempre sistêmico — que produz
// o "resultado vs. expectativa" da spec 3.3 sem nenhuma fórmula de
// surpresa/efeito de preço separada (fundamentals.ReportSurprise/
// ReportDayPriceEffect, removidas na tarefa F.1 do
// backlog-motor-mercado-realista): o Fundamentalista reage à divergência
// entre o VPA que acabou de mudar e a expectativa de crescimento que já
// estava precificada, negociando de acordo. dayIndex (tarefa S.13) alimenta
// dividendPriceEffectPct — ver doc daquela função.
func companyRoundContexts(companies []CompanyForFundamentals, reportedRevenue map[string]float64, seed int64, newSelicRate, selicNeutral float64, macroPriceEffects map[string]float64, dayIndex int) map[string]CompanyRoundContext {
	contexts := make(map[string]CompanyRoundContext, len(companies))
	for _, c := range companies {
		sector := catalog.Sector(c.Sector)
		cfg := fundamentalsConfig(seed, c.CompanyID, sector, c.BaseGrowthPct)

		baseRevenue := fundamentals.DefaultBaseRevenue
		if c.LastRevenue != nil {
			baseRevenue = *c.LastRevenue
		}
		if reported, ok := reportedRevenue[c.CompanyID]; ok {
			baseRevenue = reported
		}
		financials := fundamentals.DeriveFinancials(sector, c.QualityMultiplier, baseRevenue)

		contexts[c.CompanyID] = CompanyRoundContext{
			Financials:           financials,
			GrowthRate:           fundamentals.ExpectedGrowth(cfg, newSelicRate, selicNeutral),
			MacroEffectPct:       macroPriceEffects[c.CompanyID],
			PnDividendPremiumPct: c.PnDividendPremiumPct,
			DividendEffectPct:    dividendPriceEffectPct(financials, dayIndex, c.ReportFrequencyDays),
		}
	}
	return contexts
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

// matchingTarget devolve (matched=true) o target mais específico de targets
// que alcança a empresa companyID (setor, risk_class de um de seus ativos de
// renda variável, ou asset_id de um ativo que ela emite, via
// assetToCompany) — fan-out compartilhado por macroFundamentalsEffectsByCompany
// (só precisa do bool) e macroPriceEffectsByCompany (tarefa E.2, também
// precisa do Target em si, pra ler Direction/PriceEffectPct próprios,
// tarefa E.1). Checagem por ordem de especificidade (asset_id > risk_class >
// sector), não pela ordem de targets em si — ListPendingMacroEvents não
// garante (nem deveria precisar garantir) a ordem das linhas de
// macro_event_targets de um mesmo evento, então um override por ativo
// específico (o caso de uso central da E.1: setor inteiro com um sinal,
// uma empresa daquele setor com sinal próprio oposto) nunca pode depender de
// qual target foi inserido/lido primeiro. Um evento com mais de um target
// batendo a mesma empresa no mesmo nível de especificidade (raro) usa o
// primeiro encontrado nesse nível.
func matchingTarget(targets []MacroEventTargetForApplication, companyID, sector string, riskClass equity.RiskClass, assetToCompany map[string]string) (MacroEventTargetForApplication, bool) {
	for _, t := range targets {
		if t.AssetID != nil {
			if cid, ok := assetToCompany[*t.AssetID]; ok && cid == companyID {
				return t, true
			}
		}
	}
	for _, t := range targets {
		if t.RiskClass != nil && *t.RiskClass == string(riskClass) {
			return t, true
		}
	}
	for _, t := range targets {
		if t.Sector != nil && *t.Sector == sector {
			return t, true
		}
	}
	return MacroEventTargetForApplication{}, false
}

// eventTargetsCompany confere se algum dos targets de um evento macro
// alcança a empresa companyID — usado só por macroFundamentalsEffectsByCompany,
// que não precisa do Target em si (granularidade por alvo da parte de
// fundamentos fica fora do escopo da E.2).
func eventTargetsCompany(targets []MacroEventTargetForApplication, companyID, sector string, riskClass equity.RiskClass, assetToCompany map[string]string) bool {
	_, matched := matchingTarget(targets, companyID, sector, riskClass, assetToCompany)
	return matched
}

// macroPriceEffectsByCompany soma (macroevent.CombinePendingEffects, com o
// teto ±macroevent.DefaultPriceEffectCapPct — sem ele, eventos severos
// empilhados passariam de -100% e inverteriam o sinal do preço justo, achado
// 004; o multiplicador antigo empilhava por produto e nunca invertia) o efeito de preço de todo evento macro pendente cujo efeito de
// preço está ativo em newDay (macroevent.IsPriceEffectActive) e cujo alvo
// alcança a empresa. A magnitude usada é a do próprio Target quando ele
// declarou direção própria (t.PriceEffectPct != nil — evento "misto" com
// sinal por alvo, tarefa E.1), senão o valor do evento inteiro
// (ev.PriceEffectPct, caso comum — "não-misto" ou alvo que herda a
// direção, sem precisar declarar nada por alvo). Resultado: um
// deslocamento (escala percentual) por empresa, consumido só pelo
// arquétipo Fundamentalista (tarefa E.2, via CompanyRoundContext.
// MacroEffectPct) — nunca mais um multiplicador direto sobre o preço.
func macroPriceEffectsByCompany(macroEvents []MacroEventForApplication, companies []CompanyForFundamentals, equityRiskClasses map[string]equity.RiskClass, assetToCompany map[string]string, newDay int) map[string]float64 {
	pending := make(map[string][]float64)
	for _, ev := range macroEvents {
		if !ev.AffectsPrice || ev.PriceEffectPct == nil {
			continue
		}
		if !macroevent.IsPriceEffectActive(ev.TriggeredOnDay, ev.DurationDays, newDay) {
			continue
		}
		for _, c := range companies {
			t, matched := matchingTarget(ev.Targets, c.CompanyID, c.Sector, equityRiskClasses[c.CompanyID], assetToCompany)
			if !matched {
				continue
			}
			pct := *ev.PriceEffectPct
			if t.PriceEffectPct != nil {
				pct = *t.PriceEffectPct
			}
			pending[c.CompanyID] = append(pending[c.CompanyID], pct)
		}
	}

	combined := make(map[string]float64, len(pending))
	for companyID, effects := range pending {
		combined[companyID] = macroevent.CombinePendingEffects(effects, macroevent.DefaultPriceEffectCapPct)
	}
	return combined
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

// equityShareClasses é a base de ações em circulação de cada classe de uma
// mesma empresa (tarefa J.2) — On e Pn somados a partir de todo
// DividendPayerAsset "acao" vinculado a esse company_id (J.1 já permite 1 ou
// 2 ativos por empresa, cada um com seu próprio outstanding_shares). Ação
// sem ShareClass "PN" reconhecida conta como ON — mesma convenção do seed
// (cmd/seed/main.go), que sempre preenche "ON"/"PN" explicitamente pra
// type = 'acao'.
type equityShareClasses struct {
	On int64
	Pn int64
}

// equityShareClassesByCompany agrega equityShareClasses por company_id a
// partir da lista completa de payers — pré-computado uma vez por tick e
// consultado por dividendRecordsForCycle pra cada ativo "acao", em vez de
// cada ativo escanear a lista inteira de novo.
func equityShareClassesByCompany(payers []DividendPayerAsset) map[string]equityShareClasses {
	byCompany := make(map[string]equityShareClasses)
	for _, a := range payers {
		if a.Type != "acao" || a.CompanyID == nil || a.OutstandingShares == nil {
			continue
		}
		classes := byCompany[*a.CompanyID]
		if a.ShareClass != nil && *a.ShareClass == "PN" {
			classes.Pn += *a.OutstandingShares
		} else {
			classes.On += *a.OutstandingShares
		}
		byCompany[*a.CompanyID] = classes
	}
	return byCompany
}

// dividendRecordsForCycle monta os novos dividend_events do dia de
// relatório (tarefa 4.9) — ação usa o net_income já calculado no loop de
// empresas deste mesmo tick (netIncomeByCompany, só preenchido pras
// empresas que bateram IsReportDay agora) e, desde a tarefa J.2, a base de
// ações de cada classe da empresa (equityShareClassesByCompany) mais o
// percentual de vantagem da PN (pnPremiumPctByCompany, companies.
// pn_dividend_premium_pct) pra decidir o valor por ação de cada classe
// separadamente — empresa só-ON continua recebendo exatamente o mesmo valor
// de antes desta tarefa (dividend.EquityValuePerShare reduz à fórmula
// antiga quando pnShares = 0). FII paga proventos mensais
// (dividend.FIIPayoutIntervalDays, tarefa S.2), porque não é vinculado a uma
// company (spec 3.6) nem tem ciclo de relatório próprio, e usa NetWorth (tijolo) ou PortfolioValue (papel, tarefa 4.10) como
// grandeza numérica de origem — mutuamente exclusivos por perfil, a mesma
// dividend.FIIValuePerShare consome qualquer um dos dois sem mudar a
// fórmula. Ativo sem outstanding_shares no catálogo, ou (só ação) cuja
// empresa não bateu relatório neste tick, não gera dividendo nenhum agora —
// nem FII sem NetWorth nem PortfolioValue preenchidos, mesmo tratamento de
// "indicador omitido, não erro nem 0" já dado a dado de origem ausente em
// outros lugares do RF21.
func dividendRecordsForCycle(payers []DividendPayerAsset, netIncomeByCompany map[string]float64, pnPremiumPctByCompany map[string]float64, dayIndex, newDay int) []DividendRecord {
	fiiPayoutDay := fundamentals.IsReportDay(dayIndex, dividend.FIIPayoutIntervalDays)
	shareClasses := equityShareClassesByCompany(payers)

	records := make([]DividendRecord, 0)
	for _, a := range payers {
		if a.OutstandingShares == nil {
			continue
		}

		var value float64
		var ok bool
		switch a.Type {
		case "acao":
			if a.CompanyID == nil {
				continue
			}
			netIncome, reported := netIncomeByCompany[*a.CompanyID]
			if !reported {
				continue
			}
			classes := shareClasses[*a.CompanyID]
			onValue, pnValue, valueOK := dividend.EquityValuePerShare(netIncome, classes.On, classes.Pn, pnPremiumPctByCompany[*a.CompanyID])
			if a.ShareClass != nil && *a.ShareClass == "PN" {
				value, ok = pnValue, valueOK
			} else {
				value, ok = onValue, valueOK
			}
		case "fii":
			if !fiiPayoutDay {
				continue
			}
			baseValue := a.NetWorth
			if baseValue == nil {
				baseValue = a.PortfolioValue
			}
			if baseValue == nil {
				continue
			}
			if a.FIIType == nil {
				continue
			}
			var segment string
			if a.Segment != nil {
				segment = *a.Segment
			}
			yieldPct, err := fii.PayoutYieldPerCyclePct(fii.Type(*a.FIIType), segment)
			if err != nil {
				continue
			}
			value, ok = dividend.FIIValuePerShare(*baseValue, *a.OutstandingShares, yieldPct)
		}
		if !ok {
			continue
		}

		records = append(records, DividendRecord{
			AssetID:       a.AssetID,
			ValuePerShare: value,
			PaymentDay:    newDay + dividend.DefaultPaymentLagDays,
			Recipients:    a.Holders,
		})
	}
	return records
}

// fiiNetWorthUpdatesForCycle reavalia o NetWorth de cada FII tijolo (tarefa
// G.2) no mesmo calendário trimestral global do relatório de
// empresas (fundamentals.DefaultReportFrequencyDays) — fora desse dia,
// devolve nil (nenhuma reavaliação nova, mesmo tratamento de "nada gerado
// hoje" já dado a dividendRecordsForCycle). FII papel (NetWorth nil,
// PortfolioValue preenchido) fica fora — PortfolioValue tem sua própria
// reavaliação (tarefa G.3, indexador da carteira, não Selic). cycleIndex
// (0-based, um por ciclo já fechado) usa a mesma contagem que o loop de
// empresas de Advance já deriva a partir de dayIndex/ReportFrequencyDays —
// aqui sempre fundamentals.DefaultReportFrequencyDays porque FII não tem
// report_frequency_days próprio (FII não tem ciclo de relatório próprio).
func fiiNetWorthUpdatesForCycle(payers []DividendPayerAsset, dayIndex int, newSelicRate, selicNeutral float64, seed int64) []NetWorthUpdate {
	if !fundamentals.IsReportDay(dayIndex, fundamentals.DefaultReportFrequencyDays) {
		return nil
	}
	cycleIndex := (dayIndex+1)/fundamentals.DefaultReportFrequencyDays - 1

	updates := make([]NetWorthUpdate, 0)
	for _, a := range payers {
		if a.Type != assetTypeFII || a.NetWorth == nil {
			continue
		}

		cfg := fii.NetWorthConfig{
			Sensitivity: fii.DefaultNetWorthSelicSensitivity,
			NoiseStdDev: fii.DefaultNetWorthNoiseStdDev,
			Seed:        deterministicSeed(seed, a.AssetID),
		}
		newNetWorth := fii.NextNetWorth(cfg, cycleIndex, *a.NetWorth, newSelicRate, selicNeutral)
		updates = append(updates, NetWorthUpdate{AssetID: a.AssetID, NetWorth: newNetWorth})
	}
	return updates
}

// fiiPortfolioValueUpdatesForCycle reavalia o PortfolioValue de cada FII
// papel (tarefa G.3) no mesmo calendário trimestral global de
// fiiNetWorthUpdatesForCycle — fora do dia de relatório, devolve nil (mesmo
// tratamento). FII tijolo (PortfolioValue nil) fica fora — tem sua própria
// reavaliação (NetWorthUpdates, tarefa G.2). Ativo sem Indexador
// reconhecido (fii.ErrUnknownIndexador — coluna livre no Postgres, sem
// CHECK) é pulado, não trava o tick, mesmo tratamento de "dado inesperado
// do catálogo não é erro" já dado a dividendRecordsForCycle.
func fiiPortfolioValueUpdatesForCycle(payers []DividendPayerAsset, dayIndex int, newSelicRate float64) []PortfolioValueUpdate {
	if !fundamentals.IsReportDay(dayIndex, fundamentals.DefaultReportFrequencyDays) {
		return nil
	}

	updates := make([]PortfolioValueUpdate, 0)
	for _, a := range payers {
		if a.Type != assetTypeFII || a.PortfolioValue == nil || a.Indexador == nil {
			continue
		}

		newValue, err := fii.NextPortfolioValue(*a.Indexador, *a.PortfolioValue, newSelicRate, fundamentals.DefaultReportFrequencyDays)
		if err != nil {
			continue
		}
		updates = append(updates, PortfolioValueUpdate{AssetID: a.AssetID, PortfolioValue: newValue})
	}
	return updates
}

// fiiRoundContexts monta o FIIRoundContext de cada FII que o Fundamentalista
// consegue avaliar hoje (tarefa U.2, achado 024), indexado por AssetID. O
// valor-base é o NetWorth (tijolo) ou PortfolioValue (papel) **já
// reavaliado neste mesmo tick** quando o dia é de relatório global
// (netWorthUpdates/portfolioValueUpdates, G.2/G.3), senão o último valor
// persistido: sem isso o preço justo do dia da reavaliação usaria o
// patrimônio do trimestre anterior. O P/VP-alvo usa a Selic de hoje
// (newSelicRate, selicNeutral, escala 0-100 como o resto do tick). FII sem
// fii_details (tipo nil), sem valor-base, sem cotas positivas ou com tipo
// desconhecido fica de fora sem erro, mesmo tratamento de "dado ausente do
// catálogo não é erro" de dividendRecordsForCycle. DividendEffectPct nasce 0
// (o efeito do provento é a tarefa U.4).
func fiiRoundContexts(payers []DividendPayerAsset, netWorthUpdates []NetWorthUpdate, portfolioValueUpdates []PortfolioValueUpdate, newSelicRate, selicNeutral float64, dayIndex int) map[string]FIIRoundContext {
	netWorthByAsset := make(map[string]float64, len(netWorthUpdates))
	for _, u := range netWorthUpdates {
		netWorthByAsset[u.AssetID] = u.NetWorth
	}
	portfolioValueByAsset := make(map[string]float64, len(portfolioValueUpdates))
	for _, u := range portfolioValueUpdates {
		portfolioValueByAsset[u.AssetID] = u.PortfolioValue
	}

	contexts := make(map[string]FIIRoundContext)
	for _, a := range payers {
		if a.Type != assetTypeFII || a.FIIType == nil || a.OutstandingShares == nil || *a.OutstandingShares <= 0 {
			continue
		}
		fiiType := fii.Type(*a.FIIType)

		var baseValue float64
		switch fiiType {
		case fii.TypeTijolo:
			if a.NetWorth == nil {
				continue
			}
			baseValue = *a.NetWorth
			if updated, ok := netWorthByAsset[a.AssetID]; ok {
				baseValue = updated
			}
		case fii.TypePapel:
			if a.PortfolioValue == nil {
				continue
			}
			baseValue = *a.PortfolioValue
			if updated, ok := portfolioValueByAsset[a.AssetID]; ok {
				baseValue = updated
			}
		default:
			continue
		}

		var segment string
		if a.Segment != nil {
			segment = *a.Segment
		}
		targetPriceToBook, err := fii.TargetPriceToBook(fiiType, segment, newSelicRate, selicNeutral)
		if err != nil {
			continue
		}

		payoutYieldPct, err := fii.PayoutYieldPerCyclePct(fiiType, segment)
		if err != nil {
			continue
		}
		contexts[a.AssetID] = FIIRoundContext{
			BaseValue:         baseValue,
			OutstandingShares: *a.OutstandingShares,
			TargetPriceToBook: targetPriceToBook,
			DividendEffectPct: fiiDividendPriceEffectPct(baseValue, *a.OutstandingShares, payoutYieldPct, dayIndex),
		}
	}
	return contexts
}

// duePaymentsForDay filtra, de todo PendingDividendPayment ainda não pago,
// os que vencem exatamente em newDay — mesmo padrão de
// macroFundamentalsEffectsByCompany filtrando por FundamentalsReportDay ==
// newDay.
func duePaymentsForDay(pending []PendingDividendPayment, newDay int) []PendingDividendPayment {
	due := make([]PendingDividendPayment, 0)
	for _, p := range pending {
		if p.PaymentDay == newDay {
			due = append(due, p)
		}
	}
	return due
}

// Advance calcula o próximo tick a partir do estado persistido — nunca
// regenera a série do zero (ver doc do pacote). selicCfg parametriza a
// reversão à média da Selic (mesmo Config de selic.Series/CalendarSeries,
// Initial ignorado — quem manda a taxa inicial é current.SelicRate); ipcaCfg
// (tarefa M.1) parametriza o IPCA mensal sintético (ipca.MonthlyRate) —
// diferente de selicCfg, não precisa de nenhum estado anterior (IPCA não
// tem memória entre meses, ver doc do pacote ipca), então Advance recalcula
// o mês corrente (ipca.CurrentMonthIndex) e o acumulado de 12 meses
// (ipca.Accumulated12m) inteiramente a partir de dayIndex a cada chamada,
// sem precisar de um IPCAState equivalente a State.SelicRate. seed é
// a seed base da simulação (RNF08: fixa entre reinícios, configurada uma
// vez na composição). No dia de relatório de uma empresa (companies,
// tarefa 3.14), Advance gera sua FundamentalsRecord (fundamentals.NextGrowth
// encadeado a partir de CompanyForFundamentals.LastRevenue) — o efeito de
// preço do resultado divulgado não é mais uma fórmula direta aplicada aqui
// (fundamentals.ReportSurprise/ReportDayPriceEffect, removidas na tarefa
// F.1 do backlog-motor-mercado-realista): o net_revenue recém-divulgado
// (reportedRevenue, abaixo) entra em companyRoundContexts pra TODA empresa,
// e é o arquétipo Fundamentalista (runIntradayRounds, rounds.go) que reage
// a ele via negociação real, comparando o preço justo recém-atualizado
// contra o preço de mercado — nunca um multiplicador aplicado direto na
// cotação. macroEvents são os eventos macro pendentes (tarefa 4.5,
// Repository.ListPendingMacroEvents): seu
// efeito de fundamentos entra no crescimento real do ciclo
// (fundamentals.ActualGrowthWithMacroEffect) no dia de relatório atribuído;
// seu efeito de preço (tarefa E.2, sinal/magnitude por alvo da E.1) não é
// mais um multiplicador direto sobre o GBM (macroPriceMultiplier, removida
// nesta tarefa) — vira CompanyRoundContext.MacroEffectPct
// (macroPriceEffectsByCompany), lido só pelo arquétipo Fundamentalista
// dentro de runIntradayRounds (rounds.go) pra deslocar sua estimativa de
// preço justo, ponderado por KnowledgeLevel. Result.AppliedMacroEventIDs
// sinaliza quais desses eventos já podem virar status = 'aplicado'.
// dividendPayers/pendingDividends alimentam a geração e o pagamento de
// proventos (tarefa 4.9, RF21/lição 2.7): dividendRecordsForCycle gera um
// novo dividend_events por ativo pagador no dia de relatório
// (Result.NewDividends), e duePaymentsForDay filtra os
// PendingDividendPayment cujo pagamento vence exatamente em newDay
// (Result.DuePayments). No mesmo dia de relatório global,
// fiiNetWorthUpdatesForCycle (tarefa G.2) reavalia o NetWorth de cada FII
// tijolo a partir do último valor persistido (dividendPayers, mesma lista
// da linha acima) e da Selic simulada de hoje (fii.NextNetWorth) —
// Result.NetWorthUpdates, um UPDATE por item em SaveTick, não uma linha
// nova de histórico. fiiPortfolioValueUpdatesForCycle (tarefa G.3) faz o
// mesmo pro PortfolioValue de cada FII papel, sem ruído (fii.
// NextPortfolioValue, determinístico por indexador — CDI/IPCA+/Prefixado)
// — Result.PortfolioValueUpdates, mesma natureza de UPDATE. Advance também
// sorteia a cadência intradiária do
// dia (Fase D.1, IntradayRounds) — quantas rodadas de negociação de bot
// newDay terá e em que ponto do expediente simulado cada uma cai
// (Result.IntradayRounds), consumida por Service.Run logo depois (Fase D.2,
// runIntradayRounds, rounds.go) — nenhum outro cálculo deste Advance muda
// de comportamento por causa disso.
func Advance(current State, assets []AssetForPricing, companies []CompanyForFundamentals, macroEvents []MacroEventForApplication, dividendPayers []DividendPayerAsset, pendingDividends []PendingDividendPayment, selicCfg selic.Config, ipcaCfg ipca.Config, seed int64) Result {
	newDay := current.Day + 1
	dayIndex := newDay - 1 // 0-based, mesma convenção de IsCopomMeetingDay/IsReportDay

	// Tarefa M.1: IPCA simulado passa a ser gerado dentro do tick
	// (ipca.MonthlyRate/Accumulated12m/AccumulatedDeviation, memoryless —
	// nenhum dos três precisa de histórico persistido, só de
	// ipca.CurrentMonthIndex derivado de dayIndex). ipcaAccumulatedDeviation
	// alimenta o termo de reação ao IPCA que a tarefa I.1 já deixava pronto
	// em selic.Config.InflationWeight/selic.NextCalendarRate — antes desta
	// tarefa era uma constante 0 (comentário apontava exatamente pra cá).
	ipcaMonthIndex := ipca.CurrentMonthIndex(dayIndex, ipca.DefaultMonthDays)
	ipcaMonthlyRate := ipca.MonthlyRate(ipcaCfg, ipcaMonthIndex)
	ipcaAccumulated12m := ipca.Accumulated12m(ipcaCfg, ipcaMonthIndex)
	ipcaAccumulatedDeviation := ipca.AccumulatedDeviation(ipcaCfg, ipcaMonthIndex)
	newSelicRate := selic.NextCalendarRate(selicCfg, dayIndex, current.SelicRate, ipcaAccumulatedDeviation)

	equityRiskClasses := companyEquityRiskClasses(assets)
	assetToCompany := assetCompanies(assets)
	macroFundamentalsEffects := macroFundamentalsEffectsByCompany(macroEvents, companies, equityRiskClasses, assetToCompany, newDay)
	macroPriceEffects := macroPriceEffectsByCompany(macroEvents, companies, equityRiskClasses, assetToCompany, newDay)

	reportedRevenue := make(map[string]float64, len(companies))
	fundamentalsRecords := make([]FundamentalsRecord, 0, len(companies))
	netIncomeByCompany := make(map[string]float64, len(companies))
	pnPremiumPctByCompany := make(map[string]float64, len(companies))
	for _, c := range companies {
		pnPremiumPctByCompany[c.CompanyID] = c.PnDividendPremiumPct

		if !fundamentals.IsReportDay(dayIndex, c.ReportFrequencyDays) {
			continue
		}

		sector := catalog.Sector(c.Sector)
		cfg := fundamentalsConfig(seed, c.CompanyID, sector, c.BaseGrowthPct)
		cycleIndex := (dayIndex+1)/c.ReportFrequencyDays - 1 // 0-based, um por ciclo de relatório já fechado
		actualGrowth := fundamentals.NextGrowth(cfg, cycleIndex, newSelicRate, selicCfg.Neutral)
		if macroEffect, affected := macroFundamentalsEffects[c.CompanyID]; affected {
			actualGrowth = fundamentals.ActualGrowthWithMacroEffect(actualGrowth, macroEffect)
		}

		baseRevenue := fundamentals.DefaultBaseRevenue
		if c.LastRevenue != nil {
			baseRevenue = *c.LastRevenue
		}
		netRevenue := fundamentals.RevenueSeries(baseRevenue, []float64{actualGrowth})[0]
		financials := fundamentals.DeriveFinancials(sector, c.QualityMultiplier, netRevenue)
		netIncomeByCompany[c.CompanyID] = financials.NetIncome

		reportedRevenue[c.CompanyID] = netRevenue
		fundamentalsRecords = append(fundamentalsRecords, FundamentalsRecord{
			CompanyID:       c.CompanyID,
			NetRevenue:      financials.NetRevenue,
			NetIncome:       financials.NetIncome,
			EBIT:            financials.EBIT,
			NetEquity:       financials.NetEquity,
			GrossDebt:       financials.GrossDebt,
			CashEquivalents: financials.CashEquivalents,
		})
	}

	companyContext := companyRoundContexts(companies, reportedRevenue, seed, newSelicRate, selicCfg.Neutral, macroPriceEffects, dayIndex)

	quotes := make([]Quote, 0, len(assets))
	for _, a := range assets {
		if a.Type == assetTypeAcao || a.Type == assetTypeFII || a.Type == assetTypeETF {
			// Fase D.2 (Ação) / tarefa G.1 (FII) / tarefa R.4 (ETF): nenhum dos
			// três nasce mais de GBM — o preço de fechamento vem da rodada de
			// negociação real (runIntradayRounds, rounds.go, chamada por
			// Service.Run depois de Advance), que anexa sua própria Quote a
			// Result.Quotes antes de SaveTick. ETF ainda sem cotas emitidas fica
			// sem quote nova (preço parado no último conhecido) até a emissão.
			continue
		}

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

		// Tarefa E.2: nenhum multiplicador direto de evento macro sobre o
		// GBM daqui em diante (macroPriceMultiplier, removida) — o
		// sinal/magnitude por alvo (E.1) agora só é lido pelo arquétipo
		// Fundamentalista (macroPriceEffectsByCompany acima,
		// CompanyRoundContext.MacroEffectPct), que só decide sobre Ação/FII
		// (assetTypeAcao/assetTypeFII, já puladas por este loop desde D.2/
		// G.1). Tarefa F.1: mesma coisa pro efeito de preço do resultado
		// divulgado — nenhum multiplicador aplicado direto na cotação (a
		// antiga reportEffects[*a.CompanyID].PriceEffect, removida). Efeito
		// colateral aceito/documentado (mesmo precedente da E.2): ETF (única
		// classe que ainda chega até aqui) fica sem reação a evento macro OU
		// a resultado de relatório até a Fase H trazer o mesmo motor de
		// negociação real pra ele.

		quotes = append(quotes, Quote{AssetID: a.AssetID, Price: price})
	}

	intradayRounds := IntradayRounds(seed, dayIndex)

	appliedMacroEventIDs := make([]string, 0)
	for _, ev := range macroEvents {
		if macroEventDone(ev, newDay) {
			appliedMacroEventIDs = append(appliedMacroEventIDs, ev.ID)
		}
	}

	netWorthUpdates := fiiNetWorthUpdatesForCycle(dividendPayers, dayIndex, newSelicRate, selicCfg.Neutral, seed)
	portfolioValueUpdates := fiiPortfolioValueUpdatesForCycle(dividendPayers, dayIndex, newSelicRate)

	return Result{
		State:                 State{Day: newDay, SelicRate: newSelicRate},
		Quotes:                quotes,
		Fundamentals:          fundamentalsRecords,
		IsCopomDay:            selic.IsCopomMeetingDay(dayIndex),
		IsReportDay:           fundamentals.IsReportDay(dayIndex, fundamentals.DefaultReportFrequencyDays),
		AppliedMacroEventIDs:  appliedMacroEventIDs,
		NewDividends:          dividendRecordsForCycle(dividendPayers, netIncomeByCompany, pnPremiumPctByCompany, dayIndex, newDay),
		DuePayments:           duePaymentsForDay(pendingDividends, newDay),
		NetWorthUpdates:       netWorthUpdates,
		PortfolioValueUpdates: portfolioValueUpdates,
		IntradayRounds:        intradayRounds,
		CompanyContext:        companyContext,
		FIIContext:            fiiRoundContexts(dividendPayers, netWorthUpdates, portfolioValueUpdates, newSelicRate, selicCfg.Neutral, dayIndex),
		IPCAMonthlyRate:       ipcaMonthlyRate,
		IPCAAccumulated12m:    ipcaAccumulated12m,
	}
}
