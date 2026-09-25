package tick

import (
	"context"
	"errors"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/selic"
)

func mustRoundPersonality(t *testing.T, archetype bot.Archetype) bot.Personality {
	t.Helper()
	scope, err := bot.NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}
	riskProfile, err := bot.NewRiskProfile(0.5, 0.5, 0.02)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	var knowledgeLevel *float64
	if archetype == bot.ArchetypeFundamentalista {
		level := 0.7
		knowledgeLevel = &level
	}
	personality, err := bot.NewPersonality(archetype, scope, knowledgeLevel, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}
	return personality
}

// mustFundamentalistRoundPersonality é mustRoundPersonality com
// knowledgeLevel configurável — usado pelo teste ponta a ponta da E.2, que
// precisa de vários bots Fundamentalistas com níveis de conhecimento
// diferentes (o parâmetro que faz cada um perceber uma fração diferente do
// mesmo evento macro).
func mustFundamentalistRoundPersonality(t *testing.T, knowledgeLevel float64) bot.Personality {
	t.Helper()
	scope, err := bot.NewSpecializationScope([]catalog.Sector{catalog.SectorMineracao}, nil, nil, 0.85)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}
	riskProfile, err := bot.NewRiskProfile(0.5, 0.5, 0.02)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	personality, err := bot.NewPersonality(bot.ArchetypeFundamentalista, scope, &knowledgeLevel, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}
	return personality
}

func acaoAsset(assetID string, lastPrice float64) AssetForPricing {
	riskClass := "Conservador"
	sector := "Mineração"
	companyID := "c1"
	return AssetForPricing{
		AssetID: assetID, Type: assetTypeAcao, RiskClass: &riskClass, Sector: &sector,
		CompanyID: &companyID, LastPrice: &lastPrice,
	}
}

// acaoAssetWithShareClass é acaoAsset com ShareClass preenchido (tarefa
// J.3) — usado pelos testes que precisam distinguir ON/PN da mesma empresa
// (acaoAsset sozinha nunca preenche ShareClass, contando como ON por
// convenção, mesma nota do campo em tick.go).
func acaoAssetWithShareClass(assetID string, lastPrice float64, shareClass string) AssetForPricing {
	a := acaoAsset(assetID, lastPrice)
	a.ShareClass = &shareClass
	return a
}

// fiiAsset monta um FII pra teste (tarefa G.1) — sem RiskClass/Sector/
// CompanyID, mesma forma crua que o catálogo real produz pra essa classe
// (spec 3.6: FII não tem risk_class nem setor próprio, e não é vinculado a
// uma company).
func fiiAsset(assetID string, lastPrice float64) AssetForPricing {
	return AssetForPricing{AssetID: assetID, Type: assetTypeFII, LastPrice: &lastPrice}
}

// mustFIIScopedRoundPersonality monta uma personalidade de bot cujo escopo
// de especialização cobre FII só por AssetClasses (tarefa G.1) — sem nenhum
// setor/risk_class, porque FII não tem nenhum dos dois (mesma nota de
// fiiAsset acima). WithinScopePct no teto pra minimizar o sorteio "fora do
// escopo" nos testes que precisam de um fill garantido.
func mustFIIScopedRoundPersonality(t *testing.T, archetype bot.Archetype) bot.Personality {
	t.Helper()
	scope, err := bot.NewSpecializationScope(nil, nil, []catalog.AssetType{catalog.AssetFII}, bot.SpecializationWithinScopeMax)
	if err != nil {
		t.Fatalf("scope de setup inválido: %v", err)
	}
	riskProfile, err := bot.NewRiskProfile(0.5, 0.5, 0.02)
	if err != nil {
		t.Fatalf("risk profile de setup inválido: %v", err)
	}
	var knowledgeLevel *float64
	if archetype == bot.ArchetypeFundamentalista {
		level := 0.7
		knowledgeLevel = &level
	}
	personality, err := bot.NewPersonality(archetype, scope, knowledgeLevel, riskProfile)
	if err != nil {
		t.Fatalf("personality de setup inválida: %v", err)
	}
	return personality
}

func twoIntradayRounds() []IntradayRound {
	return []IntradayRound{{SequenceIndex: 0, TimeOfDay: 0.3}, {SequenceIndex: 1, TimeOfDay: 0.7}}
}

func TestRunIntradayRounds_SemAcaoNoUniversoNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}

	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), nil, nil, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(closing) != 0 || fills != 0 {
		t.Fatalf("closing=%v fills=%d, want vazio/0 sem nenhuma Ação no universo", closing, fills)
	}
}

// TestRunIntradayRounds_FIINegociaComoAcaoViaBookReal cobre o critério de
// aceite central da tarefa G.1: FII entra no mesmo book/bots de Ações —
// um bot Ruído especializado em FII só por AssetClasses (sem setor/risk_class,
// que FII não tem) consegue negociá-lo via orderexecution real, e o preço de
// fechamento reflete o fill de verdade (não GBM).
func TestRunIntradayRounds_FIINegociaComoAcaoViaBookReal(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustFIIScopedRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"fii1": 10_000}}
	submitter := &fakeOrderSubmitter{fillPrice: 105}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{fiiAsset("fii1", 100)}

	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if closing["fii1"] != 105 {
		t.Errorf("closing[fii1] = %v, want 105 (preço do último fill via orderexecution, não GBM)", closing["fii1"])
	}
	if fills == 0 {
		t.Error("fills = 0, want > 0 (bot especializado em FII deveria ter negociado)")
	}
	for _, s := range submitter.submitted {
		if s.req.AssetID != "fii1" {
			t.Errorf("ordem submetida pro ativo %q, want fii1", s.req.AssetID)
		}
	}
}

// TestRunIntradayRounds_QuantidadeDeCompraNuncaExcedeOFloat cobre o achado
// 005 (pontos-em-aberto-decisao-produto.md), na ponta de wiring de
// decisionInputFor: antes desta correção, execCtx.OutstandingShares só era
// lido dentro do case ArchetypeFundamentalista — um bot Ruído com caixa
// ordens de grandeza maior que o float do ativo (o mesmo padrão observado
// em produção durante a auditoria de ponta a ponta da Fase G, 2026-09-19)
// gerava uma ordem de compra maior que 100% do float, nunca preenchível,
// travando o preço de fechamento no mesmo valor por dias/semanas
// simulados. OrderSizeCeiling (bot.DecisionInput) agora vem do mesmo
// execCtx.OutstandingShares pros 4 arquétipos, não só o Fundamentalista
// (sem histórico de volume nesta rodada — fakeTradedVolumeReader zero
// value — effectiveOrderSizeCeiling cai pro float sozinho).
func TestRunIntradayRounds_QuantidadeDeCompraNuncaExcedeOFloat(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustFIIScopedRoundPersonality(t, bot.ArchetypeRuido)}}}
	floatCeiling := int64(1_000_000)
	svc.orderContext = &fakeOrderContextLoader{balance: 104_866_356_108.88, outstandingShares: &floatCeiling}
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{fiiAsset("fii1", 134.65)}

	_, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills == 0 {
		t.Fatal("fills = 0, want > 0 (bot especializado em FII deveria ter negociado)")
	}
	for _, s := range submitter.submitted {
		if s.req.Side != orderbook.SideBuy {
			continue
		}
		if s.req.Quantity > int(floatCeiling) {
			t.Errorf("ordem de compra Quantity = %d, want <= floatCeiling (%d)", s.req.Quantity, floatCeiling)
		}
	}
}

// TestEffectiveOrderSizeCeiling cobre a composição do teto de tamanho de
// ordem (achado 005 parte B, pontos-em-aberto-decisao-produto.md): o menor
// entre o float finito e o volume médio negociado recente, com os dois
// casos de ausência de dado tratados sem panicar nem bloquear a negociação
// por falta de histórico.
func TestEffectiveOrderSizeCeiling(t *testing.T) {
	// float pequeno o bastante pro piso proporcional (MinOrderPctOfFloat,
	// achado 009) ficar em MinOrderSizeCeiling, senão ele mascararia os
	// casos que testam o teto de volume sozinho.
	floatCeiling := int64(100)
	bigFloat := int64(1_000_000)
	smallFloat := int64(1)

	ptr := func(v int64) *int64 { return &v }

	tests := []struct {
		name         string
		floatCeiling *int64
		recentVolume []int
		want         *int64
	}{
		{
			name: "sem histórico de volume cai pro float sozinho", floatCeiling: &floatCeiling,
			recentVolume: nil, want: &floatCeiling,
		},
		{
			// avg([10,10,10,10,10]) = 10, 10 * MaxOrderPctOfAverageVolumePct
			// (0.20) = 2 — bem menor que o float, então o volume vence.
			name: "volume médio menor que o float vence", floatCeiling: &floatCeiling,
			recentVolume: []int{10, 10, 10, 10, 10}, want: ptr(2),
		},
		{
			// avg([1000,1000]) = 1000, 1000 * 0.20 = 200 — bem maior que o
			// float pequeno, então o float vence.
			name: "float menor que o volume vence", floatCeiling: &smallFloat,
			recentVolume: []int{1000, 1000}, want: &smallFloat,
		},
		{
			name: "float nil com histórico de volume usa o volume sozinho", floatCeiling: nil,
			recentVolume: []int{100, 100}, want: ptr(20),
		},
		{
			name: "float nil e sem histórico de volume não aplica teto nenhum", floatCeiling: nil,
			recentVolume: nil, want: nil,
		},
		{
			// Histórico com volume zerado em todos os dias (ativo sem
			// nenhuma negociação real recente, mas já com `days` linhas de
			// asset_quotes) não pode mais produzir ceiling 0 (achado 005
			// parte C, J.6) — isso travava a liquidez do ativo pra sempre
			// (nenhuma ordem de compra nova conseguia quantidade >= 1, e sem
			// contraparte de compra as vendas também paravam de casar).
			// MinOrderSizeCeiling (piso de 1) garante que o teto de volume
			// nunca colapsa a zero enquanto o float disponível é positivo.
			name: "histórico existente mas todo zerado usa o piso mínimo, não zero", floatCeiling: &floatCeiling,
			recentVolume: []int{0, 0, 0}, want: ptr(MinOrderSizeCeiling),
		},
		{
			// achado 009: sem o piso proporcional, um volume recente que
			// decai (aqui 10/dia num float de 1M) puxava o teto pra 2 e o
			// mercado morria; o piso de 0,4% do float (4000) segura o teto.
			name: "volume recente baixo não derruba o teto abaixo do piso proporcional ao float", floatCeiling: &bigFloat,
			recentVolume: []int{10, 10, 10, 10, 10}, want: ptr(int64(float64(bigFloat) * MinOrderPctOfFloat)),
		},
		{
			// volume alto o bastante pra teto de volume (20% de 100M = 20M)
			// passar do piso (4000) — o piso nunca reduz um teto maior.
			name: "teto de volume acima do piso proporcional continua valendo", floatCeiling: &bigFloat,
			recentVolume: []int{500_000, 500_000}, want: ptr(int64(100_000)),
		},
		{
			// floatCeiling também zerado (sem float disponível pra comprar
			// de jeito nenhum) continua devolvendo 0 mesmo com o piso — o
			// piso nunca infla o teto além do que o float realmente permite.
			name: "float zero permanece zero mesmo com o piso mínimo", floatCeiling: ptr(0),
			recentVolume: []int{0, 0, 0}, want: ptr(0),
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := effectiveOrderSizeCeiling(tt.floatCeiling, tt.recentVolume)
			if (got == nil) != (tt.want == nil) {
				t.Fatalf("got = %v, want %v", got, tt.want)
			}
			if got != nil && *got != *tt.want {
				t.Errorf("got = %d, want %d", *got, *tt.want)
			}
		})
	}
}

// TestRunIntradayRounds_TetoDeVolumeLimitaOrdemQuandoMenorQueOFloat cobre a
// ponta de wiring de effectiveOrderSizeCeiling dentro de decisionInputFor:
// um volume médio recente bem menor que o float efetivamente aperta o teto
// de tamanho de ordem, não só o float sozinho (achado 005 parte B).
func TestRunIntradayRounds_TetoDeVolumeLimitaOrdemQuandoMenorQueOFloat(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustFIIScopedRoundPersonality(t, bot.ArchetypeRuido)}}}
	floatCeiling := int64(100)
	svc.orderContext = &fakeOrderContextLoader{balance: 104_866_356_108.88, outstandingShares: &floatCeiling}
	svc.tradedVolume = &fakeTradedVolumeReader{volumes: map[string][]int{"fii1": {10, 10, 10, 10, 10}}}
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{fiiAsset("fii1", 134.65)}

	const wantCeiling = 2 // avg(10) * MaxOrderPctOfAverageVolumePct (0.20) = 2, << floatCeiling

	_, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills == 0 {
		t.Fatal("fills = 0, want > 0 (bot especializado em FII deveria ter negociado)")
	}
	for _, s := range submitter.submitted {
		if s.req.Side != orderbook.SideBuy {
			continue
		}
		if s.req.Quantity > wantCeiling {
			t.Errorf("ordem de compra Quantity = %d, want <= %d (teto de volume, bem menor que o float de %d)", s.req.Quantity, wantCeiling, floatCeiling)
		}
	}
}

// TestRunIntradayRounds_VolumeRealZeradoPorVariosDiasNaoTravaOrdemDeCompra
// cobre o achado 005 (Parte C)/tarefa J.6: vários dias simulados seguidos
// com volume real negociado zerado (recentVolume todo 0 — diferente de "sem
// histórico ainda", já tratado por effectiveOrderSizeCeiling desde a parte
// B) não pode mais zerar o teto de tamanho de ordem pra sempre. Sem
// MinOrderSizeCeiling, o teste falharia com fills == 0: capToFloat
// devolveria maxBuyQuantity == 0 pro bot Ruído (mesma personalidade dos
// outros testes desta função), DecideNoiseOrder nunca conseguiria gerar uma
// ordem de compra viável (sem posição pra vender tampouco), e nenhum fill
// aconteceria — exatamente o travamento observado no teste de ponta a ponta
// da Fase J (2026-09-19/20).
func TestRunIntradayRounds_VolumeRealZeradoPorVariosDiasNaoTravaOrdemDeCompra(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustFIIScopedRoundPersonality(t, bot.ArchetypeRuido)}}}
	floatCeiling := int64(100)
	svc.orderContext = &fakeOrderContextLoader{balance: 104_866_356_108.88, outstandingShares: &floatCeiling}
	svc.tradedVolume = &fakeTradedVolumeReader{volumes: map[string][]int{"fii1": {0, 0, 0, 0, 0}}}
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{fiiAsset("fii1", 134.65)}

	_, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills == 0 {
		t.Fatal("fills = 0, want > 0 (o piso mínimo deveria ter permitido pelo menos uma ordem de compra viável, quebrando o travamento)")
	}
	var sawBuy bool
	for _, s := range submitter.submitted {
		if s.req.Side != orderbook.SideBuy {
			continue
		}
		sawBuy = true
		if s.req.Quantity != MinOrderSizeCeiling {
			t.Errorf("ordem de compra Quantity = %d, want %d (teto de volume no piso mínimo, sem histórico real além de zero)", s.req.Quantity, MinOrderSizeCeiling)
		}
	}
	if !sawBuy {
		t.Fatal("nenhuma ordem de compra submetida — travamento de liquidez não foi corrigido")
	}
}

// TestRunIntradayRounds_PropagaErroDeRecentTradedVolume espelha
// TestRunIntradayRounds_PropagaErroDeLoadContext, pro novo colaborador
// TradedVolumeReader (achado 005 parte B) — falha de IO aborta o tick,
// nunca é tratada como "sem histórico ainda".
func TestRunIntradayRounds_PropagaErroDeRecentTradedVolume(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.tradedVolume = &fakeTradedVolumeReader{readErr: errors.New("falha de conexão")}

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err == nil {
		t.Fatal("err = nil, want erro propagado de RecentTradedVolume")
	}
}

// TestRunIntradayRounds_VolumeNegociadoAcumuladoPorAtivo cobre B.2: o total
// negociado devolvido por runIntradayRounds soma FilledQuantity de toda
// ordem preenchida no dia, não só a última (diferente do preço de
// fechamento, que é só o último fill).
func TestRunIntradayRounds_VolumeNegociadoAcumuladoPorAtivo(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{
		{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)},
		{UserID: "22222222-2222-2222-2222-222222222222", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}},
	}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{fillPrice: 105}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{acaoAsset("a1", 100)}

	_, volumes, fills, _, err := svc.runIntradayRounds(context.Background(), 3, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	var wantVolume int
	for _, s := range submitter.submitted {
		wantVolume += s.req.Quantity
	}
	if fills == 0 || wantVolume == 0 {
		t.Fatal("cenário não gerou nenhum fill — ajustar fixture do teste")
	}
	if volumes["a1"] != wantVolume {
		t.Errorf("volumes[a1] = %d, want %d (soma de Quantity de toda ordem submetida e preenchida)", volumes["a1"], wantVolume)
	}
}

// TestRunIntradayRounds_DuasAcoesDaMesmaEmpresaNegociamEmBooksIndependentes
// cobre a metade "preços independentes (books separados)" do critério de
// aceite da tarefa J.1 (Ações ON/PN, backlog-motor-mercado-realista):
// acaoAsset hardcoda companyID "c1" pra todo ativo que cria — chamá-la duas
// vezes com asset_id diferente já reproduz o cenário real de ON/PN da mesma
// empresa. O ponto central: state := equities[chosen.AssetID] (rounds.go)
// já indexa o preço por asset_id, nunca por company_id — este teste trava
// isso via observável externo (closingPrices), não só lendo o código.
func TestRunIntradayRounds_DuasAcoesDaMesmaEmpresaNegociamEmBooksIndependentes(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{
		{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"on1", "pn1"}},
	}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"on1": 10_000, "pn1": 10_000}}
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{acaoAsset("on1", 100), acaoAsset("pn1", 200)}
	if *assets[0].CompanyID != *assets[1].CompanyID {
		t.Fatalf("setup inválido: on1/pn1 precisam compartilhar CompanyID, got %q e %q", *assets[0].CompanyID, *assets[1].CompanyID)
	}

	// 20 rodadas (bem mais que as 1-4 reais de D.1) só pra este bot único
	// alcançar os dois ativos do universo pelo menos uma vez cada — seed
	// determinística (svc.seed, roundSeed), sem aleatoriedade real entre
	// execuções do teste.
	rounds := make([]IntradayRound, 20)
	for i := range rounds {
		rounds[i] = IntradayRound{SequenceIndex: i, TimeOfDay: float64(i) / float64(len(rounds))}
	}

	closing, volumes, fills, _, err := svc.runIntradayRounds(context.Background(), 0, rounds, assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills == 0 || volumes["on1"] == 0 || volumes["pn1"] == 0 {
		t.Fatalf("volumes = %+v, fills = %d — cenário precisa gerar negociação real nos dois ativos (ajustar fixture)", volumes, fills)
	}

	var lastOn, lastPn float64
	for _, s := range submitter.submitted {
		switch s.req.AssetID {
		case "on1":
			lastOn = s.req.Price
		case "pn1":
			lastPn = s.req.Price
		}
	}
	if closing["on1"] != lastOn {
		t.Errorf("closing[on1] = %v, want %v (último fill submetido pra on1 — book de on1 não pode refletir fill de pn1)", closing["on1"], lastOn)
	}
	if closing["pn1"] != lastPn {
		t.Errorf("closing[pn1] = %v, want %v (último fill submetido pra pn1 — book de pn1 não pode refletir fill de on1)", closing["pn1"], lastPn)
	}
	if closing["on1"] == closing["pn1"] {
		t.Errorf("closing[on1] == closing[pn1] (%v) — dois preços iniciais diferentes (100/200) convergindo pro mesmo valor sugere books cruzados entre as duas classes", closing["on1"])
	}
}

// TestCompanyRoundContexts_EmpresaComDoisAtivosDeAcaoCompartilhaMesmoContexto
// cobre a metade "compartilham o mesmo company_fundamentals (mesmo balanço)"
// do critério de aceite da J.1: companyRoundContexts é indexado por
// CompanyID (não por AssetID) — uma empresa com dois ativos vinculados (ON/
// PN) produz UMA entrada só no mapa, que os dois ativos leem via
// assetCompanies. Não é uma mudança de comportamento desta tarefa: já valia
// por construção desde a Fase D/E (tick.go só itera CompanyForFundamentals,
// nunca AssetForPricing, pra montar este mapa) — este teste documenta e
// trava essa garantia explicitamente pro caso real de ON/PN, em vez de só
// inferir do código.
func TestCompanyRoundContexts_EmpresaComDoisAtivosDeAcaoCompartilhaMesmoContexto(t *testing.T) {
	const companyID = "c1"
	revenue := 1_000_000.0
	company := CompanyForFundamentals{
		CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays,
		Sector: "Mineração", LastRevenue: &revenue,
	}
	assets := []AssetForPricing{acaoAsset("on1", 100), acaoAsset("pn1", 200)}

	contexts := companyRoundContexts([]CompanyForFundamentals{company}, map[string]float64{}, 1, 10, 10, map[string]float64{})
	if len(contexts) != 1 {
		t.Fatalf("len(contexts) = %d, want 1 — duas ações da mesma empresa compartilham um ciclo de fundamentos só, não um por ativo", len(contexts))
	}

	assetToCompany := assetCompanies(assets)
	if assetToCompany["on1"] != companyID || assetToCompany["pn1"] != companyID {
		t.Fatalf("assetCompanies = %+v, want ambos apontando pra %q", assetToCompany, companyID)
	}

	ctxForOn, ok := contexts[assetToCompany["on1"]]
	if !ok {
		t.Fatal("contexto de ON não encontrado")
	}
	ctxForPn, ok := contexts[assetToCompany["pn1"]]
	if !ok {
		t.Fatal("contexto de PN não encontrado")
	}
	if ctxForOn != ctxForPn {
		t.Errorf("contexto de fundamentos de ON (%+v) difere do de PN (%+v) — mesma empresa deveria compartilhar exatamente o mesmo balanço", ctxForOn, ctxForPn)
	}
}

// TestRunIntradayRounds_FundamentalistaValorizaPnAcimaDeOnProporcionalAoPremium
// cobre a tarefa J.3 (Ações ON/PN, backlog-motor-mercado-realista): o
// Fundamentalista calcula preço justo separadamente pra ON e PN da mesma
// empresa — mesmo fundamento (CompanyRoundContext.Financials/GrowthRate,
// compartilhado por company_id, J.1), mas o dividendo esperado por ação
// diferente (companies.pn_dividend_premium_pct, J.2) desloca a estimativa da
// PN acima da ON, proporcionalmente ao premium configurado
// (CompanyRoundContext.PnDividendPremiumPct, decisionInputFor só aplica pra
// state.ShareClass == "PN"). knowledgeLevel = 1.0
// (mustFundamentalistRoundPersonality) elimina o ruído de leitura, tornando
// os preços submetidos determinísticos — mesma técnica de
// TestDecideFundamentalistOrder_DirecaoConformeAoDesvio (bot package).
func TestRunIntradayRounds_FundamentalistaValorizaPnAcimaDeOnProporcionalAoPremium(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{
		{UserID: "bot1", Personality: mustFundamentalistRoundPersonality(t, 1.0)},
	}}
	shares := int64(100_000)
	svc.orderContext = &fakeOrderContextLoader{balance: 10_000_000, positions: map[string]int{"on1": 0, "pn1": 0}, outstandingShares: &shares}
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}
	svc.orderSubmitter = submitter

	// LastPrice bem abaixo do preço justo (~10.3, ver comentário do want
	// abaixo) — garante lado de compra claro pras duas classes, sem
	// depender de sorteio de lado.
	assets := []AssetForPricing{acaoAsset("on1", 1), acaoAssetWithShareClass("pn1", 1, "PN")}
	const pnPremiumPct = 20.0
	companyContext := map[string]CompanyRoundContext{
		"c1": {
			Financials:           fundamentals.Financials{NetIncome: 100_000, NetEquity: 1_000_000},
			GrowthRate:           0.03,
			PnDividendPremiumPct: pnPremiumPct,
		},
	}

	// 20 rodadas (mesma técnica de
	// TestRunIntradayRounds_DuasAcoesDaMesmaEmpresaNegociamEmBooksIndependentes)
	// só pra este bot único alcançar os dois ativos do universo pelo menos
	// uma vez cada, seed determinística.
	rounds := make([]IntradayRound, 20)
	for i := range rounds {
		rounds[i] = IntradayRound{SequenceIndex: i, TimeOfDay: float64(i) / float64(len(rounds))}
	}

	_, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, rounds, assets, companyContext, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills == 0 {
		t.Fatal("fills = 0, want > 0")
	}

	var onPrice, pnPrice float64
	for _, s := range submitter.submitted {
		switch s.req.AssetID {
		case "on1":
			onPrice = s.req.Price
		case "pn1":
			pnPrice = s.req.Price
		}
	}
	if onPrice == 0 || pnPrice == 0 {
		t.Fatalf("onPrice=%v pnPrice=%v, want ambos > 0 — as duas classes precisam ter negociado (ajustar fixture)", onPrice, pnPrice)
	}

	// VPA = 1_000_000/100_000 = 10; ROE = 100_000/1_000_000 = 0.1;
	// requiredReturn = selicNeutral (sem desvio) = 0.10; fairPrice ON =
	// 10 × (0.1/0.10) × 1.03 = 10.3; fairPrice PN = 10.3 × 1.20 = 12.36
	// (premium de 20% configurado acima).
	const wantOn = 10.3
	wantPn := wantOn * (1 + pnPremiumPct/100)
	if math.Abs(onPrice-wantOn) > 1e-9 {
		t.Errorf("onPrice = %.6f, want %.6f", onPrice, wantOn)
	}
	if math.Abs(pnPrice-wantPn) > 1e-9 {
		t.Errorf("pnPrice = %.6f, want %.6f", pnPrice, wantPn)
	}
	if pnPrice <= onPrice {
		t.Errorf("pnPrice (%.6f) deveria ser maior que onPrice (%.6f) — prioridade legal de dividendo da PN", pnPrice, onPrice)
	}
}

// Cotação de Market Maker em repouso e boa (ideal 99 e 101 com o ativo a 100,
// spread 2%): a manutenção de cotação não cancela nem submete nada (P.4).
func TestRunIntradayRounds_CotacaoBoaNaoGeraCancelamentoNemSubmissao(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{}
	svc.orderSubmitter = submitter
	lifecycle := &fakeOrderLifecycleManager{resting: map[string][]bot.RestingQuote{"a1": goodQuote("a1")}}
	svc.orderLifecycle = lifecycle

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(submitter.submitted) != 0 || len(lifecycle.cancelCalls) != 0 {
		t.Errorf("submitted = %d, cancelCalls = %v; want nenhum", len(submitter.submitted), lifecycle.cancelCalls)
	}
}

func goodQuote(assetID string) []bot.RestingQuote {
	return []bot.RestingQuote{
		{ID: assetID + "-buy", Side: orderbook.SideBuy, Price: 99, RemainingQuantity: 500},
		{ID: assetID + "-sell", Side: orderbook.SideSell, Price: 101, RemainingQuantity: 500},
	}
}

func submittedSides(o *fakeOrderSubmitter) []orderbook.Side {
	sides := make([]orderbook.Side, len(o.submitted))
	for i, s := range o.submitted {
		sides[i] = s.req.Side
	}
	return sides
}

// Lado consumido (sem compra em repouso): só a compra é recotada, a venda boa
// fica intocada e nada precisa ser cancelado.
func TestRunIntradayRounds_LadoConsumidoERecotadoSozinho(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{}
	svc.orderSubmitter = submitter
	lifecycle := &fakeOrderLifecycleManager{resting: map[string][]bot.RestingQuote{"a1": {goodQuote("a1")[1]}}}
	svc.orderLifecycle = lifecycle

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(lifecycle.cancelCalls) != 0 {
		t.Errorf("cancelCalls = %v, want nenhuma (a venda restante é boa)", lifecycle.cancelCalls)
	}
	// 2 rodadas e a passada final, sempre só a compra.
	for _, side := range submittedSides(submitter) {
		if side != orderbook.SideBuy {
			t.Errorf("lado submetido = %s, want só buy", side)
		}
	}
	if len(submitter.submitted) != 3 {
		t.Errorf("submetidas = %d, want 3 (rodada 1, rodada 2 e passada final)", len(submitter.submitted))
	}
}

// Lado fora da tolerância: só as ordens desse lado são canceladas, por ID, e
// só esse lado é recotado.
func TestRunIntradayRounds_LadoForaDaToleranciaCancelaSoEsseLado(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{}
	svc.orderSubmitter = submitter
	stale := goodQuote("a1")
	stale[1].Price = 110
	svc.orderLifecycle = &fakeOrderLifecycleManager{resting: map[string][]bot.RestingQuote{"a1": stale}}
	lifecycle := svc.orderLifecycle.(*fakeOrderLifecycleManager)

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nenhum erro", err)
	}
	for i, ids := range lifecycle.cancelCalls {
		if len(ids) != 1 || ids[0] != "a1-sell" {
			t.Errorf("cancelCalls[%d] = %v, want [a1-sell]", i, ids)
		}
	}
	if len(lifecycle.cancelCalls) != 3 {
		t.Errorf("cancelCalls = %d, want 3", len(lifecycle.cancelCalls))
	}
	for _, side := range submittedSides(submitter) {
		if side != orderbook.SideSell {
			t.Errorf("lado submetido = %s, want só sell", side)
		}
	}
}

// Leitura em lote: uma consulta por Market Maker e rodada com todos os ativos
// cobertos (não uma por ativo), mais uma na passada final.
func TestRunIntradayRounds_LeituraDeOrdensEmLotePorMarketMaker(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a2", "a1", "a3"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000, "a2": 10_000, "a3": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{}
	lifecycle := &fakeOrderLifecycleManager{}
	svc.orderLifecycle = lifecycle

	assets := []AssetForPricing{acaoAsset("a1", 100), acaoAsset("a2", 100), acaoAsset("a3", 100)}
	if _, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(lifecycle.listCalls) != 3 {
		t.Fatalf("listCalls = %d, want 3 (2 rodadas + passada final)", len(lifecycle.listCalls))
	}
	for _, call := range lifecycle.listCalls {
		if len(call) != 3 || call[0] != "a1" || call[1] != "a2" || call[2] != "a3" {
			t.Errorf("chamada em lote = %v, want [a1 a2 a3]", call)
		}
	}
}

// Passada final: mesmo com a cotação consumida depois da última rodada, o
// Market Maker recota antes do fechamento (caso do achado 013).
func TestRunIntradayRounds_PassadaFinalRecotaOQueFoiConsumido(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{}
	svc.orderSubmitter = submitter
	svc.orderLifecycle = &fakeOrderLifecycleManager{}

	rounds := twoIntradayRounds()
	if _, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, rounds[:1], []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	// 1 rodada + passada final = 2 vezes os 2 lados.
	if len(submitter.submitted) != 4 {
		t.Errorf("submetidas = %d, want 4", len(submitter.submitted))
	}
}

// Os outros 3 arquétipos nunca leem nem cancelam ordem em repouso: a ordem
// oportunista deles não é uma cotação contínua (achado 005 A.4).
func TestRunIntradayRounds_NaoMarketMakerNuncaMexeEmOrdemPropria(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{fillPrice: 105}
	lifecycle := &fakeOrderLifecycleManager{}
	svc.orderLifecycle = lifecycle

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(lifecycle.cancelCalls) != 0 || len(lifecycle.listCalls) != 0 {
		t.Errorf("cancelCalls = %v, listCalls = %v; want nenhuma", lifecycle.cancelCalls, lifecycle.listCalls)
	}
}

// Falha de IO na leitura em lote ou no cancelamento aborta o tick, mesmo
// padrão de TestRunIntradayRounds_PropagaErroDeLoadContext.
func TestRunIntradayRounds_PropagaErroDaManutencaoDeCotacao(t *testing.T) {
	stale := goodQuote("a1")
	stale[0].Price = 90
	for name, lifecycle := range map[string]*fakeOrderLifecycleManager{
		"listagem":     {listErr: errors.New("falha de conexão")},
		"cancelamento": {resting: map[string][]bot.RestingQuote{"a1": stale}, cancelErr: errors.New("falha de conexão")},
	} {
		t.Run(name, func(t *testing.T) {
			svc := newTestService(&fakeRepository{})
			svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}}}}
			svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
			svc.orderLifecycle = lifecycle

			_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
			if err == nil {
				t.Fatal("err = nil, want erro propagado")
			}
		})
	}
}

// TestRunIntradayRounds_FundamentalistaNuncaNegociaFII confere que o
// arquétipo Fundamentalista, mesmo especializado em FII por AssetClasses,
// nunca chega a decidir uma ordem pra ele — FII não tem CompanyID (spec
// 3.6), então fundamentalistHasCompanyContext descarta o bot antes de
// qualquer LoadContext/Decide (mesma checagem que já vale pra Ação sem
// empresa vinculada).
func TestRunIntradayRounds_FundamentalistaNuncaNegociaFII(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustFIIScopedRoundPersonality(t, bot.ArchetypeFundamentalista)}}}
	loader := &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"fii1": 10_000}}
	svc.orderContext = loader
	svc.orderSubmitter = &fakeOrderSubmitter{fillPrice: 105}

	assets := []AssetForPricing{fiiAsset("fii1", 100)}

	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills != 0 || loader.calls != 0 {
		t.Errorf("fills=%d LoadContext.calls=%d, want 0/0 (Fundamentalista sem CompanyID nunca participa)", fills, loader.calls)
	}
	if closing["fii1"] != 100 {
		t.Errorf("closing[fii1] = %v, want 100 (preço de partida, nenhum fill aconteceu)", closing["fii1"])
	}
}

func TestRunIntradayRounds_SemRodadaSorteadaNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}

	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, nil, []AssetForPricing{acaoAsset("a1", 100)}, nil, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(closing) != 0 || fills != 0 {
		t.Fatalf("closing=%v fills=%d, want vazio/0 sem rodada nenhuma sorteada", closing, fills)
	}
}

func TestRunIntradayRounds_FechamentoUsaUltimoFillDeTodasAsRodadas(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{
		{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)},
		{UserID: "22222222-2222-2222-2222-222222222222", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}},
	}}
	svc.priceHistory = &fakePriceHistoryReader{}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{fillPrice: 105}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{acaoAsset("a1", 100)}

	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 3, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if closing["a1"] != 105 {
		t.Errorf("closing[a1] = %v, want 105 (preço do último fill)", closing["a1"])
	}
	// Ruído (1 decisão por rodada, 2 rodadas) + Market Maker (2 decisões:
	// compra e venda) em cada rodada e na passada final (P.4) — 2 + 6 = 8
	// submissões, todas preenchidas (fillPrice > 0).
	if fills != 8 {
		t.Errorf("fills = %d, want 8", fills)
	}
	if len(submitter.submitted) != 8 {
		t.Fatalf("len(submitted) = %d, want 8", len(submitter.submitted))
	}
	for _, s := range submitter.submitted {
		if s.req.AssetID != "a1" {
			t.Errorf("ordem submetida pro ativo %q, want a1", s.req.AssetID)
		}
	}
}

// TestRunIntradayRounds_PrimeiraOrdemReaproveitaContextoJaCarregado cobre o
// achado de review "LoadContext duplicado por decisão de bot" (Fase E do
// backlog-motor-mercado-realista): decisionInputFor já carrega o
// orderexecution.Context antes de bot.Decide rodar, então a primeira ordem
// de cada bot/rodada não precisa que orderSubmitter releia o mesmo contexto
// — só a segunda ordem em diante (ArchetypeMarketMaker, que pode decidir
// comprar e vender na mesma rodada) precisa de fato recarregar, porque o
// fill da primeira ordem pode ter mudado saldo/posição.
func TestRunIntradayRounds_PrimeiraOrdemReaproveitaContextoJaCarregado(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{
		{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}},
	}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{fillPrice: 105}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{acaoAsset("a1", 100)}

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 3, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	// Market Maker decide 2 ordens por vez, em 2 rodadas mais a passada final
	// (P.4): a primeira ordem de cada vez reaproveita o contexto
	// (SubmitWithContext), a segunda recarrega (Submit).
	if submitter.submitWithContextCalls != 3 {
		t.Errorf("submitWithContextCalls = %d, want 3 (uma por vez, só a primeira ordem)", submitter.submitWithContextCalls)
	}
	if len(submitter.submitted) != 6 {
		t.Fatalf("len(submitted) = %d, want 6 (2 ordens x 3 vezes)", len(submitter.submitted))
	}
}

func TestRunIntradayRounds_SemFillMantemPrecoAnterior(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{} // fillPrice = 0: ordem sempre fica pendurada, sem fill

	assets := []AssetForPricing{acaoAsset("a1", 100)}

	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if closing["a1"] != 100 {
		t.Errorf("closing[a1] = %v, want 100 (preço de partida, nenhum fill aconteceu)", closing["a1"])
	}
	if fills != 0 {
		t.Errorf("fills = %d, want 0", fills)
	}
}

func TestRunIntradayRounds_BotInelegivelNuncaESubmetido(t *testing.T) {
	// fakeBotRoster já simula a exclusão de bot inativo/humano — quem decide
	// quem entra na lista é BotRoster.ListEligibleForTradingRound (Fase A.4/
	// D.2); aqui só confirmamos que runIntradayRounds nunca submete nada além
	// do que o roster devolveu.
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: nil} // roster vazio (todo bot inativo/inexistente)
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{fillPrice: 105}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{acaoAsset("a1", 100)}
	closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(submitter.submitted) != 0 || fills != 0 {
		t.Fatalf("submitted=%d fills=%d, want 0/0 com roster vazio", len(submitter.submitted), fills)
	}
	// Sem nenhum trade, o fechamento carrega o preço de partida adiante.
	if closing["a1"] != 100 {
		t.Errorf("closing[a1] = %v, want 100", closing["a1"])
	}
}

func TestRunIntradayRounds_Deterministico(t *testing.T) {
	buildService := func() (*Service, *fakeOrderSubmitter) {
		svc := newTestService(&fakeRepository{})
		svc.bots = &fakeBotRoster{bots: []BotForRound{
			{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)},
		}}
		svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
		submitter := &fakeOrderSubmitter{fillPrice: 105}
		svc.orderSubmitter = submitter
		return svc, submitter
	}

	assets := []AssetForPricing{acaoAsset("a1", 100)}

	svc1, sub1 := buildService()
	_, _, _, _, err := svc1.runIntradayRounds(context.Background(), 5, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	svc2, sub2 := buildService()
	_, _, _, _, err = svc2.runIntradayRounds(context.Background(), 5, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	if len(sub1.submitted) != len(sub2.submitted) {
		t.Fatalf("quantidade de ordens submetidas difere entre execuções idênticas: %d vs %d", len(sub1.submitted), len(sub2.submitted))
	}
	for i := range sub1.submitted {
		if sub1.submitted[i].req != sub2.submitted[i].req {
			t.Fatalf("ordem %d difere entre execuções idênticas: %+v vs %+v", i, sub1.submitted[i].req, sub2.submitted[i].req)
		}
	}
}

func TestRunIntradayRounds_PropagaErroDeListEligibleForTradingRound(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{listErr: errors.New("falha de conexão")}

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err == nil {
		t.Fatal("err = nil, want erro propagado de ListEligibleForTradingRound")
	}
}

// TestRunIntradayRounds_FundamentalistaSemCompanyIDNuncaChamaLoadContext
// cobre a otimização do review do PR da Fase D (backlog-motor-mercado-
// realista): um bot Fundamentalista cujo ativo sorteado não tem CompanyID
// vai ser descartado de qualquer jeito (decisionInputFor, case
// ArchetypeFundamentalista) — o pre-check em fundamentalistHasCompanyContext
// deve pular a chamada de LoadContext (round trip real ao banco) em vez de
// pagar o IO pra só descartar o resultado depois.
func TestRunIntradayRounds_FundamentalistaSemCompanyIDNuncaChamaLoadContext(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeFundamentalista)}}}
	loader := &fakeOrderContextLoader{balance: 1_000_000}
	svc.orderContext = loader

	riskClass := "Conservador"
	sector := "Mineração"
	lastPrice := 100.0
	assets := []AssetForPricing{{AssetID: "a1", Type: assetTypeAcao, RiskClass: &riskClass, Sector: &sector, LastPrice: &lastPrice}} // CompanyID nil

	_, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if fills != 0 {
		t.Errorf("fills = %d, want 0 — Fundamentalista sem CompanyID nunca decide", fills)
	}
	if loader.calls != 0 {
		t.Errorf("LoadContext calls = %d, want 0 — pre-check deveria pular a chamada de IO pra bot que vai ser descartado", loader.calls)
	}
}

func TestRunIntradayRounds_PropagaErroDeLoadContext(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{loadErr: errors.New("falha de conexão")}

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err == nil {
		t.Fatal("err = nil, want erro propagado de LoadContext")
	}
}

func TestRunIntradayRounds_PropagaErroDeSubmit(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{submitErr: errors.New("falha de conexão")}

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err == nil {
		t.Fatal("err = nil, want erro propagado de Submit")
	}
}

// TestRunIntradayRounds_RejeicaoDeNegocioDoSubmitNaoAbortaOTick cobre o
// achado do review do PR da E.2: ErrInsufficientBalance/ErrInsufficientPosition/
// ErrFloatExceeded (orderexecution.Service.Submit, rejeição de negócio
// normal — ex: um bot perdeu a corrida por float/liquidez pra outro bot
// nesta mesma rodada) não podem abortar o tick inteiro como uma falha de IO
// abortaria (TestRunIntradayRounds_PropagaErroDeSubmit acima, com um erro
// genérico) — só a ordem daquele bot é descartada, mesmo contrato já
// documentado pra erro de decisão (bot.ErrNoViableOrder etc.).
func TestRunIntradayRounds_RejeicaoDeNegocioDoSubmitNaoAbortaOTick(t *testing.T) {
	for _, businessErr := range []error{
		orderexecution.ErrInsufficientBalance,
		orderexecution.ErrInsufficientPosition,
		orderexecution.ErrFloatExceeded,
		orderexecution.ErrRestingOrderNoLongerAvailable,
	} {
		t.Run(businessErr.Error(), func(t *testing.T) {
			svc := newTestService(&fakeRepository{})
			svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
			svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
			svc.orderSubmitter = &fakeOrderSubmitter{submitErr: businessErr}

			_, _, fills, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
			if err != nil {
				t.Fatalf("err = %v, want nil — rejeição de negócio só deve descartar a ordem, não abortar o tick", err)
			}
			if fills != 0 {
				t.Errorf("fills = %d, want 0 — nenhuma ordem rejeitada deveria contar como fill", fills)
			}
		})
	}
}

// TestService_Run_EventoMacroSeveroMovePrecoGradualmenteViaNegociacao é o
// teste ponta a ponta do critério de aceite da E.2: um evento macro severo
// negativo num setor move o preço dos ativos daquele setor pra baixo ao
// longo de algumas negociações reais de bot Fundamentalista — nunca por um
// salto instantâneo no momento em que o tick roda (não existe mais
// multiplicador direto, macroPriceMultiplier foi removida). financials são
// calibradas (fundamentals.BootstrapFinancialsForTargetPrice) pra que o
// preço justo SEM efeito macro comece igual a startPrice — assim qualquer
// queda observada só pode vir do deslocamento do evento, não de um
// mispricing pré-existente. Três bots com conhecimento diferente (0.9, 0.6,
// 0.3) percebem frações diferentes do mesmo evento (proposta 2.5:
// "proporcional ao nível de conhecimento") — cada negociação real desloca o
// preço um pouco mais, nunca tudo de uma vez só.
func TestService_Run_EventoMacroSeveroMovePrecoGradualmenteViaNegociacao(t *testing.T) {
	const (
		startPrice        = 100.0
		outstandingShares = 1_000_000
		selicNeutral      = 10.0 // escala 0-100, mesma convenção de selic.Config
		selicNeutralFrac  = selicNeutral / 100
	)
	riskClass := "Conservador"
	sector := "Mineração"
	companyID := "c1"
	assetID := "a1"
	shares := int64(outstandingShares)
	startPriceCopy := startPrice

	financials, err := fundamentals.BootstrapFinancialsForTargetPrice(catalog.Sector(sector), startPrice, outstandingShares, fundamentals.DefaultBaseGrowth, selicNeutralFrac)
	if err != nil {
		t.Fatalf("BootstrapFinancialsForTargetPrice: err = %v, want nil", err)
	}

	asset := AssetForPricing{
		AssetID: assetID, Type: assetTypeAcao, RiskClass: &riskClass, Sector: &sector,
		CompanyID: &companyID, LastPrice: &startPriceCopy,
	}
	company := CompanyForFundamentals{
		CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays,
		Sector: sector, LastRevenue: &financials.NetRevenue,
	}

	severePct := -25.0
	event := MacroEventForApplication{
		ID: "event-1", TriggeredOnDay: 1, DurationDays: 3, AffectsPrice: true,
		PriceEffectPct: &severePct,
		Targets:        []MacroEventTargetForApplication{{Sector: &sector}},
	}

	repo := &fakeRepository{
		assets:      []AssetForPricing{asset},
		companies:   []CompanyForFundamentals{company},
		macroEvents: []MacroEventForApplication{event},
	}

	// Selic == Selic neutra, sem choque — garante growthRate ==
	// fundamentals.DefaultBaseGrowth, o mesmo valor usado pra calibrar
	// financials acima (mesma técnica de determinismo de
	// TestAdvance_MacroEffectPctAtivoDuranteADuracao/tick_test.go).
	selicCfg := selic.Config{Neutral: selicNeutral, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	roster := []BotForRound{
		// UserID cresce na mesma ordem de conhecimento crescente (roster
		// ordenado por UserID, RNF08) — o bot de conhecimento mais baixo
		// (crença mais próxima do preço sem evento) negocia primeiro, o de
		// conhecimento mais alto (crença mais deslocada) por último. Isso
		// garante convergência monotônica dentro de cada rodada — cada bot
		// seguinte tem uma crença mais extrema que a anterior, nunca "compra
		// de volta" o que o bot anterior já vendeu — e mantém o fechamento
		// robusto mesmo que o dia sorteie mais de uma rodada (Fase D.1): o
		// último bot de cada rodada é sempre o de conhecimento mais alto,
		// então o preço sempre converge de volta pra perto da crença dele
		// ao fim de qualquer rodada, nunca fica preso num valor intermediário.
		{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustFundamentalistRoundPersonality(t, 0.3)},
		{UserID: "22222222-2222-2222-2222-222222222222", Personality: mustFundamentalistRoundPersonality(t, 0.6)},
		{UserID: "33333333-3333-3333-3333-333333333333", Personality: mustFundamentalistRoundPersonality(t, 0.9)},
	}
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}
	svc := NewService(
		repo,
		&fakeBotRoster{bots: roster},
		&fakePriceHistoryReader{},
		&fakeTradedVolumeReader{},
		&fakeOrderContextLoader{balance: 10_000_000, positions: map[string]int{assetID: 10_000}, outstandingShares: &shares},
		submitter,
		&fakeOrderLifecycleManager{},
		selicCfg,
		testIPCAConfig(),
		1,
	)

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}

	if len(submitter.submitted) < 2 {
		t.Fatalf("len(submitted) = %d, want >= 2 — o efeito precisa vir de mais de uma negociação real, não um salto único", len(submitter.submitted))
	}

	var closing float64
	found := false
	for _, q := range result.Quotes {
		if q.AssetID == assetID {
			closing = q.Price
			found = true
		}
	}
	if !found {
		t.Fatal("cotação de a1 não encontrada em Result.Quotes")
	}
	if closing >= startPrice*0.95 {
		t.Errorf("closing = %.4f, want bem abaixo de %.4f — evento severo negativo deveria mover o preço pra baixo", closing, startPrice)
	}

	distinctPrices := make(map[float64]bool)
	for _, s := range submitter.submitted {
		distinctPrices[s.req.Price] = true
	}
	if len(distinctPrices) < 2 {
		t.Errorf("preços submetidos = %v, want pelo menos 2 valores distintos — convergência precisa ser gradual (vários passos), não um único preço final repetido", distinctPrices)
	}

	// Nenhuma ordem chega perto do efeito bruto máximo (-25% cheio, sem
	// nenhuma ponderação de conhecimento) — confirma que o deslocamento
	// percebido é sempre filtrado por KnowledgeLevel, nunca o valor "cru"
	// do evento direto (nenhum dos três bots tem conhecimento 1.0).
	fullEffectPrice := startPrice * 0.75
	for _, s := range submitter.submitted {
		if s.req.Price <= fullEffectPrice+1e-6 {
			t.Errorf("ordem submetida a %.4f, <= efeito bruto máximo (%.4f) — deveria estar sempre acima, ponderado pelo conhecimento de cada bot", s.req.Price, fullEffectPrice)
		}
	}
}

// TestService_Run_RodadasDeAcaoEntramEmResultQuotesUmaVezSo é o teste ponta
// a ponta do critério de aceite da D.2: um dia simulado com N rodadas produz
// exatamente uma Quote (a de fechamento) por Ação em Result.Quotes — nunca
// uma por rodada — e IntradayFillsCount reflete os fills reais das rodadas
// intermediárias (já persistidos via orderSubmitter.Submit, reconstituíveis
// em order_book/market_events independente deste contador).
func TestService_Run_RodadasDeAcaoEntramEmResultQuotesUmaVezSo(t *testing.T) {
	repo := &fakeRepository{assets: []AssetForPricing{acaoAsset("a1", 100)}}
	svc := newTestService(repo)
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{fillPrice: 105}

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}

	quotesForA1 := 0
	for _, q := range result.Quotes {
		if q.AssetID == "a1" {
			quotesForA1++
			if q.Price != 105 {
				t.Errorf("Quote de a1 = %v, want 105", q.Price)
			}
		}
	}
	if quotesForA1 != 1 {
		t.Fatalf("len(Quotes de a1) = %d, want exatamente 1", quotesForA1)
	}
	if result.IntradayFillsCount == 0 {
		t.Error("IntradayFillsCount = 0, want > 0 (rodada com bot elegível e ordem preenchida)")
	}
	if repo.savedResult.IntradayFillsCount != result.IntradayFillsCount {
		t.Errorf("SaveTick recebeu IntradayFillsCount = %d, want %d", repo.savedResult.IntradayFillsCount, result.IntradayFillsCount)
	}
}

// findReportGrowthSeed acha, por busca (não por cálculo fechado — o ruído de
// fundamentals.NextGrowth vem de rand.NormFloat64, sem inversa simples), uma
// seed base cujo ciclo de relatório de companyID produz um crescimento
// realizado (actualGrowth) que satisfaz match em relação ao crescimento
// esperado (fundamentals.DefaultBaseGrowth — o mesmo valor que
// fundamentalsConfig sempre usa como BaseGrowth, e que ExpectedGrowth
// devolve quando Selic == Selic neutra, o cenário dos três testes F.1
// abaixo). Reimplementa a mesmíssima derivação de fundamentalsConfig/
// deterministicSeed/fundamentals.NextGrowth que Advance usa de verdade
// (tick.go) — não um mock, é o cálculo real feito adiantado, só pra
// escolher qual seed base produz a condição de ruído que cada teste precisa
// (melhor, pior ou sem surpresa) antes de rodar Service.Run com ela de
// verdade.
func findReportGrowthSeed(t *testing.T, companyID string, sector catalog.Sector, cycleIndex int, selicNeutralFrac float64, match func(surprise float64) bool) int64 {
	t.Helper()
	for candidate := int64(1); candidate < 20_000; candidate++ {
		cfg := fundamentalsConfig(candidate, companyID, sector)
		actualGrowth := fundamentals.NextGrowth(cfg, cycleIndex, selicNeutralFrac, selicNeutralFrac)
		if match(actualGrowth - fundamentals.DefaultBaseGrowth) {
			return candidate
		}
	}
	t.Fatal("nenhuma seed encontrada satisfazendo a condição de ruído do ciclo de relatório")
	return 0
}

// newReportCycleService monta o cenário comum aos três testes ponta a ponta
// da F.1 abaixo: uma única Ação/empresa, Selic == Selic neutra (isola o
// efeito em teste do desvio de crescimento realizado vs. esperado, sem
// nenhuma interferência do fator Selic da fórmula de preço justo — mesma
// técnica de isolamento já usada em
// TestService_Run_EventoMacroSeveroMovePrecoGradualmenteViaNegociacao),
// financials calibrados (fundamentals.BootstrapFinancialsForTargetPrice)
// pra que o preço justo do Fundamentalista, SEM nenhuma surpresa de
// relatório (actualGrowth == expectedGrowth exatamente), bata exatamente com
// startPrice — assim qualquer desvio observado só pode vir da surpresa do
// ciclo, nunca de um mispricing pré-existente. Um único bot Fundamentalista
// de conhecimento 1.0 (sem ruído de leitura próprio, FundamentalistMaxNoiseStdDevPct
// zerado nesse nível) garante que a única fonte de ruído restante no teste é
// a surpresa do relatório em si. state.Day é o dia imediatamente anterior ao
// de relatório (ReportFrequencyDays-1) — newDay cai exatamente no ciclo.
func newReportCycleService(t *testing.T, seed int64) (svc *Service, assetID string, startPrice float64) {
	t.Helper()
	const (
		outstandingShares = 1_000_000
		selicNeutral      = 10.0 // escala 0-100, mesma convenção de selic.Config
		selicNeutralFrac  = selicNeutral / 100
	)
	startPrice = 100.0
	riskClass := "Conservador"
	sector := "Mineração"
	companyID := "c1"
	assetID = "a1"
	shares := int64(outstandingShares)
	startPriceCopy := startPrice

	financials, err := fundamentals.BootstrapFinancialsForTargetPrice(catalog.Sector(sector), startPrice, outstandingShares, fundamentals.DefaultBaseGrowth, selicNeutralFrac)
	if err != nil {
		t.Fatalf("BootstrapFinancialsForTargetPrice: err = %v, want nil", err)
	}
	// LastRevenue é a receita ANTES do ciclo de relatório que este tick vai
	// gerar — reportEffects[companyID].NetRevenue = LastRevenue×(1+actualGrowth)
	// (tick.go); dividindo o net_revenue-alvo por (1+DefaultBaseGrowth) aqui
	// garante que, quando actualGrowth bater exatamente com
	// DefaultBaseGrowth (sem surpresa), a receita reportada bata exatamente
	// com o net_revenue que Bootstrap calibrou pra fairPrice == startPrice.
	lastRevenue := financials.NetRevenue / (1 + fundamentals.DefaultBaseGrowth)

	asset := AssetForPricing{
		AssetID: assetID, Type: assetTypeAcao, RiskClass: &riskClass, Sector: &sector,
		CompanyID: &companyID, LastPrice: &startPriceCopy,
	}
	company := CompanyForFundamentals{
		CompanyID: companyID, ReportFrequencyDays: fundamentals.DefaultReportFrequencyDays,
		Sector: sector, LastRevenue: &lastRevenue,
	}

	repo := &fakeRepository{
		state:      State{Day: fundamentals.DefaultReportFrequencyDays - 1, SelicRate: selicNeutral},
		stateFound: true,
		assets:     []AssetForPricing{asset},
		companies:  []CompanyForFundamentals{company},
	}
	selicCfg := selic.Config{Neutral: selicNeutral, ReversionSpeed: 0, Volatility: 0, Seed: 1}

	roster := []BotForRound{
		{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustFundamentalistRoundPersonality(t, 1.0)},
	}
	submitter := &fakeOrderSubmitter{fillAtRequestedPrice: true}

	svc = NewService(
		repo,
		&fakeBotRoster{bots: roster},
		&fakePriceHistoryReader{},
		&fakeTradedVolumeReader{},
		&fakeOrderContextLoader{balance: 10_000_000, positions: map[string]int{assetID: 10_000}, outstandingShares: &shares},
		submitter,
		&fakeOrderLifecycleManager{},
		selicCfg,
		testIPCAConfig(),
		seed,
	)
	return svc, assetID, startPrice
}

func closingPriceFor(result Result, assetID string) (float64, bool) {
	for _, q := range result.Quotes {
		if q.AssetID == assetID {
			return q.Price, true
		}
	}
	return 0, false
}

// TestService_Run_RelatorioMelhorQueEsperadoMovePrecoParaCimaViaNegociacao é
// um dos dois testes do critério de aceite principal da F.1: um ciclo de
// relatório com resultado MELHOR que o esperado (actualGrowth bem acima de
// fundamentals.DefaultBaseGrowth) move o preço pra cima através de
// negociação real do Fundamentalista — nunca por
// fundamentals.ReportDayPriceEffect (removida nesta tarefa).
func TestService_Run_RelatorioMelhorQueEsperadoMovePrecoParaCimaViaNegociacao(t *testing.T) {
	const selicNeutralFrac = 0.10
	seed := findReportGrowthSeed(t, "c1", catalog.SectorMineracao, 0, selicNeutralFrac, func(surprise float64) bool { return surprise > 0.02 })

	svc, assetID, startPrice := newReportCycleService(t, seed)
	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}

	closing, found := closingPriceFor(result, assetID)
	if !found {
		t.Fatal("cotação de a1 não encontrada em Result.Quotes")
	}
	if closing <= startPrice*1.01 {
		t.Errorf("closing = %.4f, want bem acima de %.4f — resultado melhor que o esperado deveria subir o preço via negociação", closing, startPrice)
	}
}

// TestService_Run_RelatorioPiorQueEsperadoMovePrecoParaBaixoViaNegociacao é
// o segundo teste do critério de aceite principal da F.1: um ciclo de
// relatório com resultado PIOR que o esperado move o preço pra baixo,
// espelhando o teste acima.
func TestService_Run_RelatorioPiorQueEsperadoMovePrecoParaBaixoViaNegociacao(t *testing.T) {
	const selicNeutralFrac = 0.10
	seed := findReportGrowthSeed(t, "c1", catalog.SectorMineracao, 0, selicNeutralFrac, func(surprise float64) bool { return surprise < -0.02 })

	svc, assetID, startPrice := newReportCycleService(t, seed)
	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}

	closing, found := closingPriceFor(result, assetID)
	if !found {
		t.Fatal("cotação de a1 não encontrada em Result.Quotes")
	}
	if closing >= startPrice*0.99 {
		t.Errorf("closing = %.4f, want bem abaixo de %.4f — resultado pior que o esperado deveria derrubar o preço via negociação", closing, startPrice)
	}
}

// TestService_Run_RelatorioSemSurpresaProduzPoucoOuNenhumMovimento fecha o
// critério de aceite da F.1: um ciclo de relatório cujo resultado bate quase
// exatamente com o esperado (actualGrowth ≈ DefaultBaseGrowth) não dá ao
// Fundamentalista nenhuma mispricing clara pra negociar
// (bot.ErrNoMispricingDetected, limiar FundamentalistMispricingThresholdPct)
// — nenhuma ordem é submetida e o preço de fechamento permanece exatamente o
// de abertura, ao contrário dos dois testes acima.
func TestService_Run_RelatorioSemSurpresaProduzPoucoOuNenhumMovimento(t *testing.T) {
	const selicNeutralFrac = 0.10
	seed := findReportGrowthSeed(t, "c1", catalog.SectorMineracao, 0, selicNeutralFrac, func(surprise float64) bool { return surprise > -0.002 && surprise < 0.002 })

	svc, assetID, startPrice := newReportCycleService(t, seed)
	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}

	closing, found := closingPriceFor(result, assetID)
	if !found {
		t.Fatal("cotação de a1 não encontrada em Result.Quotes")
	}
	if diff := closing - startPrice; diff > 1 || diff < -1 {
		t.Errorf("closing = %.4f, want perto de %.4f (desvio <= 1%%) — sem surpresa clara não deveria mover o preço de forma perceptível", closing, startPrice)
	}
}

// P.3: o Market Maker cota TODOS os ativos que cobre em toda rodada, em ordem
// por ID, sem sorteio.
func TestRunIntradayRounds_MarketMakerCotaTodaACoberturaEmTodaRodada(t *testing.T) {
	const userID = "22222222-2222-2222-2222-222222222222"
	svc := newTestService(&fakeRepository{})
	// Cobertura fora de ordem de propósito: a iteração precisa ordenar por ID.
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: userID, Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a3", "a1", "a2"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000, "a2": 10_000, "a3": 10_000}}
	submitter := &fakeOrderSubmitter{}
	svc.orderSubmitter = submitter
	svc.orderLifecycle = &fakeOrderLifecycleManager{}

	assets := []AssetForPricing{acaoAsset("a1", 100), acaoAsset("a2", 100), acaoAsset("a3", 100)}
	_, _, _, uncovered, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}

	var got []string
	for _, s := range submitter.submitted {
		if s.req.Side == orderbook.SideBuy {
			got = append(got, s.req.AssetID)
		}
	}
	// 2 rodadas e a passada final, cada uma cotando os 3 em ordem por ID.
	want := []string{"a1", "a2", "a3", "a1", "a2", "a3", "a1", "a2", "a3"}
	if len(got) != len(want) {
		t.Fatalf("ativos cotados = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("ativos cotados = %v, want %v", got, want)
		}
	}
	if uncovered != 0 {
		t.Errorf("uncovered = %d, want 0", uncovered)
	}
}

// Ativo coberto que não está no universo negociável é ignorado sem erro.
func TestRunIntradayRounds_MarketMakerIgnoraAtivoCobertoForaDoUniverso(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1", "etf-fora"}}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{fillPrice: 105}
	lifecycle := &fakeOrderLifecycleManager{}
	svc.orderLifecycle = lifecycle

	_, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	for _, c := range lifecycle.listCalls {
		if len(c) != 1 || c[0] != "a1" {
			t.Errorf("leitura em lote = %v, want só [a1] (etf-fora fica de fora)", c)
		}
	}
}

// Ativo sem Market Maker cobrindo não é cotado por ninguém e entra na contagem
// de descobertos (proposta seção 3.9).
func TestRunIntradayRounds_ContaAtivosSemCobertura(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{
		{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}},
		// Não Market Maker: CoveredAssetIDs é ignorado na contagem.
		{UserID: "bot2", Personality: mustRoundPersonality(t, bot.ArchetypeRuido), CoveredAssetIDs: []string{"a2"}},
	}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000, "a2": 10_000, "a3": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{fillPrice: 105}
	svc.orderLifecycle = &fakeOrderLifecycleManager{}

	assets := []AssetForPricing{acaoAsset("a1", 100), acaoAsset("a2", 100), acaoAsset("a3", 100)}
	_, _, _, uncovered, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if uncovered != 2 {
		t.Errorf("uncovered = %d, want 2 (a2 e a3)", uncovered)
	}
}

// Determinismo: mesma seed e mesma cobertura produzem o mesmo resultado.
func TestRunIntradayRounds_MarketMakerComCoberturaEDeterministico(t *testing.T) {
	run := func() (map[string]float64, int) {
		svc := newTestService(&fakeRepository{})
		svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1", "a2"}}}}
		svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000, "a2": 10_000}}
		svc.orderSubmitter = &fakeOrderSubmitter{fillAtRequestedPrice: true}
		svc.orderLifecycle = &fakeOrderLifecycleManager{}
		closing, _, fills, _, err := svc.runIntradayRounds(context.Background(), 4, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100), acaoAsset("a2", 100)}, map[string]CompanyRoundContext{}, 10, 10)
		if err != nil {
			t.Fatalf("err = %v", err)
		}
		return closing, fills
	}
	c1, f1 := run()
	c2, f2 := run()
	if f1 != f2 || c1["a1"] != c2["a1"] || c1["a2"] != c2["a2"] {
		t.Errorf("execuções divergem: %v/%d vs %v/%d", c1, f1, c2, f2)
	}
}

// Q.1: runIntradayRounds abre um único escopo de leitura por tick, para os
// LoadContext das rodadas não relerem dado estático do ativo e o dia simulado.
func TestRunIntradayRounds_AbreUmEscopoDeLeituraPorTick(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{
		{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)},
		{UserID: "bot2", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker), CoveredAssetIDs: []string{"a1"}},
	}}
	loader := &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderContext = loader
	svc.orderSubmitter = &fakeOrderSubmitter{fillPrice: 105}

	if _, _, _, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10); err != nil {
		t.Fatalf("err = %v", err)
	}
	if loader.scopes != 1 {
		t.Errorf("escopos = %d, want 1 (um por tick, não por rodada nem por bot)", loader.scopes)
	}
	if loader.calls < 2 {
		t.Errorf("LoadContext chamado %d vezes, esperava várias no mesmo escopo", loader.calls)
	}
}

// Q.3: o peso de sorteio de cada ativo do universo é o float vezes o preço; sem
// float conhecido o valor de mercado fica 0 (só a parte uniforme do peso).
func TestBuildEquityUniverse_ValorDeMercadoComoPeso(t *testing.T) {
	big, small := int64(1_000_000), int64(1_000)
	withFloat := acaoAsset("a1", 50)
	withFloat.OutstandingShares = &big
	smaller := acaoAsset("a2", 20)
	smaller.OutstandingShares = &small
	noFloat := acaoAsset("a3", 30)

	_, universe := buildEquityUniverse([]AssetForPricing{withFloat, smaller, noFloat})
	got := map[string]float64{}
	for _, e := range universe {
		got[e.AssetID] = e.MarketValue
	}
	if got["a1"] != 50_000_000 || got["a2"] != 20_000 || got["a3"] != 0 {
		t.Errorf("MarketValue = %v, want a1=5e7, a2=2e4, a3=0", got)
	}
}
