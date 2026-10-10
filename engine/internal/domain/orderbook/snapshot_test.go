package orderbook

import "testing"

func TestBuildSnapshot_BookVazioDevolveTudoNulo(t *testing.T) {
	snap := BuildSnapshot(nil, nil, 5)

	if snap.BestBid != nil || snap.BestAsk != nil || snap.MidPrice != nil {
		t.Fatalf("book vazio deveria devolver best/mid nulos, got %+v", snap)
	}
	if snap.Bids != nil || snap.Asks != nil {
		t.Fatalf("book vazio deveria devolver bids/asks nil (nulo no JSON), got bids=%v asks=%v", snap.Bids, snap.Asks)
	}
}

func TestBuildSnapshot_MelhorBidEAskEPontoMedio(t *testing.T) {
	bids := []Level{{Price: 10, Quantity: 100}, {Price: 9.5, Quantity: 50}}
	asks := []Level{{Price: 10.5, Quantity: 80}, {Price: 11, Quantity: 40}}

	snap := BuildSnapshot(bids, asks, 5)

	if snap.BestBid == nil || *snap.BestBid != 10 {
		t.Fatalf("BestBid = %v, want 10", snap.BestBid)
	}
	if snap.BestAsk == nil || *snap.BestAsk != 10.5 {
		t.Fatalf("BestAsk = %v, want 10.5", snap.BestAsk)
	}
	if snap.MidPrice == nil || *snap.MidPrice != 10.25 {
		t.Fatalf("MidPrice = %v, want 10.25", snap.MidPrice)
	}
}

func TestBuildSnapshot_LadoVazioDevolveNuloSemDerrubarOOutroLado(t *testing.T) {
	asks := []Level{{Price: 10.5, Quantity: 80}}

	snap := BuildSnapshot(nil, asks, 5)

	if snap.Bids != nil {
		t.Fatalf("Bids = %v, want nil (lado vazio)", snap.Bids)
	}
	if snap.BestBid != nil {
		t.Fatalf("BestBid = %v, want nil (lado vazio)", snap.BestBid)
	}
	if snap.MidPrice != nil {
		t.Fatalf("MidPrice = %v, want nil (só um lado disponível, sem ponto médio)", snap.MidPrice)
	}
	if snap.BestAsk == nil || *snap.BestAsk != 10.5 {
		t.Fatalf("BestAsk = %v, want 10.5", snap.BestAsk)
	}
}

func TestBuildSnapshot_AgregaQuantidadeNoMesmoPreco(t *testing.T) {
	bids := []Level{{Price: 10, Quantity: 30}, {Price: 10, Quantity: 20}, {Price: 9, Quantity: 100}}

	snap := BuildSnapshot(bids, nil, 5)

	if len(snap.Bids) != 2 {
		t.Fatalf("len(Bids) = %d, want 2 (duas linhas de preço 10 deviam somar em um único nível)", len(snap.Bids))
	}
	if snap.Bids[0].Price != 10 || snap.Bids[0].Quantity != 50 {
		t.Fatalf("Bids[0] = %+v, want {Price: 10, Quantity: 50}", snap.Bids[0])
	}
}

func TestBuildSnapshot_RecortaNaProfundidadeSemAlterarOMelhorPreco(t *testing.T) {
	bids := []Level{
		{Price: 10, Quantity: 10}, {Price: 9, Quantity: 10}, {Price: 8, Quantity: 10},
		{Price: 7, Quantity: 10}, {Price: 6, Quantity: 10}, {Price: 5, Quantity: 10},
	}

	snap := BuildSnapshot(bids, nil, 3)

	if len(snap.Bids) != 3 {
		t.Fatalf("len(Bids) = %d, want 3 (depth = 3)", len(snap.Bids))
	}
	if snap.Bids[0].Price != 10 || snap.Bids[2].Price != 8 {
		t.Fatalf("Bids = %+v, want preços 10, 9, 8 em ordem", snap.Bids)
	}
	if snap.BestBid == nil || *snap.BestBid != 10 {
		t.Fatalf("BestBid = %v, want 10 mesmo depois do recorte", snap.BestBid)
	}
}

func TestBuildSnapshot_AskOrdenadoDoMenorParaOMaiorPreco(t *testing.T) {
	asks := []Level{{Price: 12, Quantity: 5}, {Price: 10, Quantity: 5}, {Price: 11, Quantity: 5}}

	snap := BuildSnapshot(nil, asks, 5)

	want := []float64{10, 11, 12}
	for i, w := range want {
		if snap.Asks[i].Price != w {
			t.Fatalf("Asks[%d].Price = %v, want %v", i, snap.Asks[i].Price, w)
		}
	}
}
