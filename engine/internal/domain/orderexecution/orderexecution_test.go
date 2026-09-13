package orderexecution

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

func TestExecute_QuantidadeInvalida(t *testing.T) {
	_, err := Execute(orderbook.Order{Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 0}, Context{})
	if err != ErrInvalidQuantity {
		t.Errorf("err = %v, want %v", err, ErrInvalidQuantity)
	}
}

func TestExecute_OrdemLimitadaSemPrecoInvalida(t *testing.T) {
	_, err := Execute(orderbook.Order{Side: orderbook.SideBuy, Type: orderbook.TypeLimit, Quantity: 10, Price: 0}, Context{})
	if err != ErrInvalidPrice {
		t.Errorf("err = %v, want %v", err, ErrInvalidPrice)
	}
}

// TestExecute_OrdemAMercadoSemLiquidezRealNaoExecutaNada cobre o critério de
// aceite da tarefa A.2 (book raso, Mercado Ao Vivo): sem contraparte real
// nenhuma, a ordem a mercado não executa nada, não fica pendurada e não
// gera erro — só reporta a sobra em RemainingQuantity.
func TestExecute_OrdemAMercadoSemLiquidezRealNaoExecutaNada(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{ReferencePrice: 25, IncomingUserBalance: 1000}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if out.FilledQuantity != 0 {
		t.Errorf("FilledQuantity = %d, want 0 — book raso, sem contraparte real", out.FilledQuantity)
	}
	if out.RemainingQuantity != 10 {
		t.Errorf("RemainingQuantity = %d, want 10 — sobra sem liquidez sintética", out.RemainingQuantity)
	}
	if len(out.Fills) != 0 {
		t.Errorf("Fills = %+v, want nenhum fill (Mercado Ao Vivo não tem mais liquidez sintética)", out.Fills)
	}
}

// TestExecute_OrdemAMercadoExecutaSoAPorcaoComContrapartesReais cobre o
// critério de aceite da tarefa A.2 (execução parcial): profundidade real
// insuficiente executa só o que tem contraparte real, o resto não executa.
func TestExecute_OrdemAMercadoExecutaSoAPorcaoComContrapartesReais(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{
		ReferencePrice: 25,
		Resting: []RestingOrder{
			{ID: "ask-1", UserID: "user-vendedor", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 4},
		},
		IncomingUserBalance: 1000,
	}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(out.Fills) != 1 {
		t.Fatalf("len(Fills) = %d, want 1 (só a parte real, sem preenchimento sintético)", len(out.Fills))
	}

	real := out.Fills[0]
	if real.IsSynthetic() {
		t.Errorf("fill deveria ser real, contra ask-1")
	}
	if real.CounterpartyOrderID != "ask-1" || real.CounterpartyUserID != "user-vendedor" || real.Quantity != 4 || real.Price != 20 {
		t.Errorf("fill real inesperado: %+v", real)
	}
	if out.FilledQuantity != 4 {
		t.Errorf("FilledQuantity = %d, want 4", out.FilledQuantity)
	}
	if out.RemainingQuantity != 6 {
		t.Errorf("RemainingQuantity = %d, want 6 — sobra sem contraparte real não executa nem fica pendurada", out.RemainingQuantity)
	}
}

// TestExecute_OrdemAMercadoSandboxAindaUsaLiquidezSintetica cobre a exceção
// deliberada (proposta motor-mercado-realista 2.7): ativo sandbox continua
// com execução garantida ao preço de referência, mesmo sem nenhuma
// contraparte real — RF12/RNF08 exigem isso.
func TestExecute_OrdemAMercadoSandboxAindaUsaLiquidezSintetica(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{ReferencePrice: 25, IncomingUserBalance: 1000, Sandbox: true}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if out.RemainingQuantity != 0 {
		t.Errorf("RemainingQuantity = %d, want 0 — sandbox sempre executa por completo", out.RemainingQuantity)
	}
	if out.FilledQuantity != 10 {
		t.Errorf("FilledQuantity = %d, want 10", out.FilledQuantity)
	}
	if len(out.Fills) != 1 {
		t.Fatalf("len(Fills) = %d, want 1", len(out.Fills))
	}
	fill := out.Fills[0]
	if !fill.IsSynthetic() {
		t.Errorf("fill deveria ser sintético (sem contraparte real)")
	}
	if fill.Price != 25 {
		t.Errorf("Price = %v, want 25 (preço de referência)", fill.Price)
	}
}

// TestExecute_OrdemAMercadoSandboxPreferemContrapartesReaisAntesDaLiquidezSintetica
// confirma que, mesmo em sandbox, contraparte real (se existir) tem
// prioridade sobre a liquidez sintética.
func TestExecute_OrdemAMercadoSandboxPreferemContrapartesReaisAntesDaLiquidezSintetica(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{
		ReferencePrice: 25,
		Resting: []RestingOrder{
			{ID: "ask-1", UserID: "user-vendedor", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 4},
		},
		IncomingUserBalance: 1000,
		Sandbox:             true,
	}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(out.Fills) != 2 {
		t.Fatalf("len(Fills) = %d, want 2 (parte real + parte sintética)", len(out.Fills))
	}

	real := out.Fills[0]
	if real.IsSynthetic() {
		t.Errorf("primeiro fill deveria ser real, contra ask-1")
	}
	if real.CounterpartyOrderID != "ask-1" || real.CounterpartyUserID != "user-vendedor" || real.Quantity != 4 || real.Price != 20 {
		t.Errorf("fill real inesperado: %+v", real)
	}

	synthetic := out.Fills[1]
	if !synthetic.IsSynthetic() || synthetic.Quantity != 6 || synthetic.Price != 25 {
		t.Errorf("fill sintético inesperado: %+v", synthetic)
	}
	if out.FilledQuantity != 10 || out.RemainingQuantity != 0 {
		t.Errorf("FilledQuantity/RemainingQuantity = %d/%d, want 10/0", out.FilledQuantity, out.RemainingQuantity)
	}
}

func TestExecute_ReplayPreservaPrioridadeDeChegada(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 5}
	ctx := Context{
		ReferencePrice: 99,
		Resting: []RestingOrder{
			{ID: "ask-primeiro", UserID: "u1", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 10, RemainingQuantity: 5},
			{ID: "ask-segundo", UserID: "u2", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 10, RemainingQuantity: 5},
		},
		IncomingUserBalance: 1000,
	}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(out.Fills) != 1 {
		t.Fatalf("len(Fills) = %d, want 1", len(out.Fills))
	}
	if out.Fills[0].CounterpartyOrderID != "ask-primeiro" {
		t.Errorf("CounterpartyOrderID = %q, want %q — FIFO no empate de preço", out.Fills[0].CounterpartyOrderID, "ask-primeiro")
	}
}

func TestExecute_OrdemLimitadaResidualFicaPenduradaSemLiquidezSintetica(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeLimit, Price: 20, Quantity: 10}
	ctx := Context{
		ReferencePrice: 25,
		Resting: []RestingOrder{
			{ID: "ask-1", UserID: "user-vendedor", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 4},
		},
		IncomingUserBalance: 1000,
	}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if out.FilledQuantity != 4 {
		t.Errorf("FilledQuantity = %d, want 4", out.FilledQuantity)
	}
	if out.RemainingQuantity != 6 {
		t.Errorf("RemainingQuantity = %d, want 6 — ordem limitada não recebe preenchimento sintético", out.RemainingQuantity)
	}
	for _, f := range out.Fills {
		if f.IsSynthetic() {
			t.Errorf("nenhum fill deveria ser sintético pra ordem limitada")
		}
	}
}

func TestExecute_CompraRejeitadaPorSaldoInsuficiente(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{
		ReferencePrice: 25,
		Resting: []RestingOrder{
			// Liquidez real suficiente pra preencher a ordem inteira — sem
			// isso (Mercado Ao Vivo, tarefa A.2) a ordem simplesmente não
			// executaria nada em vez de ser rejeitada por saldo.
			{ID: "ask-1", UserID: "user-vendedor", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 30, RemainingQuantity: 10},
		},
		IncomingUserBalance: 100, // custo total real 300, saldo só 100
	}

	_, err := Execute(incoming, ctx)
	if err != ErrInsufficientBalance {
		t.Errorf("err = %v, want %v", err, ErrInsufficientBalance)
	}
}

func TestExecute_VendaRejeitadaPorPosicaoInsuficiente(t *testing.T) {
	incoming := orderbook.Order{ID: "sell-1", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{ReferencePrice: 25, IncomingUserPosition: 3}

	_, err := Execute(incoming, ctx)
	if err != ErrInsufficientPosition {
		t.Errorf("err = %v, want %v", err, ErrInsufficientPosition)
	}
}

func TestExecute_OrdemAMercadoDeVendaSemLiquidezRealNaoExecutaNada(t *testing.T) {
	incoming := orderbook.Order{ID: "sell-1", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{ReferencePrice: 25, IncomingUserPosition: 10}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if out.FilledQuantity != 0 || out.RemainingQuantity != 10 {
		t.Errorf("FilledQuantity/RemainingQuantity = %d/%d, want 0/10", out.FilledQuantity, out.RemainingQuantity)
	}
	if len(out.Fills) != 0 {
		t.Errorf("Fills = %+v, want nenhum (Mercado Ao Vivo não tem mais liquidez sintética)", out.Fills)
	}
}

func TestExecute_OrdemAMercadoDeVendaSandboxCreditaPrecoDeReferencia(t *testing.T) {
	incoming := orderbook.Order{ID: "sell-1", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{ReferencePrice: 25, IncomingUserPosition: 10, Sandbox: true}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if out.FilledQuantity != 10 || out.RemainingQuantity != 0 {
		t.Errorf("FilledQuantity/RemainingQuantity = %d/%d, want 10/0", out.FilledQuantity, out.RemainingQuantity)
	}
	if len(out.Fills) != 1 || out.Fills[0].Price != 25 {
		t.Errorf("Fills = %+v, want um fill sintético a 25", out.Fills)
	}
}
