package fixedincomeexecution

import (
	"context"
	"errors"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/fixedincomeposition"
	"tcc-investimentos/engine/internal/domain/ipca"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// testIPCAConfig é usada em todo teste de Service que não exercita Tesouro
// IPCA+ — os valores não importam pra esses casos (fixedincome.IsIPCAMais
// dá false, Purchase/Redeem nunca usam vnaBase/monthlyIPCA), só precisa
// ser um ipca.Config válido pra NewService.
var testIPCAConfig = ipca.DefaultConfig(1)

type fakeRepository struct {
	purchaseCtx    PurchaseContext
	purchaseCtxErr error
	redeemCtx      RedeemContext
	redeemCtxErr   error

	persistPurchaseErr    error
	persistPurchaseCalled bool
	persistedPurchaseReq  Request

	persistRedeemErr    error
	persistRedeemCalled bool
	persistedRedeemReq  RedeemRequest
}

func (f *fakeRepository) LoadPurchaseContext(_ context.Context, _, _ string) (PurchaseContext, error) {
	return f.purchaseCtx, f.purchaseCtxErr
}

func (f *fakeRepository) LoadRedeemContext(_ context.Context, _, _ string) (RedeemContext, error) {
	return f.redeemCtx, f.redeemCtxErr
}

func (f *fakeRepository) PersistPurchase(_ context.Context, req Request, _ PurchaseOutcome) error {
	f.persistPurchaseCalled = true
	f.persistedPurchaseReq = req
	return f.persistPurchaseErr
}

func (f *fakeRepository) PersistRedeem(_ context.Context, req RedeemRequest, _ RedeemOutcome) error {
	f.persistRedeemCalled = true
	f.persistedRedeemReq = req
	return f.persistRedeemErr
}

func validPurchaseContext() PurchaseContext {
	return PurchaseContext{AccountBalance: 5000, AnnualRatePct: 10, MinimumInvestment: 100, MaturityDate: simcalendar.BaseDate.AddDate(1, 0, 0)}
}

func TestService_Purchase_ExecutaEPersisteCompraValida(t *testing.T) {
	repo := &fakeRepository{purchaseCtx: validPurchaseContext()}
	svc := NewService(repo, testIPCAConfig)

	req := Request{UserID: "u1", AssetID: "a1", Amount: 2000}
	outcome, err := svc.Purchase(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.QuantityPurchased <= 0 {
		t.Errorf("QuantityPurchased = %v, want > 0", outcome.QuantityPurchased)
	}
	if !repo.persistPurchaseCalled {
		t.Fatal("PersistPurchase não foi chamado pra compra válida")
	}
	if repo.persistedPurchaseReq.UserID != "u1" {
		t.Errorf("persistedPurchaseReq.UserID = %q, want %q", repo.persistedPurchaseReq.UserID, "u1")
	}
}

func TestService_Purchase_CompraRejeitadaNaoPersisteNada(t *testing.T) {
	repo := &fakeRepository{purchaseCtx: validPurchaseContext()}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Purchase(context.Background(), Request{UserID: "u1", AssetID: "a1", Amount: 10})
	if err != ErrBelowMinimumInvestment {
		t.Fatalf("err = %v, want %v", err, ErrBelowMinimumInvestment)
	}
	if repo.persistPurchaseCalled {
		t.Error("PersistPurchase não deveria ser chamado quando Purchase rejeita")
	}
}

func TestService_Purchase_ErroAoCarregarContexto(t *testing.T) {
	repo := &fakeRepository{purchaseCtxErr: ErrAccountNotFound}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Purchase(context.Background(), Request{Amount: 100})
	if err != ErrAccountNotFound {
		t.Fatalf("err = %v, want %v", err, ErrAccountNotFound)
	}
	if repo.persistPurchaseCalled {
		t.Error("PersistPurchase não deveria ser chamado quando LoadPurchaseContext falha")
	}
}

func TestService_Purchase_ErroAoPersistir(t *testing.T) {
	repo := &fakeRepository{purchaseCtx: validPurchaseContext(), persistPurchaseErr: errors.New("falha de escrita")}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Purchase(context.Background(), Request{Amount: 2000})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de PersistPurchase")
	}
}

func TestService_Redeem_ExecutaEPersisteResgateValido(t *testing.T) {
	repo := &fakeRepository{redeemCtx: RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 0.10},
		MaturityDate:         simcalendar.BaseDate.AddDate(0, 6, 0),
		CurrentMarketRatePct: 8,
	}}
	svc := NewService(repo, testIPCAConfig)

	req := RedeemRequest{UserID: "u1", AssetID: "a1"}
	outcome, err := svc.Redeem(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.TotalValue <= 0 {
		t.Errorf("TotalValue = %v, want > 0", outcome.TotalValue)
	}
	if !repo.persistRedeemCalled {
		t.Fatal("PersistRedeem não foi chamado pra resgate válido")
	}
	if repo.persistedRedeemReq.UserID != "u1" {
		t.Errorf("persistedRedeemReq.UserID = %q, want %q", repo.persistedRedeemReq.UserID, "u1")
	}
}

func TestService_Redeem_ErroAoCarregarContextoNaoPersisteNada(t *testing.T) {
	repo := &fakeRepository{redeemCtxErr: ErrPositionNotFound}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Redeem(context.Background(), RedeemRequest{})
	if err != ErrPositionNotFound {
		t.Fatalf("err = %v, want %v", err, ErrPositionNotFound)
	}
	if repo.persistRedeemCalled {
		t.Error("PersistRedeem não deveria ser chamado quando LoadRedeemContext falha")
	}
}

func TestService_Redeem_ErroAoPersistir(t *testing.T) {
	repo := &fakeRepository{
		redeemCtx: RedeemContext{
			Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 0.10},
			MaturityDate:         simcalendar.BaseDate.AddDate(0, 6, 0),
			CurrentMarketRatePct: 8,
		},
		persistRedeemErr: errors.New("falha de escrita"),
	}
	svc := NewService(repo, testIPCAConfig)

	_, err := svc.Redeem(context.Background(), RedeemRequest{})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de PersistRedeem")
	}
}

// Tarefa S.1 (achado 022): o "agora" de Purchase/Redeem é o dia simulado do
// contexto, nunca o relógio de parede — 200 dias simulados seguidos rendem o
// Prefixado e mudam a faixa do IR regressivo (dias corridos simulados), mesmo
// que nenhum tempo real tenha passado entre a compra e o resgate.
func TestService_Redeem_UsaODiaSimuladoParaPrazoEIR(t *testing.T) {
	const purchaseDay = 0
	newRepo := func(simulatedDay int) *fakeRepository {
		return &fakeRepository{redeemCtx: RedeemContext{
			SimulatedDay: simulatedDay,
			Position:     fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 0.10},
			// 2 anos simulados de prazo, mesma Selic da compra (taxa de mercado 10%).
			MaturityDate:         simcalendar.DateOf(purchaseDay).AddDate(2, 0, 0),
			CurrentMarketRatePct: 10,
			PurchasedAt:          simcalendar.DateOf(purchaseDay),
		}}
	}
	svc := func(repo *fakeRepository) *Service { return NewService(repo, testIPCAConfig) }

	sameDay, err := svc(newRepo(purchaseDay)).Redeem(context.Background(), RedeemRequest{})
	if err != nil {
		t.Fatalf("err = %v", err)
	}
	after200, err := svc(newRepo(purchaseDay+200)).Redeem(context.Background(), RedeemRequest{})
	if err != nil {
		t.Fatalf("err = %v", err)
	}

	if sameDay.TaxRate != 0.225 {
		t.Errorf("TaxRate no dia da compra = %v, want 0.225 (0 dia decorrido)", sameDay.TaxRate)
	}
	if after200.TaxRate != 0.20 {
		t.Errorf("TaxRate após 200 dias simulados = %v, want 0.20 (faixa de 181 a 360 dias)", after200.TaxRate)
	}
	if !(after200.TotalValue > sameDay.TotalValue) {
		t.Errorf("Prefixado após 200 dias simulados (%v) deveria valer mais que no dia da compra (%v)", after200.TotalValue, sameDay.TotalValue)
	}
}

func TestRemainingBusinessDays_ContaDiasUteisReaisDoCalendarioSimulado(t *testing.T) {
	monday := simcalendar.DateOf(0)
	tests := []struct {
		name     string
		maturity time.Time
		want     int
	}{
		{"uma semana cheia", monday.AddDate(0, 0, 7), 5},
		{"segunda até sexta seguinte", monday.AddDate(0, 0, 4), 4},
		{"sexta até segunda", simcalendar.DateOf(4).AddDate(0, 0, 3), 1},
		{"fim de semana puro cai no piso de 1", simcalendar.DateOf(5).AddDate(0, 0, 1), 1},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			now := monday
			if tt.name == "sexta até segunda" {
				now = simcalendar.DateOf(4)
			}
			if tt.name == "fim de semana puro cai no piso de 1" {
				now = simcalendar.DateOf(5)
			}
			if got := remainingBusinessDays(now, tt.maturity); got != tt.want {
				t.Errorf("remainingBusinessDays = %d, want %d", got, tt.want)
			}
		})
	}
}

func TestService_MercadoFechadoNoFimDeSemanaNaoPersisteNada(t *testing.T) {
	pctx := validPurchaseContext()
	pctx.SimulatedDay = 5 // sábado
	repo := &fakeRepository{
		purchaseCtx: pctx,
		redeemCtx: RedeemContext{
			SimulatedDay: 6, // domingo
			Position:     fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 0.10},
			MaturityDate: simcalendar.BaseDate.AddDate(0, 6, 0), CurrentMarketRatePct: 8,
		},
	}
	svc := NewService(repo, testIPCAConfig)

	var closed *simcalendar.MarketClosedError
	if _, err := svc.Purchase(context.Background(), Request{UserID: "u1", AssetID: "a1", Amount: 1000}); !errors.As(err, &closed) {
		t.Fatalf("compra: err = %v, quer *MarketClosedError", err)
	}
	if _, err := svc.Redeem(context.Background(), RedeemRequest{UserID: "u1", AssetID: "a1"}); !errors.As(err, &closed) {
		t.Fatalf("resgate: err = %v, quer *MarketClosedError", err)
	}
	if repo.persistPurchaseCalled || repo.persistRedeemCalled {
		t.Error("nada pode ser gravado com o mercado fechado")
	}
}

func TestService_SandboxSegueAbertoNoFimDeSemana(t *testing.T) {
	pctx := validPurchaseContext()
	pctx.SimulatedDay, pctx.IsSandbox = 5, true
	repo := &fakeRepository{purchaseCtx: pctx}
	if _, err := NewService(repo, testIPCAConfig).Purchase(context.Background(), Request{UserID: "u1", AssetID: "a1", Amount: 1000}); err != nil {
		t.Fatalf("err = %v, sandbox deve operar no fim de semana", err)
	}
}

// Value avalia a posição pela mesma regra do resgate, sem persistir nada e sem exigir mercado aberto.
func TestService_Value_IgualAoResgateENaoPersiste(t *testing.T) {
	rctx := RedeemContext{
		SimulatedDay:         400, // fora de pregão não importa: Value não checa mercado aberto
		Position:             fixedincomeposition.Position{Quantity: 2, AveragePrice: 900, AverageRate: 0.10},
		MaturityDate:         simcalendar.BaseDate.AddDate(0, 6, 0).AddDate(1, 0, 0),
		CurrentMarketRatePct: 8,
	}
	repo := &fakeRepository{redeemCtx: rctx}
	svc := NewService(repo, testIPCAConfig)

	value, err := svc.Value(context.Background(), "u1", "a1")
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	redeemed, err := svc.Redeem(context.Background(), RedeemRequest{UserID: "u1", AssetID: "a1"})
	if err != nil {
		t.Skipf("resgate recusado neste dia simulado (%v)", err)
	}
	if value.TotalValue != redeemed.TotalValue || value.NetValue != redeemed.NetValue {
		t.Errorf("Value = %+v, Redeem = %+v, devem coincidir", value, redeemed)
	}
}

func TestService_Value_NaoPersisteNada(t *testing.T) {
	repo := &fakeRepository{redeemCtx: RedeemContext{
		Position:             fixedincomeposition.Position{Quantity: 1, AveragePrice: 900, AverageRate: 0.10},
		MaturityDate:         simcalendar.BaseDate.AddDate(0, 6, 0),
		CurrentMarketRatePct: 8,
	}}
	svc := NewService(repo, testIPCAConfig)

	if _, err := svc.Value(context.Background(), "u1", "a1"); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if repo.persistRedeemCalled {
		t.Error("Value não pode persistir")
	}
}

func TestService_Value_PosicaoInexistente(t *testing.T) {
	svc := NewService(&fakeRepository{redeemCtxErr: ErrPositionNotFound}, testIPCAConfig)

	if _, err := svc.Value(context.Background(), "u1", "a1"); err != ErrPositionNotFound {
		t.Fatalf("err = %v, want %v", err, ErrPositionNotFound)
	}
}
