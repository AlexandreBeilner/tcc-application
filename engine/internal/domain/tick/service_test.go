package tick

import (
	"context"
	"errors"
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
	balance   float64
	positions map[string]int
	loadErr   error
}

func (f *fakeOrderContextLoader) LoadContext(_ context.Context, assetID, _ string) (orderexecution.Context, error) {
	if f.loadErr != nil {
		return orderexecution.Context{}, f.loadErr
	}
	return orderexecution.Context{IncomingUserBalance: f.balance, IncomingUserPosition: f.positions[assetID]}, nil
}

type submittedOrder struct {
	req orderexecution.Request
}

type fakeOrderSubmitter struct {
	// fillPrice, quando > 0, faz todo Submit devolver um Fill único nesse
	// preço (simula a ordem casando de cara) — 0 simula uma ordem limitada
	// que só fica pendurada no book, sem fill nenhum.
	fillPrice float64
	submitErr error
	submitted []submittedOrder
}

func (f *fakeOrderSubmitter) Submit(_ context.Context, req orderexecution.Request) (orderexecution.Outcome, error) {
	if f.submitErr != nil {
		return orderexecution.Outcome{}, f.submitErr
	}
	f.submitted = append(f.submitted, submittedOrder{req: req})
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

func TestService_Run_PropagaErroDeSaveTick(t *testing.T) {
	repo := &fakeRepository{saveErr: errors.New("falha de conexão")}
	svc := newTestService(repo)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de SaveTick")
	}
}
