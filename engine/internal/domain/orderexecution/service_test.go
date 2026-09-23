package orderexecution

import (
	"context"
	"errors"
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

type fakeRepository struct {
	loadCtx          Context
	loadErr          error
	persistErr       error
	persistedReq     Request
	persistedOutcome Outcome
	persistCalled    bool
	persistOrderID   string
	cancelErr        error
	cancelledOrderID string
	cancelledUserID  string
	listOrders       []OrderRecord
	listOrdersErr    error
	listedUserID     string
}

func (f *fakeRepository) LoadContext(_ context.Context, _, _ string) (Context, error) {
	return f.loadCtx, f.loadErr
}

func (f *fakeRepository) Persist(_ context.Context, req Request, outcome Outcome) (string, error) {
	f.persistCalled = true
	f.persistedReq = req
	f.persistedOutcome = outcome
	return f.persistOrderID, f.persistErr
}

func (f *fakeRepository) CancelOrder(_ context.Context, orderID, userID string) error {
	f.cancelledOrderID = orderID
	f.cancelledUserID = userID
	return f.cancelErr
}

func (f *fakeRepository) ListOrders(_ context.Context, userID string) ([]OrderRecord, error) {
	f.listedUserID = userID
	return f.listOrders, f.listOrdersErr
}

func TestService_Submit_ExecutaEPersisteOrdemValida(t *testing.T) {
	// Sandbox: true só pra exercitar um cenário de execução garantida sem
	// precisar montar liquidez real (tarefa A.2 — Mercado Ao Vivo não tem
	// mais preenchimento sintético; este teste valida a orquestração de
	// Service.Submit, não a mecânica de liquidez em si, que já tem
	// cobertura própria em orderexecution_test.go).
	repo := &fakeRepository{loadCtx: Context{ReferencePrice: 25, IncomingUserBalance: 1000, Sandbox: true}}
	svc := NewService(repo)

	req := Request{UserID: "u1", AssetID: "a1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	outcome, err := svc.Submit(context.Background(), req)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.FilledQuantity != 10 {
		t.Errorf("FilledQuantity = %d, want 10", outcome.FilledQuantity)
	}
	if !repo.persistCalled {
		t.Fatal("Persist não foi chamado pra ordem válida")
	}
	if repo.persistedReq.UserID != "u1" {
		t.Errorf("persistedReq.UserID = %q, want %q", repo.persistedReq.UserID, "u1")
	}
}

func TestService_Submit_OrdemRejeitadaNaoPersisteNada(t *testing.T) {
	repo := &fakeRepository{loadCtx: Context{ReferencePrice: 25, IncomingUserBalance: 1, Sandbox: true}}
	svc := NewService(repo)

	req := Request{UserID: "u1", AssetID: "a1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	_, err := svc.Submit(context.Background(), req)
	if err != ErrInsufficientBalance {
		t.Fatalf("err = %v, want %v", err, ErrInsufficientBalance)
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado quando Execute rejeita a ordem")
	}
}

func TestService_Submit_ErroAoCarregarContexto(t *testing.T) {
	repo := &fakeRepository{loadErr: errors.New("falha de leitura")}
	svc := NewService(repo)

	_, err := svc.Submit(context.Background(), Request{Type: orderbook.TypeMarket, Quantity: 1})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de LoadContext")
	}
	if repo.persistCalled {
		t.Error("Persist não deveria ser chamado quando LoadContext falha")
	}
}

// TestService_SubmitWithContext_NaoChamaLoadContext cobre o achado de review
// "runIntradayRounds carrega o mesmo contexto duas vezes": um chamador que já
// tem um Context válido (ex: tick.runIntradayRounds, que já leu via
// OrderContextLoader.LoadContext pra montar a decisão do bot) usa
// SubmitWithContext pra pular a releitura redundante — Execute/Persist
// seguem no mesmo caminho de Submit, só o LoadContext é evitado.
func TestService_SubmitWithContext_NaoChamaLoadContext(t *testing.T) {
	repo := &fakeRepository{loadErr: errors.New("LoadContext não deveria ser chamado")}
	svc := NewService(repo)

	execCtx := Context{ReferencePrice: 25, IncomingUserBalance: 1000, Sandbox: true}
	req := Request{UserID: "u1", AssetID: "a1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}

	outcome, err := svc.SubmitWithContext(context.Background(), req, execCtx)
	if err != nil {
		t.Fatalf("err = %v, want nil (LoadContext nunca deveria ser consultado)", err)
	}
	if outcome.FilledQuantity != 10 {
		t.Errorf("FilledQuantity = %d, want 10", outcome.FilledQuantity)
	}
	if !repo.persistCalled {
		t.Fatal("Persist não foi chamado pra ordem válida")
	}
}

// TestService_SubmitWithContext_CarimbaSimulatedDayDoContexto cobre o
// achado 005 parte A (pontos-em-aberto-decisao-produto.md): SimulatedDay
// persistido vem sempre de execCtx.SimulatedDay (a leitura fresca de
// market_calendar.current_day feita por Repository.LoadContext), nunca do
// valor que o chamador já tinha em Request — nem tick.runIntradayRounds
// (que não preenche SimulatedDay, achado 005 parte A.2) nem qualquer outro
// chamador precisam saber o dia simulado corrente de antemão.
func TestService_SubmitWithContext_CarimbaSimulatedDayDoContexto(t *testing.T) {
	repo := &fakeRepository{}
	svc := NewService(repo)

	execCtx := Context{ReferencePrice: 25, IncomingUserBalance: 1000, Sandbox: true, SimulatedDay: 7}
	req := Request{UserID: "u1", AssetID: "a1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10, SimulatedDay: 999}

	if _, err := svc.SubmitWithContext(context.Background(), req, execCtx); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if repo.persistedReq.SimulatedDay != 7 {
		t.Errorf("persistedReq.SimulatedDay = %d, want 7 (do Context, não do valor que o chamador já tinha em req)", repo.persistedReq.SimulatedDay)
	}
}

// TestService_Cancel_RepassaProRepositorio cobre a tarefa O.1: Cancel não
// tem regra de domínio própria (nenhum recálculo de book/saldo/posição),
// só repassa orderID/userID pro repositório, que decide dono/status.
func TestService_Cancel_RepassaProRepositorio(t *testing.T) {
	repo := &fakeRepository{}
	svc := NewService(repo)

	if err := svc.Cancel(context.Background(), "order-1", "user-1"); err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if repo.cancelledOrderID != "order-1" || repo.cancelledUserID != "user-1" {
		t.Errorf("CancelOrder chamado com (%q, %q), want (%q, %q)", repo.cancelledOrderID, repo.cancelledUserID, "order-1", "user-1")
	}
}

func TestService_Cancel_PropagaErroDoRepositorio(t *testing.T) {
	repo := &fakeRepository{cancelErr: ErrOrderNotCancellable}
	svc := NewService(repo)

	if err := svc.Cancel(context.Background(), "order-1", "user-1"); err != ErrOrderNotCancellable {
		t.Fatalf("err = %v, want %v", err, ErrOrderNotCancellable)
	}
}

// TestService_SubmitWithContext_PropagaOrderIDDoRepositorio cobre a tarefa
// O.3 (achado 012): Outcome.OrderID devolvido pro chamador é sempre o id
// que Repository.Persist devolveu, nunca algo calculado localmente.
func TestService_SubmitWithContext_PropagaOrderIDDoRepositorio(t *testing.T) {
	repo := &fakeRepository{persistOrderID: "order-123"}
	svc := NewService(repo)

	execCtx := Context{ReferencePrice: 25, IncomingUserBalance: 1000, Sandbox: true}
	req := Request{UserID: "u1", AssetID: "a1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}

	outcome, err := svc.SubmitWithContext(context.Background(), req, execCtx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if outcome.OrderID != "order-123" {
		t.Errorf("OrderID = %q, want %q", outcome.OrderID, "order-123")
	}
}

// TestService_ListOrders_RepassaProRepositorio cobre a tarefa O.3: sem
// regra de domínio própria, ListOrders só repassa userID pro repositório.
func TestService_ListOrders_RepassaProRepositorio(t *testing.T) {
	want := []OrderRecord{{ID: "o1"}, {ID: "o2"}}
	repo := &fakeRepository{listOrders: want}
	svc := NewService(repo)

	got, err := svc.ListOrders(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(got) != 2 || got[0].ID != "o1" || got[1].ID != "o2" {
		t.Errorf("ListOrders = %+v, want %+v", got, want)
	}
	if repo.listedUserID != "user-1" {
		t.Errorf("listedUserID = %q, want %q", repo.listedUserID, "user-1")
	}
}

func TestService_ListOrders_PropagaErroDoRepositorio(t *testing.T) {
	repo := &fakeRepository{listOrdersErr: errors.New("falha de leitura")}
	svc := NewService(repo)

	if _, err := svc.ListOrders(context.Background(), "user-1"); err == nil {
		t.Fatal("err = nil, want erro propagado de ListOrders")
	}
}

func TestService_Submit_ErroAoPersistir(t *testing.T) {
	repo := &fakeRepository{
		loadCtx:    Context{ReferencePrice: 25, IncomingUserBalance: 1000},
		persistErr: errors.New("falha de escrita"),
	}
	svc := NewService(repo)

	_, err := svc.Submit(context.Background(), Request{Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 1})
	if err == nil {
		t.Fatal("err = nil, want erro propagado de Persist")
	}
}
