package orderbook

import "testing"

func TestSubmit_OrdensMesmoPrecoExecutamNaOrdemDeChegada(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 5})
	book.Submit(Order{ID: "ask-2", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 5})

	trades := book.Submit(Order{ID: "buy-1", Side: SideBuy, Type: TypeMarket, Quantity: 5})

	if len(trades) != 1 {
		t.Fatalf("len(trades) = %d, want 1", len(trades))
	}
	if trades[0].SellOrderID != "ask-1" {
		t.Errorf("SellOrderID = %q, want %q — a ordem que chegou primeiro no mesmo preço devia executar primeiro", trades[0].SellOrderID, "ask-1")
	}
}

func TestSubmit_OrdemAMercadoCasaContraMelhorOferta(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "ask-caro", Side: SideSell, Type: TypeLimit, Price: 12, Quantity: 5})
	book.Submit(Order{ID: "ask-barato", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 5})

	trades := book.Submit(Order{ID: "buy-1", Side: SideBuy, Type: TypeMarket, Quantity: 5})

	if len(trades) != 1 {
		t.Fatalf("len(trades) = %d, want 1", len(trades))
	}
	if trades[0].SellOrderID != "ask-barato" {
		t.Errorf("SellOrderID = %q, want %q — ordem a mercado deve casar contra a melhor oferta (menor preço), não a mais antiga", trades[0].SellOrderID, "ask-barato")
	}
	if trades[0].Price != 10 {
		t.Errorf("Price = %v, want 10", trades[0].Price)
	}
}

func TestSubmit_PrecoDoTradeEhDaOrdemPassiva(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 5})

	trades := book.Submit(Order{ID: "buy-1", Side: SideBuy, Type: TypeLimit, Price: 15, Quantity: 5})

	if len(trades) != 1 {
		t.Fatalf("len(trades) = %d, want 1", len(trades))
	}
	if trades[0].Price != 10 {
		t.Errorf("Price = %v, want 10 (preço da ordem passiva, não os 15 ofertados pela ordem agressora)", trades[0].Price)
	}
}

func TestSubmit_LimiteQueNaoCruzaFicaNoBookSemTrade(t *testing.T) {
	var book Book

	trades := book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 5})
	if len(trades) != 0 {
		t.Fatalf("len(trades) = %d, want 0 (book vazio, nada pra casar)", len(trades))
	}

	trades = book.Submit(Order{ID: "buy-1", Side: SideBuy, Type: TypeLimit, Price: 9, Quantity: 5})
	if len(trades) != 0 {
		t.Fatalf("len(trades) = %d, want 0 — compra a 9 não cruza venda a 10", len(trades))
	}

	// Confirma que a ask-1 realmente ficou pendurada no book: uma ordem
	// que cruza depois deve casar contra ela.
	trades = book.Submit(Order{ID: "buy-2", Side: SideBuy, Type: TypeLimit, Price: 10, Quantity: 5})
	if len(trades) != 1 || trades[0].SellOrderID != "ask-1" {
		t.Fatalf("trades = %+v, want 1 trade contra ask-1", trades)
	}
}

func TestSubmit_LimiteCruzaExecutaMesmoNaoSendoAMercado(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 5})
	trades := book.Submit(Order{ID: "buy-1", Side: SideBuy, Type: TypeLimit, Price: 11, Quantity: 5})

	if len(trades) != 1 {
		t.Fatalf("len(trades) = %d, want 1 — ordem limitada que cruza o preço oposto deve executar", len(trades))
	}
}

func TestSubmit_ResidualDeOrdemLimitadaFicaNoBook(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 3})
	trades := book.Submit(Order{ID: "buy-1", Side: SideBuy, Type: TypeLimit, Price: 10, Quantity: 10})

	if len(trades) != 1 || trades[0].Quantity != 3 {
		t.Fatalf("trades = %+v, want 1 trade de quantidade 3", trades)
	}

	// buy-1 tinha 10, executou 3 contra ask-1 — os 7 residuais devem ter
	// ficado pendurados no lado de compra do book.
	trades = book.Submit(Order{ID: "ask-2", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 7})
	if len(trades) != 1 || trades[0].Quantity != 7 || trades[0].BuyOrderID != "buy-1" {
		t.Fatalf("trades = %+v, want 1 trade de quantidade 7 contra o residual de buy-1", trades)
	}
}

func TestSubmit_OrdemAMercadoSemLiquidezNaoFicaPendurada(t *testing.T) {
	var book Book

	trades := book.Submit(Order{ID: "buy-mercado", Side: SideBuy, Type: TypeMarket, Quantity: 10})
	if len(trades) != 0 {
		t.Fatalf("len(trades) = %d, want 0 (book vazio)", len(trades))
	}

	// Se o residual da ordem a mercado tivesse ficado no book (bug), esta
	// venda casaria contra ele; o comportamento correto é não casar nada,
	// porque ordem a mercado sem contraparte é descartada, não pendurada.
	trades = book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 10})
	if len(trades) != 0 {
		t.Fatalf("trades = %+v, want 0 — residual de ordem a mercado não deveria ter ficado pendurado no book", trades)
	}
}

func TestSubmit_OrdemAMercadoParcialmentePreenchidaDescartaResidual(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 4})
	trades := book.Submit(Order{ID: "buy-mercado", Side: SideBuy, Type: TypeMarket, Quantity: 10})

	if len(trades) != 1 || trades[0].Quantity != 4 {
		t.Fatalf("trades = %+v, want 1 trade de quantidade 4 (só o que o book tinha)", trades)
	}

	// Os 6 residuais da ordem a mercado não devem ter ficado pendurados.
	trades = book.Submit(Order{ID: "ask-2", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 1})
	if len(trades) != 0 {
		t.Fatalf("trades = %+v, want 0 — residual de ordem a mercado não persiste no book", trades)
	}
}

func TestSubmit_VendaCasaContraMelhorLance(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "bid-baixo", Side: SideBuy, Type: TypeLimit, Price: 8, Quantity: 5})
	book.Submit(Order{ID: "bid-alto", Side: SideBuy, Type: TypeLimit, Price: 9, Quantity: 5})

	trades := book.Submit(Order{ID: "sell-mercado", Side: SideSell, Type: TypeMarket, Quantity: 5})

	if len(trades) != 1 || trades[0].BuyOrderID != "bid-alto" {
		t.Fatalf("trades = %+v, want 1 trade contra bid-alto (melhor lance = maior preço)", trades)
	}
}

func TestSubmit_OrdemAMercadoConsomeMultiplosNiveisDePreco(t *testing.T) {
	var book Book

	book.Submit(Order{ID: "ask-1", Side: SideSell, Type: TypeLimit, Price: 10, Quantity: 3})
	book.Submit(Order{ID: "ask-2", Side: SideSell, Type: TypeLimit, Price: 11, Quantity: 3})

	trades := book.Submit(Order{ID: "buy-mercado", Side: SideBuy, Type: TypeMarket, Quantity: 5})

	if len(trades) != 2 {
		t.Fatalf("len(trades) = %d, want 2 (consumiu ask-1 inteira e parte de ask-2)", len(trades))
	}
	if trades[0].SellOrderID != "ask-1" || trades[0].Quantity != 3 || trades[0].Price != 10 {
		t.Errorf("trades[0] = %+v, want {SellOrderID: ask-1, Quantity: 3, Price: 10}", trades[0])
	}
	if trades[1].SellOrderID != "ask-2" || trades[1].Quantity != 2 || trades[1].Price != 11 {
		t.Errorf("trades[1] = %+v, want {SellOrderID: ask-2, Quantity: 2, Price: 11}", trades[1])
	}
}
