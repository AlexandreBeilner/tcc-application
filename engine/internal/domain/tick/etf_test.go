package tick

import (
	"context"
	"errors"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/etf"
	"tcc-investimentos/engine/internal/domain/orderbook"
)

type fakeETFFunds struct {
	pending    []etf.PendingIssuance
	funds      []etf.FundSnapshot
	candidates []etf.MarketMakingCandidate
	indexes    map[string]float64
	// paidDividends (R.11b): provento por ação que os constituintes pagaram no dia anterior.
	paidDividends map[string]float64
	rebalanced    map[string]int
	holders       map[string][]PositionHolder
	err           error
}

func (f *fakeETFFunds) ListShareHolders(context.Context, []string) (map[string][]PositionHolder, error) {
	return f.holders, f.err
}

func (f *fakeETFFunds) MarkRebalanced(_ context.Context, etfAssetID string, day int) error {
	if f.rebalanced == nil {
		f.rebalanced = map[string]int{}
	}
	f.rebalanced[etfAssetID] = day
	return f.err
}

func (f *fakeETFFunds) LatestIndexValues(context.Context) (map[string]float64, error) {
	return f.indexes, f.err
}

func (f *fakeETFFunds) ConstituentDividendsPaid(context.Context, int, []string) (map[string]float64, error) {
	return f.paidDividends, f.err
}

func (f *fakeETFFunds) ListMarketMakingCandidates(context.Context) ([]etf.MarketMakingCandidate, error) {
	return f.candidates, f.err
}

func (f *fakeETFFunds) ListPendingIssuances(context.Context) ([]etf.PendingIssuance, error) {
	return f.pending, f.err
}

func (f *fakeETFFunds) ListFunds(context.Context) ([]etf.FundSnapshot, error) {
	return f.funds, f.err
}

// fakeETFParticipant devolve como "posição" do participante exatamente o que o
// fakeOrderSubmitter recebeu de ordem de compra, limitado por caps (simula o
// book absorvendo só parte do alvo).
type fakeETFParticipant struct {
	submitter *fakeOrderSubmitter
	caps      map[string]int64
	provision []float64
	// provisionTo registra a conta de cada provisionamento (mesma ordem de provision).
	provisionTo []string
	// heldETF é o que o participante detém do ETF (cobertura, R.4).
	heldETF map[string]int64
}

func (f *fakeETFParticipant) ProvisionCash(_ context.Context, accountID string, amount float64) error {
	f.provision = append(f.provision, amount)
	f.provisionTo = append(f.provisionTo, accountID)
	return nil
}

func (f *fakeETFParticipant) ParticipantCash(context.Context) (float64, error) { return 0, nil }

func (f *fakeETFParticipant) ParticipantHoldings(_ context.Context, assetIDs []string) (map[string]int64, error) {
	held := map[string]int64{}
	for id, q := range f.heldETF {
		held[id] = q
	}
	if f.submitter == nil {
		return held, nil
	}
	for _, s := range f.submitter.submitted {
		held[s.req.AssetID] += int64(s.req.Quantity)
	}
	for id, cap := range f.caps {
		if held[id] > cap {
			held[id] = cap
		}
	}
	return held, nil
}

type fakeShareExchanger struct {
	created []etf.ShareExchange
	err     error
}

func (f *fakeShareExchanger) Create(_ context.Context, e etf.ShareExchange) error {
	if f.err != nil {
		return f.err
	}
	f.created = append(f.created, e)
	return nil
}

func (f *fakeShareExchanger) Redeem(context.Context, etf.ShareExchange) error { return nil }

func assetPtr(s string) *string { return &s }

func pendingSINT() etf.PendingIssuance {
	return etf.PendingIssuance{
		ETFAssetID:    "etf1",
		FundAccountID: "fund1",
		Holdings: []etf.Holding{
			{ConstituentName: "A", AssetID: assetPtr("a"), WeightPct: 60},
			{ConstituentName: "B", AssetID: assetPtr("b"), WeightPct: 40},
		},
	}
}

func etfTestRun() *roundRun {
	return &roundRun{
		equities:        map[string]*equityRoundState{"a": {Price: 100}, "b": {Price: 100}},
		volumeByAssetID: map[string]int{},
	}
}

func etfTestService(pending []etf.PendingIssuance, caps map[string]int64) (*Service, *fakeETFParticipant, *fakeShareExchanger) {
	svc := newTestService(&fakeRepository{})
	submitter := &fakeOrderSubmitter{fillPrice: 100}
	svc.orderSubmitter = submitter
	participant := &fakeETFParticipant{submitter: submitter, caps: caps}
	exchanger := &fakeShareExchanger{}
	svc.WithETF(ETFDeps{Funds: &fakeETFFunds{pending: pending}, Participant: participant, Exchanger: exchanger})
	return svc, participant, exchanger
}

func TestIssueETFs_EmissaoCompletaCriaTodasAsCotasDoAlvo(t *testing.T) {
	svc, participant, exchanger := etfTestService([]etf.PendingIssuance{pendingSINT()}, nil)
	run := etfTestRun()

	if err := svc.issueETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(participant.provision) != 1 || participant.provision[0] != etf.InitialFundValue*etf.ParticipantCashMargin {
		t.Errorf("caixa provisionado = %v, want [%v]", participant.provision, etf.InitialFundValue*etf.ParticipantCashMargin)
	}
	if len(exchanger.created) != 1 {
		t.Fatalf("criações = %d, want 1", len(exchanger.created))
	}
	got := exchanger.created[0]
	if got.Shares != 10000 || got.ParticipantAccountID != etf.AuthorizedParticipantAccountID || got.FundAccountID != "fund1" {
		t.Errorf("troca = %+v, want 10000 cotas do participante pro fundo1", got)
	}
	if len(got.Basket) != 2 || got.Basket[0].Quantity != 6000 || got.Basket[1].Quantity != 4000 {
		t.Errorf("cesta = %+v, want 6000 de a e 4000 de b", got.Basket)
	}
	if run.volumeByAssetID["a"] != 6000 || run.volumeByAssetID["b"] != 4000 {
		t.Errorf("volume = %v, want a compra da cesta contada no volume do dia", run.volumeByAssetID)
	}
}

func TestIssueETFs_BookQueAbsorveuSoParteLimitaAsCotas(t *testing.T) {
	svc, _, exchanger := etfTestService([]etf.PendingIssuance{pendingSINT()}, map[string]int64{"b": 2000})

	if err := svc.issueETFs(context.Background(), etfTestRun()); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(exchanger.created) != 1 || exchanger.created[0].Shares != 5000 {
		t.Fatalf("criações = %+v, want 1 com 5000 cotas (b limita pela metade)", exchanger.created)
	}
}

func TestIssueETFs_SemLiquidezAdiaSemCriarNemAbortar(t *testing.T) {
	svc, _, exchanger := etfTestService([]etf.PendingIssuance{pendingSINT()}, map[string]int64{"a": 0, "b": 0})

	if err := svc.issueETFs(context.Background(), etfTestRun()); err != nil {
		t.Fatalf("err = %v, want nil (adia, não aborta)", err)
	}
	if len(exchanger.created) != 0 {
		t.Errorf("criações = %d, want 0", len(exchanger.created))
	}
}

func TestIssueETFs_ConstituenteForaDoUniversoAdiaSemProvisionarCaixa(t *testing.T) {
	svc, participant, exchanger := etfTestService([]etf.PendingIssuance{pendingSINT()}, nil)
	run := etfTestRun()
	delete(run.equities, "b")

	if err := svc.issueETFs(context.Background(), run); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(participant.provision) != 0 || len(exchanger.created) != 0 {
		t.Errorf("caixa = %v, criações = %d, want nada", participant.provision, len(exchanger.created))
	}
}

func TestIssueETFs_FalhaDoExchangerNaoAbortaOTick(t *testing.T) {
	svc, _, exchanger := etfTestService([]etf.PendingIssuance{pendingSINT()}, nil)
	exchanger.err = errors.New("float violado")

	if err := svc.issueETFs(context.Background(), etfTestRun()); err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestIssueETFs_SemWithETFNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	if err := svc.issueETFs(context.Background(), etfTestRun()); err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestClosingETFNAVs(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.WithETF(ETFDeps{Funds: &fakeETFFunds{funds: []etf.FundSnapshot{
		{ETFAssetID: "etf1", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 600}, {AssetID: "b", Quantity: 400}}},
		{ETFAssetID: "etf2", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "sem-preco", Quantity: 1}}},
		{ETFAssetID: "etf3", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 1}}},
	}}})

	got, _, err := svc.closingETFNAVs(context.Background(),
		map[string]float64{"a": 10, "b": 15},
		map[string]float64{"etf1": 13.2, "etf2": 1},
		map[string]float64{"a": 10, "b": 15}, false, 15, 0)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	// etf2 sem preço de constituinte e etf3 sem preço de fechamento ficam fora.
	if len(got) != 1 || got[0].ETFAssetID != "etf1" {
		t.Fatalf("entradas = %+v, want só etf1", got)
	}
	if got[0].NAV != 12 || got[0].ClosePrice != 13.2 || got[0].PremiumPct < 9.99 || got[0].PremiumPct > 10.01 {
		t.Errorf("entrada = %+v, want NAV 12, preço 13,2, ágio ~10%%", got[0])
	}
	// primeiro dia do fundo: o índice teórico nasce igual ao NAV, sem desvio
	if got[0].IndexValue != 12 || got[0].TrackingErrorPct != 0 {
		t.Errorf("índice = %v, tracking = %v, want 12 e 0 no primeiro dia", got[0].IndexValue, got[0].TrackingErrorPct)
	}
}

func TestClosingETFNAVs_IndiceDeRetornoTotal(t *testing.T) {
	// Os constituintes pagaram provento no dia anterior, então o índice sobe o
	// retorno de dividendo; sem ele o tracking error trataria o caixa do fundo como
	// ganho sobre o índice (R.11b). Preços parados, pesos 60/40 pelo valor.
	funds := &fakeETFFunds{
		funds: []etf.FundSnapshot{{
			ETFAssetID: "etf1", Shares: 1000, Cash: 1000,
			Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 600}, {AssetID: "b", Quantity: 400}},
			Targets:  []etf.TargetWeight{{AssetID: "a", WeightPct: 50}, {AssetID: "b", WeightPct: 50}},
		}},
		indexes:       map[string]float64{"etf1": 100},
		paidDividends: map[string]float64{"a": 1},
	}
	svc := newTestService(&fakeRepository{})
	svc.WithETF(ETFDeps{Funds: funds})

	prices := map[string]float64{"a": 10, "b": 10}
	got, _, err := svc.closingETFNAVs(context.Background(), prices, map[string]float64{"etf1": 10}, prices, false, 15, 0)
	if err != nil || len(got) != 1 {
		t.Fatalf("entradas = %+v, err = %v", got, err)
	}
	// a rende 10% de dividendo, b 0%, pesos iguais: índice 100 -> 105
	if math.Abs(got[0].IndexValue-105) > 1e-9 {
		t.Errorf("índice = %v, want 105", got[0].IndexValue)
	}
}

func TestClosingETFNAVs_SemWithETF(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	got, _, err := svc.closingETFNAVs(context.Background(), nil, nil, nil, false, 15, 0)
	if err != nil || got != nil {
		t.Errorf("got = %v, err = %v, want nil, nil", got, err)
	}
}

type fakeETFCoverage struct {
	inputs []coverage.Input
	mmID   string
	err    error
}

func (f *fakeETFCoverage) EnsureCoverage(_ context.Context, in coverage.Input) (coverage.Result, error) {
	f.inputs = append(f.inputs, in)
	return coverage.Result{MarketMakerID: f.mmID, Provisioned: true}, f.err
}

type fakeShareTransferer struct {
	transfers []etf.ShareTransfer
	err       error
}

func (f *fakeShareTransferer) Transfer(_ context.Context, t etf.ShareTransfer) error {
	if f.err != nil {
		return f.err
	}
	f.transfers = append(f.transfers, t)
	return nil
}

func coverTestService(candidates []etf.MarketMakingCandidate, heldETF map[string]int64) (*Service, *fakeETFParticipant, *fakeETFCoverage, *fakeShareTransferer) {
	svc := newTestService(&fakeRepository{})
	participant := &fakeETFParticipant{heldETF: heldETF}
	cov := &fakeETFCoverage{mmID: "mm1"}
	transferer := &fakeShareTransferer{}
	svc.WithETF(ETFDeps{Funds: &fakeETFFunds{candidates: candidates}, Participant: participant, Transferer: transferer, Coverage: cov})
	return svc, participant, cov, transferer
}

func TestCoverETFs_CobreEEntregaAsCotasDoParticipanteAoMarketMaker(t *testing.T) {
	svc, participant, cov, transferer := coverTestService([]etf.MarketMakingCandidate{{ETFAssetID: "etf1", Shares: 10000}}, map[string]int64{"etf1": 10000})
	equities := map[string]*equityRoundState{"etf1": {Price: 99.5}}

	if err := svc.coverETFs(context.Background(), equities); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(cov.inputs) != 1 || cov.inputs[0].AssetID != "etf1" || cov.inputs[0].MarketMakerShares != 0 || cov.inputs[0].OutstandingShares != 10000 {
		t.Errorf("cobertura = %+v, want só cobertura (sem cotas novas) do etf1", cov.inputs)
	}
	if len(transferer.transfers) != 1 {
		t.Fatalf("transferências = %d, want 1", len(transferer.transfers))
	}
	got := transferer.transfers[0]
	if got.FromAccountID != etf.AuthorizedParticipantAccountID || got.ToAccountID != "mm1" || got.Quantity != 10000 || got.Price != 99.5 {
		t.Errorf("transferência = %+v, want 10000 cotas do participante pro mm1 a 99,5", got)
	}
	// Caixa do Market Maker: 2x o valor da posição (bot.InitialCash).
	if len(participant.provision) != 1 || participant.provisionTo[0] != "mm1" || participant.provision[0] != 2*10000*99.5 {
		t.Errorf("caixa = %v para %v, want 1.990.000 pro mm1", participant.provision, participant.provisionTo)
	}
}

func TestCoverETFs_ParticipanteSemCotasSoGravaACobertura(t *testing.T) {
	svc, participant, cov, transferer := coverTestService([]etf.MarketMakingCandidate{{ETFAssetID: "etf1", Shares: 10000}}, nil)

	if err := svc.coverETFs(context.Background(), map[string]*equityRoundState{"etf1": {Price: 100}}); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(cov.inputs) != 1 || len(transferer.transfers) != 0 || len(participant.provision) != 0 {
		t.Errorf("cobertura=%d transferências=%d caixa=%d, want 1/0/0", len(cov.inputs), len(transferer.transfers), len(participant.provision))
	}
}

func TestCoverETFs_ETFForaDoUniversoFicaParaOProximoTick(t *testing.T) {
	svc, _, cov, _ := coverTestService([]etf.MarketMakingCandidate{{ETFAssetID: "etf1", Shares: 10000}}, map[string]int64{"etf1": 10000})

	if err := svc.coverETFs(context.Background(), map[string]*equityRoundState{}); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(cov.inputs) != 0 {
		t.Errorf("cobertura = %v, want nenhuma", cov.inputs)
	}
}

func TestCoverETFs_PropagaErroDeInfraestrutura(t *testing.T) {
	svc, _, cov, _ := coverTestService([]etf.MarketMakingCandidate{{ETFAssetID: "etf1", Shares: 1}}, nil)
	cov.err = errors.New("banco fora")

	if err := svc.coverETFs(context.Background(), map[string]*equityRoundState{"etf1": {Price: 100}}); err == nil {
		t.Error("err = nil, want o erro de EnsureCoverage")
	}
}

func TestCoverETFs_SemWithETFNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	if err := svc.coverETFs(context.Background(), nil); err != nil {
		t.Errorf("err = %v, want nil", err)
	}
}

func TestBuildEquityUniverse_ETFComCotasEntraESemCotasFicaDeFora(t *testing.T) {
	withShares, without := int64(10000), int64(0)
	price := 99.0
	assets := []AssetForPricing{
		{AssetID: "etf-emitido", Type: assetTypeETF, LastPrice: &price, OutstandingShares: &withShares},
		{AssetID: "etf-novo", Type: assetTypeETF, LastPrice: &price, OutstandingShares: &without},
		{AssetID: "etf-sem-float", Type: assetTypeETF, LastPrice: &price},
	}

	equities, universe := buildEquityUniverse(assets)
	if len(universe) != 1 || universe[0].AssetID != "etf-emitido" || universe[0].Type != "etf" {
		t.Fatalf("universo = %+v, want só o ETF emitido, com Type etf", universe)
	}
	if equities["etf-emitido"].CompanyID != nil || universe[0].MarketValue != 10000*99.0 {
		t.Errorf("estado = %+v, valor de mercado = %v, want sem empresa e cotas x preço", equities["etf-emitido"], universe[0].MarketValue)
	}
}

func TestAdvance_ETFNaoGeraCotacaoPorGBM(t *testing.T) {
	price := 95.0
	assets := []AssetForPricing{{AssetID: "etf1", Type: assetTypeETF, LastPrice: &price}}

	result := Advance(State{Day: 3, SelicRate: 10}, assets, nil, nil, nil, nil, testSelicConfigService(), testIPCAConfig(), 1)
	if len(result.Quotes) != 0 {
		t.Errorf("quotes = %+v, want nenhuma (ETF forma preço por negociação, não GBM)", result.Quotes)
	}
}

// R.5: o Market Maker cota o ETF em torno do iNAV (posições do fundo x preços
// correntes dos constituintes), não do último preço; a ação continua cotando
// em torno do último preço.
func TestRunIntradayRounds_MarketMakerCotaETFEmTornoDoINAV(t *testing.T) {
	const userID = "22222222-2222-2222-2222-222222222222"
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: userID, Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1", "etf1"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 10_000_000, positions: map[string]int{"a1": 10_000, "etf1": 1_000}}
	submitter := &fakeOrderSubmitter{}
	svc.orderSubmitter = submitter
	svc.orderLifecycle = &fakeOrderLifecycleManager{}
	// iNAV = (800 x 100 + 40.000 de caixa) / 1.000 cotas = 120.
	svc.WithETF(ETFDeps{Funds: &fakeETFFunds{funds: []etf.FundSnapshot{
		{ETFAssetID: "etf1", Shares: 1000, Cash: 40000, Holdings: []etf.FundHolding{{AssetID: "a1", Quantity: 800}}},
	}}})

	shares, etfPrice := int64(1000), 90.0
	assets := []AssetForPricing{
		acaoAsset("a1", 100),
		{AssetID: "etf1", Type: assetTypeETF, LastPrice: &etfPrice, OutstandingShares: &shares},
	}
	if _, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, RoundContext{}, 10, 10); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	quotes := map[string]map[orderbook.Side]float64{}
	for _, s := range submitter.submitted {
		if s.req.UserID != userID {
			continue
		}
		if quotes[s.req.AssetID] == nil {
			quotes[s.req.AssetID] = map[orderbook.Side]float64{}
		}
		quotes[s.req.AssetID][s.req.Side] = s.req.Price
	}
	approx := func(got, want float64) bool { return math.Abs(got-want) < 1e-6 }
	// Spread do personality de teste: 2% (meia largura de 1%).
	if !approx(quotes["etf1"][orderbook.SideBuy], 120*0.99) || !approx(quotes["etf1"][orderbook.SideSell], 120*1.01) {
		t.Errorf("cotação do ETF = %v, want compra 118,8 e venda 121,2 (em torno do iNAV 120, não do último preço 90)", quotes["etf1"])
	}
	if !approx(quotes["a1"][orderbook.SideBuy], 100*0.99) || !approx(quotes["a1"][orderbook.SideSell], 100*1.01) {
		t.Errorf("cotação da ação = %v, want compra 99 e venda 101 (em torno do último preço)", quotes["a1"])
	}
}

func TestRoundRunINAV(t *testing.T) {
	run := &roundRun{
		equities: map[string]*equityRoundState{"a": {Price: 10}, "b": {Price: 20}},
		etfFunds: map[string]etf.FundSnapshot{
			"etf":       {ETFAssetID: "etf", Shares: 100, Cash: 100, Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 100}, {AssetID: "b", Quantity: 50}}},
			"sem-preco": {ETFAssetID: "sem-preco", Shares: 100, Holdings: []etf.FundHolding{{AssetID: "fora", Quantity: 1}}},
		},
	}

	if got := run.inav("etf"); got == nil || math.Abs(*got-21) > 1e-9 {
		t.Errorf("iNAV = %v, want 21 ((1000 + 1000 + 100) / 100)", got)
	}
	run.equities["a"].Price = 12 // um fill mexeu no constituinte: o iNAV acompanha
	if got := run.inav("etf"); got == nil || math.Abs(*got-23) > 1e-9 {
		t.Errorf("iNAV depois do fill = %v, want 23", got)
	}
	if got := run.inav("sem-preco"); got != nil {
		t.Errorf("iNAV com constituinte fora do universo = %v, want nil", *got)
	}
	if got := run.inav("acao"); got != nil {
		t.Errorf("iNAV de ativo que não é ETF = %v, want nil", *got)
	}
}
