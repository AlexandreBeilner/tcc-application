package tick

import (
	"context"
	"fmt"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/paymentschedule"
	"tcc-investimentos/engine/internal/domain/selic"
)

func TestAdvance_ProventoDeclaradoAntesDaExAdiaOSnapshot(t *testing.T) {
	c := payingCompany(catalog.DividendQuarterly, 7)
	report := paymentschedule.ReportDay(91, 7, 0)
	shares := int64(1000)
	id := c.CompanyID
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &id, OutstandingShares: &shares, Holders: []PositionHolder{{UserID: "u1", Quantity: 5}}}
	cfg := selic.Config{Neutral: 10, Seed: 1}

	got := Advance(State{Day: report - 1, SelicRate: 10}, nil, []CompanyForFundamentals{c}, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1).NewDividends

	if len(got) != 1 || !got[0].SnapshotPending || got[0].ExDay <= report {
		t.Fatalf("declaração com data-ex futura deveria adiar o snapshot: %+v", got)
	}
}

func TestService_Run_DiaSemProventoNaoLePosicaoDeNinguem(t *testing.T) {
	repo := &fakeRepository{state: State{Day: 20, SelicRate: 10}, stateFound: true}
	for i := 0; i < 1000; i++ {
		shares := int64(1000)
		repo.dividendPayers = append(repo.dividendPayers, DividendPayerAsset{AssetID: fmt.Sprintf("a%d", i), Type: "acao", OutstandingShares: &shares})
	}

	if _, err := newTestService(repo).Run(context.Background()); err != nil {
		t.Fatal(err)
	}
	if len(repo.holderCalls) != 0 {
		t.Errorf("dia sem data-ex não deveria consultar posições, consultou %d vezes", len(repo.holderCalls))
	}
}

func TestService_Run_SnapshotNaDataExSoLeOsAtivosDoProvento(t *testing.T) {
	repo := &fakeRepository{
		state: State{Day: 20, SelicRate: 10}, stateFound: true,
		awaitingSnapshots: []DividendAwaitingSnapshot{{EventID: "e1", AssetID: "a7"}},
		holders:           map[string][]PositionHolder{"a7": {{UserID: "u1", Quantity: 3}}},
	}
	for i := 0; i < 1000; i++ {
		shares := int64(1000)
		repo.dividendPayers = append(repo.dividendPayers, DividendPayerAsset{AssetID: fmt.Sprintf("a%d", i), Type: "acao", OutstandingShares: &shares})
	}

	result, err := newTestService(repo).Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.holderCalls) != 1 || len(repo.holderCalls[0]) != 1 || repo.holderCalls[0][0] != "a7" {
		t.Errorf("deveria ler a posição só de a7 em uma consulta, veio %v", repo.holderCalls)
	}
	if len(result.Snapshots) != 1 || result.Snapshots[0].EventID != "e1" || len(result.Snapshots[0].Recipients) != 1 {
		t.Errorf("Snapshots = %+v", result.Snapshots)
	}
}

func TestService_Run_ProventoLegadoRecebeOsElegiveisDoDia(t *testing.T) {
	netWorth := 100_000_000.0
	shares := int64(1_000_000)
	fiiType := "tijolo"
	repo := &fakeRepository{
		state: State{Day: 29, SelicRate: 10}, stateFound: true,
		dividendPayers: []DividendPayerAsset{{AssetID: "fii1", Type: "fii", NetWorth: &netWorth, OutstandingShares: &shares, FIIType: &fiiType}},
		holders:        map[string][]PositionHolder{"fii1": {{UserID: "u1", Quantity: 10}}},
	}

	result, err := newTestService(repo).Run(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(result.NewDividends) != 1 || len(result.NewDividends[0].Recipients) != 1 {
		t.Errorf("provento legado deveria sair com o snapshot do dia: %+v", result.NewDividends)
	}
}

// O payout é por empresa (MO.6.10): duas empresas com o mesmo lucro e as mesmas ações pagam
// valores diferentes por ação, e a empresa sem payout gravado paga como antes (50%).
func TestDividendRecordsForCycle_PayoutPorEmpresa(t *testing.T) {
	shares := int64(1_000)
	payers := []DividendPayerAsset{}
	payouts := map[string]equityPayout{}
	payoutPct := map[string]float64{"baixo": 20, "alto": 90, "legado": 0}
	for id := range payoutPct {
		cid := id
		payers = append(payers, DividendPayerAsset{AssetID: "a-" + id, Type: "acao", CompanyID: &cid, OutstandingShares: &shares})
		payouts[id] = equityPayout{PoolNetIncome: 100_000, ExDay: 101, PayDay: 106}
	}
	got := map[string]float64{}
	for _, r := range dividendRecordsForCycle(payers, payouts, nil, payoutPct, 100, 101) {
		got[r.AssetID] = r.ValuePerShare
	}
	want := map[string]float64{"a-baixo": 20, "a-alto": 90, "a-legado": 50}
	for asset, v := range want {
		if math.Abs(got[asset]-v) > 1e-9 {
			t.Errorf("%s: dividendo por ação = %v, esperado %v", asset, got[asset], v)
		}
	}
}

func BenchmarkDividendRecordsForCycle_1000Ativos(b *testing.B) {
	payers := make([]DividendPayerAsset, 0, 1000)
	payouts := map[string]equityPayout{}
	for i := 0; i < 1000; i++ {
		shares := int64(1000)
		id := fmt.Sprintf("c%d", i)
		payers = append(payers, DividendPayerAsset{AssetID: fmt.Sprintf("a%d", i), Type: "acao", CompanyID: &id, OutstandingShares: &shares})
	}
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		dividendRecordsForCycle(payers, payouts, nil, nil, 100, 101)
	}
}
