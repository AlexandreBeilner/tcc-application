package catalog

import (
	"errors"
	"testing"
)

func TestNewVariableIncomeAsset(t *testing.T) {
	companyID := "company-1"
	shareClass := "PN"
	shares := int64(1000000)

	t.Run("ação com empresa", func(t *testing.T) {
		got, err := NewVariableIncomeAsset("asset-1", &companyID, &shareClass, &shares)
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if got.AssetID != "asset-1" || got.CompanyID != &companyID {
			t.Errorf("got = %+v", got)
		}
	})

	t.Run("etf/fii sem empresa", func(t *testing.T) {
		got, err := NewVariableIncomeAsset("asset-2", nil, nil, nil)
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		if got.CompanyID != nil {
			t.Errorf("CompanyID = %v, want nil", got.CompanyID)
		}
	})

	t.Run("asset_id vazio", func(t *testing.T) {
		_, err := NewVariableIncomeAsset("", nil, nil, nil)
		if !errors.Is(err, ErrMissingAssetID) {
			t.Errorf("err = %v, want %v", err, ErrMissingAssetID)
		}
	})

	// Tarefa J.1 (backlog-motor-mercado-realista) — o catálogo passa a
	// suportar uma empresa com 1 ou 2 ativos de Ação vinculados (ON/PN),
	// cada um com seu próprio asset_id/ticker/book. Não há nenhum invariante
	// que precise mudar pra isso: CompanyID já era compartilhável por
	// construção (nullable, sem unicidade no schema nem no construtor) —
	// este teste documenta e trava essa capacidade, em vez de acrescentar
	// uma validação nova.
	t.Run("duas classes (ON+PN) vinculadas à mesma empresa", func(t *testing.T) {
		onClass, pnClass := "ON", "PN"
		onShares, pnShares := int64(600_000_000), int64(400_000_000)

		on, err := NewVariableIncomeAsset("asset-on", &companyID, &onClass, &onShares)
		if err != nil {
			t.Fatalf("ON: erro inesperado: %v", err)
		}
		pn, err := NewVariableIncomeAsset("asset-pn", &companyID, &pnClass, &pnShares)
		if err != nil {
			t.Fatalf("PN: erro inesperado: %v", err)
		}

		if on.AssetID == pn.AssetID {
			t.Fatal("ON e PN não podem compartilhar asset_id — cada classe tem seu próprio ativo/book")
		}
		if *on.CompanyID != *pn.CompanyID {
			t.Errorf("CompanyID de ON (%v) e PN (%v) deveriam ser a mesma empresa", *on.CompanyID, *pn.CompanyID)
		}
		if *on.ShareClass == *pn.ShareClass {
			t.Errorf("ShareClass de ON e PN não deveriam ser iguais, got %q pros dois", *on.ShareClass)
		}
	})
}
