package tick

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/fundamentals"
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

func twoIntradayRounds() []IntradayRound {
	return []IntradayRound{{SequenceIndex: 0, TimeOfDay: 0.3}, {SequenceIndex: 1, TimeOfDay: 0.7}}
}

func TestRunIntradayRounds_SemAcaoNoUniversoNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}

	closing, fills, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), nil, nil, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(closing) != 0 || fills != 0 {
		t.Fatalf("closing=%v fills=%d, want vazio/0 sem nenhuma Ação no universo", closing, fills)
	}
}

func TestRunIntradayRounds_SemRodadaSorteadaNaoFazNada(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}

	closing, fills, err := svc.runIntradayRounds(context.Background(), 0, nil, []AssetForPricing{acaoAsset("a1", 100)}, nil, 10, 10)
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
		{UserID: "22222222-2222-2222-2222-222222222222", Personality: mustRoundPersonality(t, bot.ArchetypeMarketMaker)},
	}}
	svc.priceHistory = &fakePriceHistoryReader{}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	submitter := &fakeOrderSubmitter{fillPrice: 105}
	svc.orderSubmitter = submitter

	assets := []AssetForPricing{acaoAsset("a1", 100)}

	closing, fills, err := svc.runIntradayRounds(context.Background(), 3, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if closing["a1"] != 105 {
		t.Errorf("closing[a1] = %v, want 105 (preço do último fill)", closing["a1"])
	}
	// Ruído (1 decisão) + Market Maker (2 decisões: compra e venda) por
	// rodada, 2 rodadas — 6 submissões, todas preenchidas (fillPrice > 0).
	if fills != 6 {
		t.Errorf("fills = %d, want 6", fills)
	}
	if len(submitter.submitted) != 6 {
		t.Fatalf("len(submitted) = %d, want 6", len(submitter.submitted))
	}
	for _, s := range submitter.submitted {
		if s.req.AssetID != "a1" {
			t.Errorf("ordem submetida pro ativo %q, want a1", s.req.AssetID)
		}
	}
}

func TestRunIntradayRounds_SemFillMantemPrecoAnterior(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "11111111-1111-1111-1111-111111111111", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{} // fillPrice = 0: ordem sempre fica pendurada, sem fill

	assets := []AssetForPricing{acaoAsset("a1", 100)}

	closing, fills, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
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
	closing, fills, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
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
	_, _, err := svc1.runIntradayRounds(context.Background(), 5, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	svc2, sub2 := buildService()
	_, _, err = svc2.runIntradayRounds(context.Background(), 5, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
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

	_, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
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

	_, fills, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), assets, map[string]CompanyRoundContext{}, 10, 10)
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

	_, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
	if err == nil {
		t.Fatal("err = nil, want erro propagado de LoadContext")
	}
}

func TestRunIntradayRounds_PropagaErroDeSubmit(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
	svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
	svc.orderSubmitter = &fakeOrderSubmitter{submitErr: errors.New("falha de conexão")}

	_, _, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
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
	} {
		t.Run(businessErr.Error(), func(t *testing.T) {
			svc := newTestService(&fakeRepository{})
			svc.bots = &fakeBotRoster{bots: []BotForRound{{UserID: "bot1", Personality: mustRoundPersonality(t, bot.ArchetypeRuido)}}}
			svc.orderContext = &fakeOrderContextLoader{balance: 1_000_000, positions: map[string]int{"a1": 10_000}}
			svc.orderSubmitter = &fakeOrderSubmitter{submitErr: businessErr}

			_, fills, err := svc.runIntradayRounds(context.Background(), 0, twoIntradayRounds(), []AssetForPricing{acaoAsset("a1", 100)}, map[string]CompanyRoundContext{}, 10, 10)
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

	financials, err := fundamentals.BootstrapFinancialsForTargetPrice(startPrice, outstandingShares, fundamentals.DefaultBaseGrowth, selicNeutralFrac)
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
		&fakeOrderContextLoader{balance: 10_000_000, positions: map[string]int{assetID: 10_000}, outstandingShares: &shares},
		submitter,
		selicCfg,
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
