package tick

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/corporategovernance"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/paymentschedule"
	"tcc-investimentos/engine/internal/domain/selic"
)

func advanceOn(c CompanyForFundamentals, day int) Result {
	shares := int64(1000)
	id := c.CompanyID
	payer := DividendPayerAsset{AssetID: "a1", Type: "acao", CompanyID: &id, OutstandingShares: &shares}
	cfg := selic.Config{Neutral: 10, Seed: 1}
	return Advance(State{Day: day - 1, SelicRate: 10}, nil, []CompanyForFundamentals{c}, nil, []DividendPayerAsset{payer}, nil, cfg, testIPCAConfig(), 1)
}

// No dia do balanço, a empresa com a declaração retida não paga: o lucro do pool fica guardado
// para a assembleia de destinação do lucro, e o balanço em si continua saindo normalmente.
func TestAdvance_DeclaracaoRetidaNaoPagaNoDiaDoBalanco(t *testing.T) {
	c := payingCompany(catalog.DividendQuarterly, 0)
	c.HoldDeclaration = true
	res := advanceOn(c, 91)

	if len(res.NewDividends) != 0 {
		t.Fatalf("a declaração retida não gera provento: %+v", res.NewDividends)
	}
	if len(res.HeldDeclarations) != 1 {
		t.Fatalf("retidas = %+v", res.HeldDeclarations)
	}
	held := res.HeldDeclarations[0]
	if held.CompanyID != "c1" || held.CycleIndex != 0 || held.ReportDay != 91 || held.PoolNetIncome <= 0 {
		t.Errorf("retida = %+v", held)
	}
	if len(res.Fundamentals) != 1 {
		t.Errorf("o balanço sai mesmo com o dividendo retido: %d", len(res.Fundamentals))
	}

	// O mesmo balanço sem retenção paga, com o mesmo lucro de pool.
	c.HoldDeclaration = false
	paid := advanceOn(c, 91)
	if len(paid.NewDividends) != 1 || len(paid.HeldDeclarations) != 0 {
		t.Fatalf("sem retenção paga como sempre: %+v", paid)
	}
}

// Balanço que não paga (política semestral) não retém nada: não há dividendo a decidir.
func TestAdvance_BalancoQueNaoPagaNaoRetem(t *testing.T) {
	c := payingCompany(catalog.DividendSemiannual, 0)
	c.HoldDeclaration = true
	if res := advanceOn(c, 91); len(res.HeldDeclarations) != 0 || len(res.NewDividends) != 0 {
		t.Errorf("1º balanço do semestral não paga: %+v", res)
	}
	if res := advanceOn(c, 182); len(res.HeldDeclarations) != 1 {
		t.Errorf("2º balanço paga e portanto retém: %+v", res.HeldDeclarations)
	}
}

// Liberada, a declaração vira provento com as datas contadas da liberação, não do balanço, e o
// pool é o lucro do balanço retido (o mais recente já persistido), não o lucro de hoje.
func TestAdvance_LiberacaoPagaComDatasDaLiberacao(t *testing.T) {
	c := payingCompany(catalog.DividendQuarterly, 0, 100_000)
	release := 130 // balanço do dia 91 liberado 39 dias depois
	c.Release = &DeclarationRelease{ID: "decl-1", CycleIndex: 0, Reason: "decision"}
	res := advanceOn(c, release)

	if len(res.NewDividends) != 1 || len(res.ReleasedDeclarations) != 1 {
		t.Fatalf("provento = %+v, liberadas = %+v", res.NewDividends, res.ReleasedDeclarations)
	}
	wantEx, wantPay := paymentschedule.ReleaseCycle(release, true, c.ComLagDays, c.PaymentLagDays)
	rec := res.NewDividends[0]
	if rec.ExDay != wantEx || rec.PaymentDay != wantPay || rec.ExDay <= 91+39-1 {
		t.Errorf("ex = %d, pagamento = %d, esperado %d e %d", rec.ExDay, rec.PaymentDay, wantEx, wantPay)
	}
	if rel := res.ReleasedDeclarations[0]; rel.ID != "decl-1" || rel.ExDay != wantEx || rel.Reason != "decision" {
		t.Errorf("liberada = %+v", rel)
	}
	// Pool de 100.000 e 1.000 ações, payout padrão de 50%: 50 por ação.
	if rec.ValuePerShare != 50 {
		t.Errorf("valor por ação = %v, esperado 50 (pool guardado x payout padrão)", rec.ValuePerShare)
	}
	// Com payout decidido de 20%, a mesma declaração paga 20 por ação.
	c.PayoutRatioPct = 20
	if v := advanceOn(c, release).NewDividends[0].ValuePerShare; v != 20 {
		t.Errorf("valor por ação com payout 20%% = %v, esperado 20", v)
	}
}

// Empresa sem agenda atribuída segue o legado também na liberação: ex na própria liberação.
func TestAdvance_LiberacaoSemAgendaSegueOLegado(t *testing.T) {
	c := scheduledCompany("c1", 0)
	c.PriorNetIncomes = []float64{10_000}
	c.Release = &DeclarationRelease{ID: "decl-1", CycleIndex: 0}
	rec := advanceOn(c, 120).NewDividends[0]
	if rec.ExDay != 120 || rec.PaymentDay != 120+catalog.DefaultPaymentLagDays {
		t.Errorf("ex = %d, pagamento = %d", rec.ExDay, rec.PaymentDay)
	}
}

// O efeito de preço do provento acompanha a data-ex de verdade: ciclo retido não tem efeito, e
// o liberado com atraso conta a banda da data-ex real, não da do calendário.
func TestDividendPriceEffectPct_DeclaracaoRetidaELiberadaComAtraso(t *testing.T) {
	fin := fundamentals.DeriveFinancials(catalog.SectorMineracao, 1, fundamentals.DefaultBaseRevenue)
	c := payingCompany(catalog.DividendQuarterly, 0)
	scheduled := paymentschedule.EquityCycleAt(91, 0, 0, true, c.DividendPolicy, c.ComLagDays, c.PaymentLagDays, 0)
	at := func(c CompanyForFundamentals, day int) float64 { return dividendPriceEffectPct(fin, day-1, c) }

	if at(c, scheduled.Ex) >= 0 {
		t.Fatal("sem retenção o efeito começa na data-ex do calendário")
	}

	held := c
	held.HeldCycles = []int{0}
	if at(held, scheduled.Ex) != 0 || at(held, scheduled.Ex+3) != 0 {
		t.Error("declaração retida ainda não pagou: nenhum efeito de preço")
	}

	late := c
	lateEx := scheduled.Ex + 40
	late.DeclaredExByCycle = map[int]int{0: lateEx}
	if at(late, scheduled.Ex+3) != 0 {
		t.Error("a data-ex do calendário já passou, mas o provento só sai depois: sem efeito")
	}
	if at(late, lateEx-1) != 0 || at(late, lateEx) >= 0 {
		t.Error("o efeito começa na data-ex real")
	}
	if at(late, lateEx+dividendPriceEffectBandDays) != 0 {
		t.Error("e termina depois da banda")
	}
}

type fakeDeclarations struct {
	policy corporategovernance.HoldPolicy
	orders []corporategovernance.ReleaseOrder
}

func (f fakeDeclarations) HoldPolicy(_ context.Context) (corporategovernance.HoldPolicy, error) {
	return f.policy, nil
}
func (f fakeDeclarations) ReleaseDue(_ context.Context, _ int) ([]corporategovernance.ReleaseOrder, error) {
	return f.orders, nil
}

// O serviço decide a retenção por empresa (acionista, cooldown, declaração já retida) e entrega
// a ordem de liberação à empresa certa.
func TestService_AplicaPoliticaDeDeclaracao(t *testing.T) {
	last := 100
	companies := []CompanyForFundamentals{
		{CompanyID: "livre", UserShareholders: true},
		{CompanyID: "sem-acionista"},
		{CompanyID: "em-cooldown", UserShareholders: true, LastPayoutStartDay: &last},
		{CompanyID: "ja-retida", UserShareholders: true, HasHeldDeclaration: true},
		{CompanyID: "liberando", UserShareholders: true, HasHeldDeclaration: true},
	}
	svc := &Service{declarations: fakeDeclarations{
		policy: corporategovernance.HoldPolicy{Enabled: true, PayoutCooldownDays: 90, SafetyDays: 60},
		orders: []corporategovernance.ReleaseOrder{{ID: "d1", CompanyID: "liberando", CycleIndex: 2, PoolNetIncome: 7, Reason: corporategovernance.ReleaseExpired}},
	}}
	svc.applyDeclarationPolicy(context.Background(), companies, 150)

	hold := map[string]bool{}
	for _, c := range companies {
		hold[c.CompanyID] = c.HoldDeclaration
	}
	want := map[string]bool{"livre": true, "sem-acionista": false, "em-cooldown": false, "ja-retida": false, "liberando": false}
	for id, w := range want {
		if hold[id] != w {
			t.Errorf("%s: retém = %v, esperado %v", id, hold[id], w)
		}
	}
	if r := companies[4].Release; r == nil || r.ID != "d1" || r.CycleIndex != 2 || r.PoolNetIncome != 7 || r.Reason != "expired" {
		t.Errorf("liberação da empresa certa = %+v", r)
	}
	if companies[0].Release != nil {
		t.Error("só a empresa com ordem recebe liberação")
	}

	// Sem DeclarationStep (governança antiga) nada é retido nem liberado.
	plain := []CompanyForFundamentals{{CompanyID: "x", UserShareholders: true}}
	(&Service{}).applyDeclarationPolicy(context.Background(), plain, 150)
	if plain[0].HoldDeclaration || plain[0].Release != nil {
		t.Error("sem governança de declaração nada muda")
	}
}

// A política de dividendo trocada pela assembleia vale já na declaração liberada: o pool soma
// os ciclos da política nova, e o balanço que a política nova não paga fica sem provento agora
// (o lucro entra no pool do próximo balanço que pagar), mas a declaração sai do estado retido.
func TestAdvance_LiberacaoComPoliticaNova(t *testing.T) {
	// Ciclo 1 (2º trimestre), liberado depois do prazo; lucros dos dois últimos balanços.
	prior := []float64{100_000, 60_000}
	release := 200
	rel := &DeclarationRelease{ID: "decl-1", CycleIndex: 1, Reason: "decision"}

	quarterly := payingCompany(catalog.DividendQuarterly, 0, prior...)
	quarterly.Release = rel
	if v := advanceOn(quarterly, release).NewDividends[0].ValuePerShare; v != 50 {
		t.Errorf("trimestral paga só o lucro do balanço retido: %v, esperado 50", v)
	}

	semiannual := payingCompany(catalog.DividendSemiannual, 0, prior...)
	semiannual.Release = rel
	if v := advanceOn(semiannual, release).NewDividends[0].ValuePerShare; v != 80 {
		t.Errorf("semestral soma os dois ciclos: %v, esperado (100.000 + 60.000) x 50%% / 1.000 = 80", v)
	}

	// Ciclo 0 (1º trimestre) não paga no semestral: a declaração sai sem provento nem data-ex.
	annualFirstCycle := payingCompany(catalog.DividendAnnual, 0, prior...)
	annualFirstCycle.Release = &DeclarationRelease{ID: "decl-2", CycleIndex: 0, Reason: "decision"}
	res := advanceOn(annualFirstCycle, release)
	if len(res.NewDividends) != 0 {
		t.Errorf("a política nova não paga este balanço: %+v", res.NewDividends)
	}
	if len(res.ReleasedDeclarations) != 1 || res.ReleasedDeclarations[0].ExDay != 0 || res.ReleasedDeclarations[0].ID != "decl-2" {
		t.Errorf("a declaração sai mesmo assim, sem data-ex: %+v", res.ReleasedDeclarations)
	}
}
