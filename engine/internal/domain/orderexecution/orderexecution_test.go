package orderexecution

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/orderbook"
	"tcc-investimentos/engine/internal/domain/position"
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

// TestExecute_NuncaCasaContraOrdemPenduradaDoMesmoUsuario cobre a
// prevenção de self-trade (achado do review do PR da Fase D,
// backlog-motor-mercado-realista): um bot que ainda tem ordem pendurada de
// uma rodada anterior nunca deve executar contra si mesmo quando o preço se
// move o bastante pra cruzar — isso corromperia average_price (ApplyBuy
// recalcula preço médio ponderado, ApplySell não) e criaria um trade sem
// contraparte real de fato em market_events.
func TestExecute_NuncaCasaContraOrdemPenduradaDoMesmoUsuario(t *testing.T) {
	incoming := orderbook.Order{ID: "buy-1", UserID: "bot-1", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: 5}
	ctx := Context{
		ReferencePrice: 25,
		Resting: []RestingOrder{
			{ID: "ask-proprio", UserID: "bot-1", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 5},
			{ID: "ask-outro", UserID: "bot-2", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 21, RemainingQuantity: 5},
		},
		IncomingUserBalance: 1000,
	}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(out.Fills) != 1 {
		t.Fatalf("Fills = %+v, want 1 fill — a própria oferta (melhor preço) deve ser pulada, não bloquear o casamento inteiro", out.Fills)
	}
	if out.Fills[0].CounterpartyOrderID != "ask-outro" || out.Fills[0].CounterpartyUserID != "bot-2" {
		t.Errorf("fill inesperado, want contraparte ask-outro/bot-2: %+v", out.Fills[0])
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
	ctx := Context{
		ReferencePrice: 25,
		Resting: []RestingOrder{
			// Liquidez real suficiente pra preencher a ordem inteira — sem
			// isso a ordem simplesmente não executaria nada em vez de ser
			// rejeitada por posição insuficiente (mesmo raciocínio da tarefa
			// A.2 já aplicado ao teste equivalente do lado da compra,
			// TestExecute_CompraRejeitadaPorSaldoInsuficiente).
			{ID: "bid-1", UserID: "user-comprador", Side: orderbook.SideBuy, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 10},
		},
		IncomingUserPosition: 3,
	}

	_, err := Execute(incoming, ctx)
	if err != ErrInsufficientPosition {
		t.Errorf("err = %v, want %v", err, ErrInsufficientPosition)
	}
}

// TestExecute_VendaParcialDentroDaPosicaoNaoEhRejeitada cobre a correção da
// asymmetria com o lado da compra: validateFunds deve validar a posição
// contra o que de fato foi preenchido (fills), não contra incoming.Quantity
// — profundidade real insuficiente já limita naturalmente quanto executa
// (TestExecute_OrdemAMercadoExecutaSoAPorcaoComContrapartesReais, lado da
// compra), então uma venda que pede mais do que o usuário tem, mas só acha
// contraparte real pra uma quantidade dentro da posição, deve executar essa
// parte em vez de ser rejeitada por inteiro.
func TestExecute_VendaParcialDentroDaPosicaoNaoEhRejeitada(t *testing.T) {
	incoming := orderbook.Order{ID: "sell-1", Side: orderbook.SideSell, Type: orderbook.TypeMarket, Quantity: 10}
	ctx := Context{
		ReferencePrice: 25,
		Resting: []RestingOrder{
			{ID: "bid-1", UserID: "user-comprador", Side: orderbook.SideBuy, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 2},
		},
		IncomingUserPosition: 3,
	}

	out, err := Execute(incoming, ctx)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if out.FilledQuantity != 2 || out.RemainingQuantity != 8 {
		t.Errorf("FilledQuantity/RemainingQuantity = %d/%d, want 2/8", out.FilledQuantity, out.RemainingQuantity)
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

// TestExecute_FloatFinito cobre o critério de aceite da tarefa A.3: a soma
// de posições de todos os detentores nunca pode exceder outstanding_shares
// depois de aplicar o efeito da ordem recebida.
func TestExecute_FloatFinito(t *testing.T) {
	outstandingShares := int64(1_000_000)

	tests := []struct {
		name    string
		side    orderbook.Side
		ctx     Context
		wantErr error
	}{
		{
			name: "compra que preserva o teto é aceita",
			side: orderbook.SideBuy,
			ctx: Context{
				ReferencePrice: 25,
				Resting: []RestingOrder{
					{ID: "ask-1", UserID: "user-vendedor", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 10},
				},
				IncomingUserBalance:        10_000,
				IncomingUserPosition:       0,
				OutstandingShares:          &outstandingShares,
				TotalHeldExcludingIncoming: 999_990, // resto do float já distribuído, exceto os 10 que trocam de mão aqui
			},
			wantErr: nil,
		},
		{
			name: "venda que preserva o teto é aceita",
			side: orderbook.SideSell,
			ctx: Context{
				ReferencePrice: 25,
				Resting: []RestingOrder{
					{ID: "bid-1", UserID: "user-comprador", Side: orderbook.SideBuy, Type: orderbook.TypeLimit, Price: 25, RemainingQuantity: 10},
				},
				IncomingUserPosition:       10,
				OutstandingShares:          &outstandingShares,
				TotalHeldExcludingIncoming: 999_990,
			},
			wantErr: nil,
		},
		{
			name: "estado corrompido (distribuição inicial estourando o float) é rejeitado",
			side: orderbook.SideBuy,
			ctx: Context{
				ReferencePrice: 25,
				Resting: []RestingOrder{
					{ID: "ask-1", UserID: "user-vendedor", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 10},
				},
				IncomingUserBalance:  10_000,
				IncomingUserPosition: 0,
				OutstandingShares:    &outstandingShares,
				// soma já ultrapassa o teto antes mesmo da ordem entrar —
				// só possível por uma distribuição inicial malformada
				// (Fase B), nunca por uma ordem legítima.
				TotalHeldExcludingIncoming: 1_000_001,
			},
			wantErr: position.ErrFloatExceeded,
		},
		{
			name: "sem OutstandingShares (ex: sandbox) a checagem é pulada",
			side: orderbook.SideBuy,
			ctx: Context{
				ReferencePrice: 25,
				Resting: []RestingOrder{
					{ID: "ask-1", UserID: "user-vendedor", Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: 20, RemainingQuantity: 10},
				},
				IncomingUserBalance:        10_000,
				OutstandingShares:          nil,
				TotalHeldExcludingIncoming: 999_999_999, // valor absurdo, mas ignorado sem o teto
			},
			wantErr: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			incoming := orderbook.Order{ID: "incoming", Side: tt.side, Type: orderbook.TypeMarket, Quantity: 10}
			_, err := Execute(incoming, tt.ctx)
			if err != tt.wantErr {
				t.Errorf("err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

// TestExecute_FloatFinito_PreservaInvarianteAoLongoDeSequencia cobre o
// critério de aceite da tarefa A.3 na forma de sequência: parte de uma
// distribuição inicial cuja soma bate exatamente com outstandingShares
// (simulando o resultado da Fase B) e roda várias execuções reais em
// sequência (holdings atualizados a cada trade, alimentando o Context da
// próxima) — a soma total nunca deveria mudar, muito menos exceder o
// float, porque cada trade só transfere quantidade já existente entre duas
// contas.
func TestExecute_FloatFinito_PreservaInvarianteAoLongoDeSequencia(t *testing.T) {
	outstandingShares := int64(100)
	holdings := map[string]int{"acc-a": 60, "acc-b": 30, "acc-c": 10}

	sumHoldings := func() int64 {
		var total int64
		for _, q := range holdings {
			total += int64(q)
		}
		return total
	}

	if sumHoldings() != outstandingShares {
		t.Fatalf("setup inválido: soma inicial = %d, want %d", sumHoldings(), outstandingShares)
	}

	trades := []struct {
		buyer, seller string
		quantity      int
		price         float64
	}{
		{buyer: "acc-b", seller: "acc-a", quantity: 20, price: 10},
		{buyer: "acc-c", seller: "acc-b", quantity: 15, price: 12},
		{buyer: "acc-a", seller: "acc-c", quantity: 5, price: 11},
	}

	for i, tr := range trades {
		ctx := Context{
			ReferencePrice: tr.price,
			Resting: []RestingOrder{
				{ID: "ask", UserID: tr.seller, Side: orderbook.SideSell, Type: orderbook.TypeLimit, Price: tr.price, RemainingQuantity: holdings[tr.seller]},
			},
			IncomingUserBalance:        1_000_000,
			IncomingUserPosition:       holdings[tr.buyer],
			OutstandingShares:          &outstandingShares,
			TotalHeldExcludingIncoming: sumHoldings() - int64(holdings[tr.buyer]),
		}
		incoming := orderbook.Order{ID: "incoming", Side: orderbook.SideBuy, Type: orderbook.TypeMarket, Quantity: tr.quantity}

		out, err := Execute(incoming, ctx)
		if err != nil {
			t.Fatalf("trade %d: err = %v, want nil", i, err)
		}
		if out.FilledQuantity != tr.quantity {
			t.Fatalf("trade %d: FilledQuantity = %d, want %d", i, out.FilledQuantity, tr.quantity)
		}

		holdings[tr.buyer] += tr.quantity
		holdings[tr.seller] -= tr.quantity

		if got := sumHoldings(); got > outstandingShares {
			t.Fatalf("trade %d: soma total = %d excede outstandingShares = %d", i, got, outstandingShares)
		}
		if got := sumHoldings(); got != outstandingShares {
			t.Errorf("trade %d: soma total = %d, want %d (transferência deveria ser zero-sum)", i, got, outstandingShares)
		}
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
