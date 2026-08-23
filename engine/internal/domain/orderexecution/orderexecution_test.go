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

func TestExecute_OrdemAMercadoSemLiquidezRealUsaPrecoDeReferencia(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{ReferencePrice: 25, IncomingUserBalance: 1000}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if out.RemainingQuantity != 0 {
		t.Errorf("RemainingQuantity = %d, want 0 — ordem a mercado sempre executa por completo", out.RemainingQuantity)
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

func TestExecute_OrdemAMercadoPreferemContrapartesReaisAntesDaLiquidezSintetica(t *testing.T) {
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
	ctx := Context{ReferencePrice: 25, IncomingUserBalance: 100} // custo total 250, saldo só 100

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

func TestExecute_VendaComLiquidezSinteticaCreditaPrecoDeReferencia(t *testing.T) {
	incoming := orderbook.Order{ID: "sell-1", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{ReferencePrice: 25, IncomingUserPosition: 10}

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
