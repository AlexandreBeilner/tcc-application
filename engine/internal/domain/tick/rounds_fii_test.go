package tick

import (
	"context"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
)

// Tarefa U.3 (achado 024): o Fundamentalista passa a negociar FII com o preço
// justo de fii.FairPrice, sem abrir a porta pra ETF nem pra ativo sem contexto.

func orderContextWithShares(shares *int64) orderexecution.Context {
	return orderexecution.Context{IncomingUserBalance: 1_000_000, IncomingUserPosition: 1_000, OutstandingShares: shares}
}

func TestAssetHasFundamentalContext(t *testing.T) {
	companyID := "c1"
	contexts := RoundContext{
		Company: map[string]CompanyRoundContext{"c1": {}},
		FII:     map[string]FIIRoundContext{"fii1": {}},
	}
	tests := []struct {
		name    string
		assetID string
		state   *equityRoundState
		ctx     RoundContext
		want    bool
	}{
		{"FII com contexto", "fii1", &equityRoundState{}, contexts, true},
		{"FII sem contexto (sem valor-base)", "fii2", &equityRoundState{}, contexts, false},
		{"ação com contexto de empresa", "a1", &equityRoundState{CompanyID: &companyID}, contexts, true},
		{"ação sem contexto de empresa", "a1", &equityRoundState{CompanyID: &companyID}, RoundContext{}, false},
		{"ETF nunca tem contexto", "etf1", &equityRoundState{}, contexts, false},
		{"estado nil", "fii1", nil, contexts, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := assetHasFundamentalContext(tt.assetID, tt.state, tt.ctx); got != tt.want {
				t.Fatalf("got %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFundamentalistHasContext_OutroArquetipoSempreTrue(t *testing.T) {
	if !fundamentalistHasContext(mustRoundPersonality(t, bot.ArchetypeRuido), "etf1", &equityRoundState{}, RoundContext{}) {
		t.Fatal("arquétipo não Fundamentalista não depende de contexto")
	}
}

func TestDecisionInputFor_FundamentalistaDeFIIMontaContextoDePrecoJusto(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.tradedVolume = &fakeTradedVolumeReader{}
	shares := int64(10_000)
	execCtx := orderContextWithShares(&shares)
	contexts := RoundContext{FII: map[string]FIIRoundContext{"fii1": {BaseValue: 1_000_000, OutstandingShares: shares, TargetPriceToBook: 0.8, DividendEffectPct: -2}}}

	input, ok, err := svc.decisionInputFor(context.Background(), mustFIIScopedRoundPersonality(t, bot.ArchetypeFundamentalista), &equityRoundState{Price: 100}, execCtx, "fii1", contexts, 10, 10, 1, map[string][]float64{}, map[string][]int{}, 0.05)
	if err != nil || !ok {
		t.Fatalf("ok=%v err=%v, want ok sem erro", ok, err)
	}
	if input.FII == nil || input.FII.BaseValue != 1_000_000 || input.FII.TargetPriceToBook != 0.8 || input.FII.DividendEffectPct != -2 {
		t.Fatalf("input.FII = %+v, want o contexto do ativo", input.FII)
	}
	if input.OutstandingShares != shares {
		t.Fatalf("OutstandingShares = %d, want %d", input.OutstandingShares, shares)
	}

	// Sem cotas no contexto de execução ou sem contexto de FII: não participa.
	if _, ok, _ := svc.decisionInputFor(context.Background(), mustFIIScopedRoundPersonality(t, bot.ArchetypeFundamentalista), &equityRoundState{Price: 100}, orderContextWithShares(nil), "fii1", contexts, 10, 10, 1, map[string][]float64{}, map[string][]int{}, 0.05); ok {
		t.Fatal("sem OutstandingShares deveria descartar o bot")
	}
	if _, ok, _ := svc.decisionInputFor(context.Background(), mustFIIScopedRoundPersonality(t, bot.ArchetypeFundamentalista), &equityRoundState{Price: 100}, execCtx, "fii1", RoundContext{}, 10, 10, 1, map[string][]float64{}, map[string][]int{}, 0.05); ok {
		t.Fatal("FII sem contexto deveria descartar o bot")
	}
}

func TestRunIntradayRounds_FundamentalistaNegociaFIIComContexto(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustFIIScopedRoundPersonality(t, bot.ArchetypeFundamentalista)}}}
	shares := int64(10_000)
	loader := &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"fii1": 10_000}, outstandingShares: &shares}
	svc.orderContext = loader
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{fiiAsset("fii1", 100)}
	// VP 130 × P/VP 1,0: preço justo 130 contra mercado 100, então compra.
	contexts := RoundContext{FII: map[string]FIIRoundContext{"fii1": {BaseValue: 1_300_000, OutstandingShares: shares, TargetPriceToBook: 1.0}}}

	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, contexts, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills == 0 || len(submitter.submitted) == 0 {
		t.Fatalf("fills=%d submitted=%d, want o Fundamentalista negociando FII", fills, len(submitter.submitted))
	}
	// Só a primeira ordem tem direção garantida: depois de convergir ao justo, o
	// ruído de conhecimento pode inverter o lado nas seguintes.
	if first := submitter.submitted[0].req; first.Side != orderbook.SideBuy {
		t.Fatalf("Side = %v, want buy (preço justo acima do mercado)", first.Side)
	}
	for _, o := range submitter.submitted {
		if o.req.Type == orderbook.TypeMarket {
			continue // turno de piso (Q.8): ordem a mercado, sem preço-limite
		}
		if math.Abs(o.req.Price-130)/130 > 0.15 {
			t.Fatalf("Price = %.2f, want perto do preço justo 130", o.req.Price)
		}
	}
	if closing["fii1"] <= 100 {
		t.Fatalf("closing = %.2f, want acima de 100 (convergindo ao justo)", closing["fii1"])
	}
}
