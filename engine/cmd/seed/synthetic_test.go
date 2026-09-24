package main

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
)

func TestSyntheticEquities(t *testing.T) {
	specs := syntheticEquities(50)
	if len(specs) != 50 {
		t.Fatalf("len = %d, want 50", len(specs))
	}

	tickers := map[string]bool{}
	cnpjs := map[string]bool{}
	sectors := map[catalog.Sector]int{}
	floats := map[int64]bool{}
	for _, s := range specs {
		if len(s.Ticker) > 10 {
			t.Errorf("ticker %q passa de 10 caracteres (varchar(10))", s.Ticker)
		}
		if tickers[s.Ticker] || cnpjs[s.CNPJ] {
			t.Errorf("ticker ou CNPJ repetido: %s %s", s.Ticker, s.CNPJ)
		}
		tickers[s.Ticker], cnpjs[s.CNPJ] = true, true
		sectors[s.Sector]++
		floats[s.OutstandingShares] = true
		if _, err := catalog.NewCompany(s.Name, s.CNPJ, s.Sector); err != nil {
			t.Errorf("empresa %s inválida: %v", s.Name, err)
		}
		if _, err := catalog.NewAsset(s.Ticker, s.Name, catalog.AssetAcao, &s.RiskClass, false); err != nil {
			t.Errorf("ativo %s inválido: %v", s.Ticker, err)
		}
	}
	if len(sectors) != 6 {
		t.Errorf("setores cobertos = %d, want os 6 fixos", len(sectors))
	}
	if len(floats) < 4 {
		t.Errorf("floats distintos = %d, want variação de tamanho", len(floats))
	}
}

func TestSyntheticEquities_Deterministico(t *testing.T) {
	a, b := syntheticEquities(30), syntheticEquities(30)
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("posição %d diverge entre execuções: %+v vs %+v", i, a[i], b[i])
		}
	}
}
