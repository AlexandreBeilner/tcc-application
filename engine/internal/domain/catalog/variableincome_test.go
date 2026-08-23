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
}
