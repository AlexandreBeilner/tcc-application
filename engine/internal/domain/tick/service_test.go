package tick

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/bot"
	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/orderexecution"
	"tcc-investimentos/engine/internal/domain/selic"
)

type fakeRepository struct {
	state            State
	stateFound       bool
	loadErr          error
	assets           []AssetForPricing
	listErr          error
	companies        []CompanyForFundamentals
	listCompaniesErr error
	macroEvents      []MacroEventForApplication
	listMacroErr     error
	dividendPayers   []DividendPayerAsset
	listPayersErr    error
	pendingDividends []PendingDividendPayment
	listPendingErr   error
	saveErr          error
	savedResult      Result
	saveCalls        int
}

func (f *fakeRepository) LoadState(_ context.Context) (State, bool, error) {
	return f.state, f.stateFound, f.loadErr
}

func (f *fakeRepository) ListPricingAssets(_ context.Context) ([]AssetForPricing, error) {
	return f.assets, f.listErr
}

func (f *fakeRepository) ListCompaniesForFundamentals(_ context.Context) ([]CompanyForFundamentals, error) {
	return f.companies, f.listCompaniesErr
}

func (f *fakeRepository) ListPendingMacroEvents(_ context.Context) ([]MacroEventForApplication, error) {
	return f.macroEvents, f.listMacroErr
}

func (f *fakeRepository) ListDividendPayerAssets(_ context.Context) ([]DividendPayerAsset, error) {
	return f.dividendPayers, f.listPayersErr
}

func (f *fakeRepository) ListPendingDividendPayments(_ context.Context) ([]PendingDividendPayment, error) {
	return f.pendingDividends, f.listPendingErr
}

func (f *fakeRepository) SaveTick(_ context.Context, result Result) error {
	if f.saveErr != nil {
		return f.saveErr
	}
	f.savedResult = result
	f.saveCalls++
	return nil
}

func testSelicConfigService() selic.Config {
	return selic.Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}
}

// fakeBotRoster/fakePriceHistoryReader/fakeOrderContextLoader/
// fakeOrderSubmitter (Fase D.2) — mesmo padrão de fakeRepository acima:
// campo de retorno + campo de erro, sem nenhuma dependência de banco real.
// O zero value de cada um (roster/histórico vazios) faz runIntradayRounds
// virar no-op — é assim que os testes de Run que não são sobre a Fase D.2
// continuam passando sem precisar montar um cenário de rodada inteiro.
type fakeBotRoster struct {
	bots    []BotForRound
	listErr error
}

func (f *fakeBotRoster) ListEligibleForTradingRound(_ context.Context) ([]BotForRound, error) {
	return f.bots, f.listErr
}

type fakePriceHistoryReader struct {
	prices  map[string][]float64
	readErr error
}

func (f *fakePriceHistoryReader) RecentClosingPrices(_ context.Context, assetID string, _ int) ([]float64, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	return f.prices[assetID], nil
}

type fakeOrderContextLoader struct {
	balance           float64
	positions         map[string]int
	loadErr           error
	calls             int
	outstandingShares *int64
	// scopes conta quantos escopos de leitura de tick foram abertos (Q.1).
	scopes int
}

func (f *fakeOrderContextLoader) WithReadScope(ctx context.Context) context.Context {
	f.scopes++
	return ctx
}

func (f *fakeOrderContextLoader) LoadContext(_ context.Context, assetID, _ string) (orderexecution.Context, error) {
	f.calls++
	if f.loadErr != nil {
		return orderexecution.Context{}, f.loadErr
	}
	return orderexecution.Context{
		IncomingUserBalance:  f.balance,
		IncomingUserPosition: f.positions[assetID],
		OutstandingShares:    f.outstandingShares,
	}, nil
}

// fakeTradedVolumeReader (achado 005 parte B) — mesmo padrão de
// fakePriceHistoryReader: zero value (volumes nil) faz effectiveOrderSizeCeiling
// cair pro float sozinho (sem histórico de volume ainda), preservando o
// comportamento que todo teste anterior à parte B já esperava.
type fakeTradedVolumeReader struct {
	volumes map[string][]int
	readErr error
}

func (f *fakeTradedVolumeReader) RecentTradedVolume(_ context.Context, assetID string, _ int) ([]int, error) {
	if f.readErr != nil {
		return nil, f.readErr
	}
	return f.volumes[assetID], nil
}

// fakeOrderLifecycleManager — conta chamadas de ExpireStaleOrders (com o
// currentSimulatedDay recebido, pra confirmar que Service.Run passa dayIndex)
// e simula a leitura em lote e o cancelamento por ID da manutenção de cotação
// do Market Maker (tarefa P.4), sem nenhum estado real de order_book (esse
// mecanismo só é validado ponta a ponta via docker compose — mesma convenção
// já usada por todo outro método de infra deste pacote).
type fakeOrderLifecycleManager struct {
	expireCount int
	expireErr   error
	expireCalls []int
	// resting é o que ListRestingOrders devolve por ativo (o mesmo em toda
	// chamada, sem simular fills); listCalls guarda os ativos pedidos em cada
	// chamada em lote.
	resting map[string][]bot.RestingQuote
	// restingByCall, quando preenchido, sobrepõe resting nas primeiras chamadas de
	// ListRestingOrders (índice = número da chamada), para simular o book mudando.
	restingByCall []map[string][]bot.RestingQuote
	listErr       error
	listCalls     [][]string
	cancelErr     error
	// cancelCalls guarda os IDs de cada chamada de CancelRestingOrders.
	cancelCalls [][]string
}

func (f *fakeOrderLifecycleManager) ExpireStaleOrders(_ context.Context, currentSimulatedDay int) (int, error) {
	f.expireCalls = append(f.expireCalls, currentSimulatedDay)
	if f.expireErr != nil {
		return 0, f.expireErr
	}
	return f.expireCount, nil
}

func (f *fakeOrderLifecycleManager) ListRestingOrders(_ context.Context, _ string, assetIDs []string) (map[string][]bot.RestingQuote, error) {
	call := len(f.listCalls)
	f.listCalls = append(f.listCalls, append([]string(nil), assetIDs...))
	if f.listErr != nil {
		return nil, f.listErr
	}
	if call < len(f.restingByCall) {
		return f.restingByCall[call], nil
	}
	return f.resting, nil
}

func (f *fakeOrderLifecycleManager) CancelRestingOrders(_ context.Context, orderIDs []string) error {
	f.cancelCalls = append(f.cancelCalls, append([]string(nil), orderIDs...))
	return f.cancelErr
}

type submittedOrder struct {
	req orderexecution.Request
}

type fakeOrderSubmitter struct {
	// fillPrice, quando > 0, faz todo Submit devolver um Fill único nesse
	// preço (simula a ordem casando de cara) — 0 simula uma ordem limitada
	// que só fica pendurada no book, sem fill nenhum. Ignorado quando
	// fillAtRequestedPrice é true.
	fillPrice float64
	// fillAtRequestedPrice (tarefa E.2) simula uma contraparte sempre
	// disposta a fechar no preço que o próprio bot pediu (req.Price) —
	// diferente de fillPrice (um preço fixo igual pra qualquer ordem), isso
	// deixa o preço de fechamento de cada rodada refletir de verdade a
	// estimativa do Fundamentalista que decidiu naquele momento, o insumo
	// que TestService_Run_EventoMacroSeveroMovePrecoGradualmenteViaNegociacao
	// precisa pra observar convergência real (não instantânea) ao preço
	// justo deslocado pelo evento macro.
	fillAtRequestedPrice bool
	submitErr            error
	// submitErrFn, quando não nil, decide o erro de cada submissão (nil = sem erro).
	submitErrFn func(orderexecution.Request) error
	submitted   []submittedOrder
	// submitWithContextCalls conta chamadas de SubmitWithContext em vez de
	// Submit — TestRunIntradayRounds_PrimeiraOrdemReaproveitaContextoJaCarregado
	// usa pra confirmar que a primeira ordem de cada bot/rodada reaproveita o
	// execCtx de decisionInputFor (achado de review: LoadContext duplicado).
	submitWithContextCalls int
}

func (f *fakeOrderSubmitter) Submit(_ context.Context, req orderexecution.Request) (orderexecution.Outcome, error) {
	return f.submit(req)
}

func (f *fakeOrderSubmitter) SubmitWithContext(_ context.Context, req orderexecution.Request, _ orderexecution.Context) (orderexecution.Outcome, error) {
	f.submitWithContextCalls++
	return f.submit(req)
}

func (f *fakeOrderSubmitter) submit(req orderexecution.Request) (orderexecution.Outcome, error) {
	if f.submitErr != nil {
		return orderexecution.Outcome{}, f.submitErr
	}
	if f.submitErrFn != nil {
		if err := f.submitErrFn(req); err != nil {
			return orderexecution.Outcome{}, err
		}
	}
	f.submitted = append(f.submitted, submittedOrder{req: req})
	if f.fillAtRequestedPrice {
		if req.Type == orderbook.TypeMarket {
			// Ordem a mercado (turno de piso, Q.8) não tem preço próprio: este
			// fake não simula o book, então ela só fica sem contraparte.
			return orderexecution.Outcome{RemainingQuantity: req.Quantity}, nil
		}
		return orderexecution.Outcome{
			Fills:          []orderexecution.Fill{{Price: req.Price, Quantity: req.Quantity}},
			FilledQuantity: req.Quantity,
		}, nil
	}
	if f.fillPrice <= 0 {
		return orderexecution.Outcome{RemainingQuantity: req.Quantity}, nil
	}
	return orderexecution.Outcome{
		Fills:          []orderexecution.Fill{{Price: f.fillPrice, Quantity: req.Quantity}},
		FilledQuantity: req.Quantity,
	}, nil
}

// newTestService monta um *Service pros testes que não exercitam a Fase D.2
// (rodadas de bot) — roster/histórico vazios fazem runIntradayRounds virar
// no-op (ver fakeBotRoster acima), preservando o comportamento exato que os
// testes de Advance/calendário/fundamentos/dividendos já cobriam antes desta
// tarefa.
func newTestService(repo Repository) *Service {
	return NewService(repo, &fakeBotRoster{}, &fakePriceHistoryReader{}, &fakeTradedVolumeReader{}, &fakeOrderContextLoader{}, &fakeOrderSubmitter{}, &fakeOrderLifecycleManager{}, testSelicConfigService(), testIPCAConfig(), 1)
}

func TestService_Run_PrimeiraExecucaoComecaNoDia1(t *testing.T) {
	repo := &fakeRepository{stateFound: false}
	svc := newTestService(repo)

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}
	if result.State.Day != 1 {
		t.Errorf("State.Day = %d, want 1", result.State.Day)
	}
	if result.State.SelicRate != 10 {
		t.Errorf("SelicRate = %v, want 10 (Selic neutra, sem estado anterior)", result.State.SelicRate)
	}
}

func TestService_Run_ContinuaDoEstadoPersistido(t *testing.T) {
	repo := &fakeRepository{state: State{Day: 20, SelicRate: 12}, stateFound: true}
	svc := newTestService(repo)

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}
	if result.State.Day != 21 {
		t.Errorf("State.Day = %d, want 21 (continuou do dia 20 persistido)", result.State.Day)
	}
}

func TestService_Run_PersisteOResultado(t *testing.T) {
	riskClass := "Conservador"
	repo := &fakeRepository{assets: []AssetForPricing{{AssetID: "a1", RiskClass: &riskClass}}}
	svc := newTestService(repo)

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}
	if repo.saveCalls != 1 {
		t.Fatalf("saveCalls = %d, want 1", repo.saveCalls)
	}
	if repo.savedResult.State != result.State {
		t.Errorf("SaveTick recebeu %+v, want %+v", repo.savedResult.State, result.State)
	}
}

func TestService_Run_PropagaErroDeLoadState(t *testing.T) {
	repo := &fakeRepository{loadErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de LoadState")
	}
}

func TestService_Run_PropagaErroDeListPricingAssets(t *testing.T) {
	repo := &fakeRepository{listErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListPricingAssets")
	}
}

func TestService_Run_PropagaErroDeListCompaniesForFundamentals(t *testing.T) {
	repo := &fakeRepository{listCompaniesErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListCompaniesForFundamentals")
	}
}

func TestService_Run_PropagaErroDeListPendingMacroEvents(t *testing.T) {
	repo := &fakeRepository{listMacroErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListPendingMacroEvents")
	}
}

func TestService_Run_PropagaErroDeListDividendPayerAssets(t *testing.T) {
	repo := &fakeRepository{listPayersErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListDividendPayerAssets")
	}
}

func TestService_Run_PropagaErroDeListPendingDividendPayments(t *testing.T) {
	repo := &fakeRepository{listPendingErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListPendingDividendPayments")
	}
}

func TestService_Run_PersisteFundamentalsNoDiaDeRelatorio(t *testing.T) {
	repo := &fakeRepository{
		state:      State{Day: 13, SelicRate: 10},
		stateFound: true,
		companies:  []CompanyForFundamentals{{CompanyID: "c1", ReportFrequencyDays: 14}},
	}
	svc := newTestService(repo)

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}
	if len(result.Fundamentals) != 1 {
		t.Fatalf("len(Fundamentals) = %d, want 1", len(result.Fundamentals))
	}
	if len(repo.savedResult.Fundamentals) != 1 {
		t.Errorf("SaveTick recebeu %d Fundamentals, want 1", len(repo.savedResult.Fundamentals))
	}
}

// TestService_Run_SerializaChamadasConcorrentes cobre a proteção contra o
// job diário (scheduler.RunDaily) e um POST /admin/tick concorrente
// correrem juntos (achado do review do PR da Fase D, backlog-motor-mercado-
// realista): sem Service.mu, LoadState/SaveTick de duas goroutines
// intercalariam livremente sobre o mesmo *fakeRepository — sob -race isso
// seria acusado como data race. Roda com `go test -race` pra ter valor real
// (sem -race, o teste só confirma saveCalls, não a ausência de corrida).
func TestService_Run_SerializaChamadasConcorrentes(t *testing.T) {
	repo := &fakeRepository{assets: []AssetForPricing{{AssetID: "a1"}}}
	svc := newTestService(repo)

	const goroutines = 20
	var wg sync.WaitGroup
	wg.Add(goroutines)
	for i := 0; i < goroutines; i++ {
		go func() {
			defer wg.Done()
			if _, err := svc.Run(context.Background()); err != nil {
				t.Errorf("Run() erro inesperado: %v", err)
			}
		}()
	}
	wg.Wait()

	if repo.saveCalls != goroutines {
		t.Errorf("saveCalls = %d, want %d", repo.saveCalls, goroutines)
	}
}

func TestService_Run_PropagaErroDeSaveTick(t *testing.T) {
	repo := &fakeRepository{saveErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de SaveTick")
	}
}

// TestService_Run_ExpiraOrdensObsoletasAntesDasRodadas cobre o achado 005
// parte A.3: Service.Run chama ExpireStaleOrders com currentSimulatedDay =
// dayIndex (= result.State.Day - 1 = current.Day, o mesmo dia que toda
// ordem nova deste tick carimba — ver doc de OrderLifecycleManager,
// rounds.go) antes de runIntradayRounds, e propaga a contagem devolvida
// pra Result.ExpiredOrdersCount, só pra observabilidade.
func TestService_Run_ExpiraOrdensObsoletasAntesDasRodadas(t *testing.T) {
	repo := &fakeRepository{state: State{Day: 20, SelicRate: 10}, stateFound: true}
	svc := newTestService(repo)
	lifecycle := &fakeOrderLifecycleManager{expireCount: 3}
	svc.orderLifecycle = lifecycle

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}
	if len(lifecycle.expireCalls) != 1 || lifecycle.expireCalls[0] != 20 {
		t.Fatalf("expireCalls = %v, want [20] (dayIndex = newDay(21) - 1)", lifecycle.expireCalls)
	}
	if result.ExpiredOrdersCount != 3 {
		t.Errorf("ExpiredOrdersCount = %d, want 3", result.ExpiredOrdersCount)
	}
	if repo.savedResult.ExpiredOrdersCount != 3 {
		t.Errorf("SaveTick recebeu ExpiredOrdersCount = %d, want 3", repo.savedResult.ExpiredOrdersCount)
	}
}

func TestService_Run_PropagaErroDeExpireStaleOrders(t *testing.T) {
	svc := newTestService(&fakeRepository{})
	svc.orderLifecycle = &fakeOrderLifecycleManager{expireErr: errors.New("falha de conexão")}

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ExpireStaleOrders")
	}
}

// TestService_Run_QuotesDeAcaoEmOrdemDeterministica cobre RNF08 (mesma
// seed, mesmo resultado): result.Quotes das Ações vem de closingPrices, um
// map em runIntradayRounds — sem ordenação explícita por AssetID, a ordem
// de iteração do map é aleatória a cada execução do Go, mesmo com estado/
// seed idênticos. Achado do review do PR da Fase D, backlog-motor-mercado-
// realista.
func TestService_Run_QuotesDeAcaoEmOrdemDeterministica(t *testing.T) {
	riskClass := "Conservador"
	repo := &fakeRepository{assets: []AssetForPricing{
		{AssetID: "z-acao", Type: assetTypeAcao, RiskClass: &riskClass},
		{AssetID: "a-acao", Type: assetTypeAcao, RiskClass: &riskClass},
		{AssetID: "m-acao", Type: assetTypeAcao, RiskClass: &riskClass},
	}}
	svc := newTestService(repo)

	result, err := svc.Run(context.Background())
	if err != nil {
		t.Fatalf("Run() erro inesperado: %v", err)
	}

	var acaoIDs []string
	for _, q := range result.Quotes {
		if q.AssetID == "a-acao" || q.AssetID == "m-acao" || q.AssetID == "z-acao" {
			acaoIDs = append(acaoIDs, q.AssetID)
		}
	}
	want := []string{"a-acao", "m-acao", "z-acao"}
	if len(acaoIDs) != len(want) {
		t.Fatalf("acaoIDs = %v, want %v", acaoIDs, want)
	}
	for i := range want {
		if acaoIDs[i] != want[i] {
			t.Fatalf("Quotes de Ação fora de ordem: %v, want %v (ordenado por AssetID)", acaoIDs, want)
		}
	}
}

// fakeGuard simula a trava entre processos e o instante do último tick (S.3).
type fakeGuard struct {
	locked   bool // outro processo detém a trava
	lastTick time.Time
	found    bool
	released int
}

func (g *fakeGuard) TryLockTick(_ context.Context) (func(), bool, error) {
	if g.locked {
		return nil, false, nil
	}
	return func() { g.released++ }, true, nil
}

func (g *fakeGuard) LastTickAt(_ context.Context) (time.Time, bool, error) {
	return g.lastTick, g.found, nil
}

func TestService_RunScheduled_RodaAQuantidadeDoPlanoSobATrava(t *testing.T) {
	repo := &fakeRepository{state: State{Day: 20, SelicRate: 12}, stateFound: true}
	guard := &fakeGuard{lastTick: time.Unix(1000, 0), found: true}
	svc := newTestService(repo).WithGuard(guard)

	var gotLast time.Time
	ran, err := svc.RunScheduled(context.Background(), func(last time.Time, found bool) int {
		gotLast = last
		return 3
	})
	if err != nil || ran != 3 {
		t.Fatalf("RunScheduled() = %d, %v, want 3, nil", ran, err)
	}
	if repo.saveCalls != 3 {
		t.Errorf("saveCalls = %d, want 3", repo.saveCalls)
	}
	if !gotLast.Equal(guard.lastTick) {
		t.Errorf("plan recebeu último tick %v, want %v", gotLast, guard.lastTick)
	}
	if guard.released != 1 {
		t.Errorf("trava liberada %d vez(es), want 1", guard.released)
	}
}

func TestService_RunScheduled_PlanoZeroNaoRodaNada(t *testing.T) {
	repo := &fakeRepository{state: State{Day: 20, SelicRate: 12}, stateFound: true}
	svc := newTestService(repo).WithGuard(&fakeGuard{found: true})

	ran, err := svc.RunScheduled(context.Background(), func(time.Time, bool) int { return 0 })
	if err != nil || ran != 0 || repo.saveCalls != 0 {
		t.Errorf("RunScheduled() = %d, %v (saves %d), want 0, nil, 0", ran, err, repo.saveCalls)
	}
}

func TestService_TravaOcupadaPorOutroProcesso(t *testing.T) {
	repo := &fakeRepository{state: State{Day: 20, SelicRate: 12}, stateFound: true}
	svc := newTestService(repo).WithGuard(&fakeGuard{locked: true})

	ran, err := svc.RunScheduled(context.Background(), func(time.Time, bool) int { return 1 })
	if err != nil || ran != 0 || repo.saveCalls != 0 {
		t.Errorf("agenda com trava ocupada = %d, %v (saves %d), want 0, nil, 0", ran, err, repo.saveCalls)
	}

	if _, err := svc.Run(context.Background()); !errors.Is(err, ErrTickInProgress) {
		t.Errorf("Run() manual com trava ocupada: err = %v, want ErrTickInProgress", err)
	}
	if repo.saveCalls != 0 {
		t.Errorf("saveCalls = %d, want 0 (nada gravado com a trava ocupada)", repo.saveCalls)
	}
}

// Fim de semana simulado (S.3): o calendário avança mas os bots não negociam.
func TestService_Run_FimDeSemanaSimuladoNaoRodaRodadas(t *testing.T) {
	tests := []struct {
		name      string
		stateDay  int // dia gravado; o tick gera stateDay+1
		wantTrade bool
	}{
		{"terça (dia 1)", 0, true},
		{"sexta (dia 4)", 3, true},
		{"sábado (dia 5)", 4, false},
		{"domingo (dia 6)", 5, false},
		{"segunda (dia 7)", 6, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &fakeRepository{state: State{Day: tt.stateDay, SelicRate: 10}, stateFound: true}
			result, err := newTestService(repo).Run(context.Background())
			if err != nil {
				t.Fatalf("Run() erro: %v", err)
			}
			if result.State.Day != tt.stateDay+1 {
				t.Fatalf("State.Day = %d, want %d (o calendário sempre avança)", result.State.Day, tt.stateDay+1)
			}
			if got := len(result.IntradayRounds) > 0; got != tt.wantTrade {
				t.Errorf("rodadas = %d, negocia = %v, want %v", len(result.IntradayRounds), got, tt.wantTrade)
			}
		})
	}
}

// exclusiveGuard imita a trava consultiva entre processos: um único dono por vez,
// compartilhado por dois Service (duas "instâncias").
type exclusiveGuard struct {
	mu   sync.Mutex
	held bool
}

func (g *exclusiveGuard) TryLockTick(_ context.Context) (func(), bool, error) {
	g.mu.Lock()
	defer g.mu.Unlock()
	if g.held {
		return nil, false, nil
	}
	g.held = true
	return func() { g.mu.Lock(); g.held = false; g.mu.Unlock() }, true, nil
}

func (g *exclusiveGuard) LastTickAt(_ context.Context) (time.Time, bool, error) {
	return time.Time{}, false, nil
}

// blockingRepo segura SaveTick até liberar, pra manter um tick "em andamento".
type blockingRepo struct {
	*fakeRepository
	entered chan struct{}
	release chan struct{}
}

func (b *blockingRepo) SaveTick(ctx context.Context, r Result) error {
	close(b.entered)
	<-b.release
	return b.fakeRepository.SaveTick(ctx, r)
}

// Um POST /admin/tick (Run) e a agenda de outra instância durante um tick em
// andamento nunca rodam junto: o manual recebe ErrTickInProgress, a agenda pula
// sem erro, e depois da liberação o próximo consegue rodar (tarefa S.3).
func TestService_TickAgendadoEmAndamentoBloqueiaManualEOutraInstancia(t *testing.T) {
	guard := &exclusiveGuard{}
	repoA := &blockingRepo{fakeRepository: &fakeRepository{state: State{Day: 20, SelicRate: 12}, stateFound: true}, entered: make(chan struct{}), release: make(chan struct{})}
	repoB := &fakeRepository{state: State{Day: 20, SelicRate: 12}, stateFound: true}
	instanceA := newTestService(repoA).WithGuard(guard)
	instanceB := newTestService(repoB).WithGuard(guard)

	scheduledDone := make(chan int, 1)
	go func() {
		n, _ := instanceA.RunScheduled(context.Background(), func(time.Time, bool) int { return 1 })
		scheduledDone <- n
	}()
	<-repoA.entered // o tick agendado da instância A está dentro do SaveTick, com a trava

	if _, err := instanceB.Run(context.Background()); !errors.Is(err, ErrTickInProgress) {
		t.Errorf("POST manual durante o tick agendado: err = %v, want ErrTickInProgress", err)
	}
	if n, err := instanceB.RunScheduled(context.Background(), func(time.Time, bool) int { return 1 }); n != 0 || err != nil {
		t.Errorf("agenda da outra instância = %d, %v, want 0, nil", n, err)
	}
	if repoB.saveCalls != 0 {
		t.Errorf("a instância B gravou %d tick(s) com a trava ocupada, want 0", repoB.saveCalls)
	}

	close(repoA.release)
	if n := <-scheduledDone; n != 1 {
		t.Fatalf("tick agendado rodou %d, want 1", n)
	}
	if _, err := instanceB.Run(context.Background()); err != nil {
		t.Errorf("depois da liberação o manual deveria rodar: %v", err)
	}
}
