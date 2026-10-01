package main

import (
	"fmt"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/etf"
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
		if _, err := catalog.NewCompany(s.Name, s.CNPJ, s.Sector, catalog.DefaultBaseGrowthPct, catalog.DefaultQualityMultiplier); err != nil {
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

func TestSyntheticETFs(t *testing.T) {
	etfs := syntheticETFs(12, 30)
	if len(etfs) != 12 {
		t.Fatalf("len = %d, want 12", len(etfs))
	}
	tickers := map[string]bool{}
	sizes := map[int]bool{}
	for _, e := range etfs {
		if len(e.Ticker) > 10 || tickers[e.Ticker] {
			t.Errorf("ticker %q repetido ou passa de 10 caracteres", e.Ticker)
		}
		tickers[e.Ticker] = true
		sizes[len(e.Constituents)] = true

		holdings := make([]etf.Holding, 0, len(e.Constituents))
		seen := map[string]bool{}
		for i, c := range e.Constituents {
			if seen[c.Ticker] {
				t.Errorf("%s: constituente %s repetido", e.Ticker, c.Ticker)
			}
			seen[c.Ticker] = true
			id := fmt.Sprintf("id-%d", i)
			holdings = append(holdings, etf.Holding{ConstituentName: c.Name, AssetID: &id, Class: etf.HoldingClassEquity, WeightPct: c.WeightPct})
		}
		if _, err := etf.NewDetails("Índice sintético", "", holdings); err != nil {
			t.Errorf("%s: cesta inválida (pesos precisam somar 100): %v", e.Ticker, err)
		}
	}
	if !sizes[1] || len(sizes) < 4 {
		t.Errorf("tamanhos de cesta = %v, want um ETF de um constituinte e variação", sizes)
	}
}

func TestSyntheticETFs_UmaAcaoSoEDeterministico(t *testing.T) {
	a, b := syntheticETFs(5, 1), syntheticETFs(5, 1)
	for i := range a {
		if a[i].Ticker != b[i].Ticker || len(a[i].Constituents) != len(b[i].Constituents) {
			t.Fatalf("posição %d diverge entre execuções", i)
		}
		if a[i].Constituents[0].Ticker != "SYN0013" {
			t.Errorf("ETF %s: primeiro constituinte = %s, want SYN0013 (única ação)", a[i].Ticker, a[i].Constituents[0].Ticker)
		}
	}
	if got := syntheticETFs(3, 0); got != nil {
		t.Errorf("sem ações sintéticas = %v, want nil", got)
	}
}
