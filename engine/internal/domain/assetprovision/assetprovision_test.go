package assetprovision

import (
	"context"
	"errors"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/botpool"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/coverage"
)

func validEquity() Spec {
	return Spec{
		Kind: KindAcao, Ticker: "NOVA3", Name: "Nova ON", CompanyName: "Nova S.A.", CNPJ: "44555666000177",
		Sector: catalog.SectorVarejo, OutstandingShares: 200_000_000, BaseGrowthPct: 3, QualityMultiplier: 1,
	}
}

func TestSpecValidate(t *testing.T) {
	mut := func(f func(*Spec)) Spec { s := validEquity(); f(&s); return s }
	tests := []struct {
		name  string
		spec  Spec
		field string
	}{
		{"ação válida", validEquity(), ""},
		{"FII de tijolo válido", Spec{Kind: KindFIITijolo, Ticker: "NOVO11", Name: "Fii", Segment: "Lajes", VacancyRate: 4}, ""},
		{"FII de papel válido", Spec{Kind: KindFIIPapel, Ticker: "NOVP11", Name: "Fii", Indexador: "IPCA+"}, ""},
		{"ETF válido", Spec{Kind: KindETF, Ticker: "NOVE11", Name: "Etf", BenchmarkIndex: "Idx", Holdings: []HoldingSpec{{"VALR3", 100}}}, ""},
		{"classe desconhecida", Spec{Kind: "cdb", Ticker: "NOVA3", Name: "x"}, "kind"},
		{"ticker de ação com sufixo 11", mut(func(s *Spec) { s.Ticker = "NOVA11" }), "ticker"},
		{"ticker minúsculo", mut(func(s *Spec) { s.Ticker = "nova3" }), "ticker"},
		{"ticker de FII sem 11", Spec{Kind: KindFIITijolo, Ticker: "NOVO3", Name: "x", Segment: "s"}, "ticker"},
		{"nome vazio", mut(func(s *Spec) { s.Name = " " }), "name"},
		{"nome longo", mut(func(s *Spec) { s.Name = strings.Repeat("a", 101) }), "name"},
		{"float abaixo do piso", mut(func(s *Spec) { s.OutstandingShares = 10 }), "outstanding_shares"},
		{"float acima do teto", mut(func(s *Spec) { s.OutstandingShares = MaxOutstandingShares + 1 }), "outstanding_shares"},
		{"CNPJ curto", mut(func(s *Spec) { s.CNPJ = "123" }), "cnpj"},
		{"setor desconhecido", mut(func(s *Spec) { s.Sector = "Cripto" }), "sector"},
		{"crescimento zera o fator", mut(func(s *Spec) { s.BaseGrowthPct = -100 }), "base_growth_pct"},
		{"qualidade acima do teto", mut(func(s *Spec) { s.QualityMultiplier = 3 }), "quality_multiplier"},
		{"vacância acima de 100", Spec{Kind: KindFIITijolo, Ticker: "NOVO11", Name: "x", Segment: "s", VacancyRate: 101}, "vacancy_rate"},
		{"indexador desconhecido", Spec{Kind: KindFIIPapel, Ticker: "NOVP11", Name: "x", Indexador: "SELIC"}, "indexador"},
		{"ETF sem cesta", Spec{Kind: KindETF, Ticker: "NOVE11", Name: "x", BenchmarkIndex: "i"}, "holdings"},
		{"ETF com constituinte repetido", Spec{Kind: KindETF, Ticker: "NOVE11", Name: "x", BenchmarkIndex: "i", Holdings: []HoldingSpec{{"A", 50}, {"A", 50}}}, "holdings"},
		{"ETF com peso zero", Spec{Kind: KindETF, Ticker: "NOVE11", Name: "x", BenchmarkIndex: "i", Holdings: []HoldingSpec{{"A", 0}}}, "holdings"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.spec.Validate()
			if tc.field == "" {
				if err != nil {
					t.Fatalf("erro = %v", err)
				}
				return
			}
			var ve *ValidationError
			if !errors.As(err, &ve) || ve.Field != tc.field {
				t.Fatalf("erro = %v, queria ValidationError em %s", err, tc.field)
			}
		})
	}
}

type fakeStore struct {
	tickers, cnpjs map[string]bool
	assets         map[string]ResolvedAsset
	created        []Plan
	onCreate       func(Plan)
}

func (f *fakeStore) TickerExists(_ context.Context, t string) (bool, error) { return f.tickers[t], nil }
func (f *fakeStore) CNPJExists(_ context.Context, c string) (bool, error)   { return f.cnpjs[c], nil }
func (f *fakeStore) ResolveTickers(_ context.Context, tickers []string) (map[string]ResolvedAsset, error) {
	out := map[string]ResolvedAsset{}
	for _, t := range tickers {
		if a, ok := f.assets[t]; ok {
			out[t] = a
		}
	}
	return out, nil
}
func (f *fakeStore) Create(_ context.Context, p Plan) (string, error) {
	f.created = append(f.created, p)
	if f.onCreate != nil {
		f.onCreate(p)
	}
	return "new-asset-id", nil
}

// fakeLiquidity simula um banco já semeado com `assets` ativos negociáveis e o pool de PoolSize(assets).
type fakeLiquidity struct {
	state       PoolState
	distributed []Distribution
}

func newLiquidity(assets int) *fakeLiquidity {
	floats := make([]AssetFloat, assets)
	for i := range floats {
		floats[i] = AssetFloat{Outstanding: 100_000_000}
	}
	return &fakeLiquidity{state: PoolState{DirectionalBots: bot.PoolSize(assets), Floats: floats}}
}

func (f *fakeLiquidity) PoolState(context.Context) (PoolState, error) { return f.state, nil }
func (f *fakeLiquidity) Distribute(_ context.Context, d Distribution) error {
	f.distributed = append(f.distributed, d)
	return nil
}

type fakeCoverage struct {
	mms          []coverage.MarketMaker
	provisioned  []coverage.Provision
	createdMMIDs []string
}

func (f *fakeCoverage) ListMarketMakers(context.Context) ([]coverage.MarketMaker, error) {
	return f.mms, nil
}
func (f *fakeCoverage) CreateMarketMaker(_ context.Context, id string, _ bot.Personality) error {
	f.createdMMIDs = append(f.createdMMIDs, id)
	return nil
}
func (f *fakeCoverage) ProvisionCoverage(_ context.Context, p coverage.Provision) error {
	f.provisioned = append(f.provisioned, p)
	return nil
}

func newService(assets int) (*Service, *fakeStore, *fakeLiquidity, *fakeCoverage) {
	store := &fakeStore{
		tickers: map[string]bool{"VALR3": true},
		cnpjs:   map[string]bool{"11222333000181": true},
		assets: map[string]ResolvedAsset{
			"VALR3":   {ID: "id-valr", Name: "Vale ON", Type: catalog.AssetAcao},
			"TJLO11":  {ID: "id-tjlo", Name: "FII Tijolo", Type: catalog.AssetFII},
			"LFT2029": {ID: "id-lft", Name: "Tesouro", Type: catalog.AssetTesouroSelic},
		},
	}
	liquidity := newLiquidity(assets)
	// depois do cadastro o ativo já está no catálogo: o PoolState seguinte o traz
	store.onCreate = func(p Plan) {
		if p.OutstandingShares != nil {
			liquidity.state.Floats = append(liquidity.state.Floats, AssetFloat{Outstanding: *p.OutstandingShares})
		}
	}
	cov := &fakeCoverage{mms: []coverage.MarketMaker{{AccountID: "mm-1", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"x"}}}}
	return NewService(store, liquidity, cov, coverage.NewEnsurer(cov, cov)), store, liquidity, cov
}

func TestPreview_NaoGravaNada(t *testing.T) {
	svc, store, liquidity, cov := newService(30)
	p, err := svc.Preview(context.Background(), validEquity())
	if err != nil {
		t.Fatal(err)
	}
	// 30 ativos: pool de 60. Com o 31º, 62: dois bots novos.
	if p.Pool == nil || p.Pool.PoolBefore != 60 || p.Pool.PoolAfter != 62 || p.Pool.NewBots != 2 {
		t.Fatalf("pool = %+v", p.Pool)
	}
	if p.Pool.MarketMakerShares+p.Pool.BotShares != 200_000_000 {
		t.Errorf("float distribuído = %d, queria 200.000.000", p.Pool.MarketMakerShares+p.Pool.BotShares)
	}
	if p.Pool.MarketMakerID != "mm-1" || p.Pool.CreatesMarketMaker {
		t.Errorf("Market Maker = %+v", p.Pool)
	}
	if len(store.created) != 0 || len(liquidity.distributed) != 0 || len(cov.provisioned) != 0 {
		t.Error("o preview não pode gravar nada")
	}
}

func TestPreview_CriaMarketMakerQuandoNaoHaFolga(t *testing.T) {
	svc, _, _, cov := newService(30)
	cov.mms[0].MaxAssets = 1
	p, err := svc.Preview(context.Background(), validEquity())
	if err != nil {
		t.Fatal(err)
	}
	if !p.Pool.CreatesMarketMaker || p.Pool.MarketMakerID != coverage.NewMarketMakerID(1) {
		t.Errorf("Market Maker = %+v", p.Pool)
	}
}

// Critério de crescimento (memória "Design for growth"): criar o 31º ativo num banco de 30 só
// grava posições do ativo novo e bots novos; nada de ativo antigo.
func TestCreate_31oAtivoNaoAlteraOsAntigos(t *testing.T) {
	svc, store, liquidity, cov := newService(30)
	res, err := svc.Create(context.Background(), validEquity())
	if err != nil {
		t.Fatal(err)
	}
	if res.AssetID != "new-asset-id" || len(store.created) != 1 {
		t.Fatalf("resultado = %+v, criados = %d", res, len(store.created))
	}
	plan := store.created[0]
	if plan.Fundamentals == nil || plan.Company == nil || *plan.ShareClass != "ON" || *plan.Asset.RiskClass != "Sofisticado" {
		t.Errorf("plano = %+v", plan)
	}
	if len(liquidity.distributed) != 1 {
		t.Fatalf("distribuições = %d", len(liquidity.distributed))
	}
	d := liquidity.distributed[0]
	if d.AssetID != "new-asset-id" || len(d.Positions) != 62 || len(d.NewBots) != 2 {
		t.Fatalf("distribuição = ativo %s, %d posições, %d bots novos", d.AssetID, len(d.Positions), len(d.NewBots))
	}
	if d.NewBots[0].Index != 60 || d.NewBots[1].Index != 61 {
		t.Errorf("bots novos = %d e %d, queria 60 e 61 (os 60 antigos ficam)", d.NewBots[0].Index, d.NewBots[1].Index)
	}
	for _, nb := range d.NewBots {
		if nb.Cash <= 0 || botpool.UserID(nb.Index) == "" {
			t.Errorf("bot novo %d sem caixa", nb.Index)
		}
	}
	var sum int64
	for _, q := range d.Positions {
		sum += q
	}
	if len(cov.provisioned) != 1 || sum+cov.provisioned[0].Shares != 200_000_000 {
		t.Fatalf("cobertura = %+v, bots = %d: o float não fecha", cov.provisioned, sum)
	}
	if cov.provisioned[0].AssetID != "new-asset-id" || cov.provisioned[0].MMAccountID != "mm-1" {
		t.Errorf("cobertura = %+v", cov.provisioned[0])
	}
}

func TestCreate_PoolNaoCresceAbaixoDoMinimo(t *testing.T) {
	svc, _, liquidity, _ := newService(5)
	if _, err := svc.Create(context.Background(), validEquity()); err != nil {
		t.Fatal(err)
	}
	if d := liquidity.distributed[0]; len(d.NewBots) != 0 || len(d.Positions) != bot.MinPoolSize {
		t.Errorf("com 6 ativos o pool segue em %d: %d bots novos, %d posições", bot.MinPoolSize, len(d.NewBots), len(d.Positions))
	}
}

func TestCreate_Conflitos(t *testing.T) {
	svc, store, _, _ := newService(30)
	for name, mutate := range map[string]func(*Spec){
		"ticker em uso": func(s *Spec) { s.Ticker = "VALR3" },
		"CNPJ em uso":   func(s *Spec) { s.CNPJ = "11222333000181" },
	} {
		spec := validEquity()
		mutate(&spec)
		var ce *ConflictError
		if _, err := svc.Create(context.Background(), spec); !errors.As(err, &ce) {
			t.Errorf("%s: erro = %v, queria ConflictError", name, err)
		}
	}
	if len(store.created) != 0 {
		t.Error("conflito não pode gravar")
	}
}

func TestCreate_FIIPorTipo(t *testing.T) {
	for name, spec := range map[string]Spec{
		"tijolo": {Kind: KindFIITijolo, Ticker: "NOVO11", Name: "Fii Novo", Segment: "Lajes Corporativas", VacancyRate: 5},
		"papel":  {Kind: KindFIIPapel, Ticker: "NOVP11", Name: "Fii Papel", Indexador: "CDI"},
	} {
		t.Run(name, func(t *testing.T) {
			svc, store, liquidity, _ := newService(30)
			if _, err := svc.Create(context.Background(), spec); err != nil {
				t.Fatal(err)
			}
			plan := store.created[0]
			if plan.FII == nil || *plan.OutstandingShares != FIIOutstandingShares || plan.Company != nil {
				t.Fatalf("plano = %+v", plan)
			}
			if name == "tijolo" && (plan.FII.NetWorth == nil || *plan.FII.NetWorth <= 0) {
				t.Errorf("patrimônio inicial = %v", plan.FII.NetWorth)
			}
			if name == "papel" && (plan.FII.PortfolioValue == nil || *plan.FII.PortfolioValue <= 0) {
				t.Errorf("carteira inicial = %v", plan.FII.PortfolioValue)
			}
			if len(liquidity.distributed) != 1 {
				t.Error("FII entra no pool de bots como ação")
			}
		})
	}
}

func TestCreate_ETFNaoTemFloatNemCobertura(t *testing.T) {
	svc, store, liquidity, cov := newService(30)
	spec := Spec{Kind: KindETF, Ticker: "NOVE11", Name: "ETF Novo", BenchmarkIndex: "Idx", Methodology: "m",
		Holdings: []HoldingSpec{{"VALR3", 60}, {"TJLO11", 40}}}
	res, err := svc.Create(context.Background(), spec)
	if err != nil {
		t.Fatal(err)
	}
	if res.Preview.Pool != nil || res.Preview.OutstandingShares != nil {
		t.Errorf("ETF não tem float nem pool: %+v", res.Preview)
	}
	if len(store.created) != 1 || store.created[0].ETF == nil || len(store.created[0].ETF.Holdings) != 2 {
		t.Fatalf("plano = %+v", store.created)
	}
	if h := store.created[0].ETF.Holdings[0]; h.ConstituentName != "Vale ON (VALR3)" || *h.AssetID != "id-valr" {
		t.Errorf("constituinte = %+v", h)
	}
	if len(liquidity.distributed) != 0 || len(cov.provisioned) != 0 {
		t.Error("ETF não distribui float nem ganha Market Maker")
	}
}

func TestCreate_ETFRecusas(t *testing.T) {
	base := Spec{Kind: KindETF, Ticker: "NOVE11", Name: "ETF", BenchmarkIndex: "Idx"}
	tests := map[string][]HoldingSpec{
		"ticker inexistente":      {{"NAOEX3", 100}},
		"renda fixa na cesta":     {{"LFT2029", 100}},
		"pesos que não somam 100": {{"VALR3", 60}, {"TJLO11", 30}},
	}
	for name, holdings := range tests {
		t.Run(name, func(t *testing.T) {
			svc, store, _, _ := newService(30)
			spec := base
			spec.Holdings = holdings
			var ve *ValidationError
			if _, err := svc.Create(context.Background(), spec); !errors.As(err, &ve) || ve.Field != "holdings" {
				t.Fatalf("erro = %v, queria ValidationError em holdings", err)
			}
			if len(store.created) != 0 {
				t.Error("recusa não pode gravar")
			}
		})
	}
}
