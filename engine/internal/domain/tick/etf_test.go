package tick

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/etf"
)

type fakeETFFunds struct {
	pending []etf.PendingIssuance
	funds   []etf.FundSnapshot
	err     error
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
}

func (f *fakeETFParticipant) ProvisionParticipantCash(_ context.Context, amount float64) error {
	f.provision = append(f.provision, amount)
	return nil
}

func (f *fakeETFParticipant) ParticipantHoldings(_ context.Context, assetIDs []string) (map[string]int64, error) {
	held := map[string]int64{}
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
	svc.WithETF(&fakeETFFunds{pending: pending}, participant, exchanger)
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
	svc.WithETF(&fakeETFFunds{funds: []etf.FundSnapshot{
		{ETFAssetID: "etf1", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 600}, {AssetID: "b", Quantity: 400}}},
		{ETFAssetID: "etf2", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "sem-preco", Quantity: 1}}},
		{ETFAssetID: "etf3", Shares: 1000, Holdings: []etf.FundHolding{{AssetID: "a", Quantity: 1}}},
	}}, nil, nil)

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
