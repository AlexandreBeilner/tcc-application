package tick

import (
	"context"
	"errors"
	"testing"

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

func TestService_Run_PrimeiraExecucaoComecaNoDia1(t *testing.T) {
	repo := &fakeRepository{stateFound: false}
	svc := NewService(repo, testSelicConfigService(), 1)

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
	svc := NewService(repo, testSelicConfigService(), 1)

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
	svc := NewService(repo, testSelicConfigService(), 1)

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
	svc := NewService(repo, testSelicConfigService(), 1)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de LoadState")
	}
}

func TestService_Run_PropagaErroDeListPricingAssets(t *testing.T) {
	repo := &fakeRepository{listErr: errors.New("falha de conexão")}
	svc := NewService(repo, testSelicConfigService(), 1)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListPricingAssets")
	}
}

func TestService_Run_PropagaErroDeListCompaniesForFundamentals(t *testing.T) {
	repo := &fakeRepository{listCompaniesErr: errors.New("falha de conexão")}
	svc := NewService(repo, testSelicConfigService(), 1)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListCompaniesForFundamentals")
	}
}

func TestService_Run_PropagaErroDeListPendingMacroEvents(t *testing.T) {
	repo := &fakeRepository{listMacroErr: errors.New("falha de conexão")}
	svc := NewService(repo, testSelicConfigService(), 1)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de ListPendingMacroEvents")
	}
}

func TestService_Run_PersisteFundamentalsNoDiaDeRelatorio(t *testing.T) {
	repo := &fakeRepository{
		state:      State{Day: 13, SelicRate: 10},
		stateFound: true,
		companies:  []CompanyForFundamentals{{CompanyID: "c1", ReportFrequencyDays: 14}},
	}
	svc := NewService(repo, testSelicConfigService(), 1)

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
	svc := NewService(repo, testSelicConfigService(), 1)

	if _, err := svc.Run(context.Background()); err == nil {
		t.Fatal("Run() err = nil, want erro propagado de SaveTick")
	}
}
