package tick

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/coverage"
	"tcc-investimentos/engine/internal/domain/etf"
)

type fakeETFFunds struct {
	pending    []etf.PendingIssuance
	funds      []etf.FundSnapshot
	candidates []etf.MarketMakingCandidate
	err        error
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

	got, err := svc.closingETFNAVs(context.Background(),
		map[string]float64{"a": 10, "b": 15},
		map[string]float64{"etf1": 13.2, "etf2": 1})
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
}

func TestClosingETFNAVs_SemWithETF(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	got, err := svc.closingETFNAVs(context.Background(), nil, nil)
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
