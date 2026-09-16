package tick

import (
	"context"
	"errors"
	"sync"
	"testing"

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
	submitted            []submittedOrder
}

func (f *fakeOrderSubmitter) Submit(_ context.Context, req orderexecution.Request) (orderexecution.Outcome, error) {
	if f.submitErr != nil {
		return orderexecution.Outcome{}, f.submitErr
	}
	f.submitted = append(f.submitted, submittedOrder{req: req})
	if f.fillAtRequestedPrice {
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
	return NewService(repo, &fakeBotRoster{}, &fakePriceHistoryReader{}, &fakeOrderContextLoader{}, &fakeOrderSubmitter{}, testSelicConfigService(), 1)
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
