package fixedincome

import (
	"errors"
	"testing"
)

func TestNewFixedIncomeProduct(t *testing.T) {
	tests := []struct {
		name             string
		productType      ProductType
		creditRiskRating string
		wantIssuer       IssuerType
		wantTaxExempt    bool
	}{
		{"Tesouro Selic — governo, tributado", ProductTesouroSelic, "", IssuerTesouro, false},
		{"Tesouro Prefixado — governo, tributado", ProductTesouroPrefixado, "", IssuerTesouro, false},
		{"Tesouro IPCA+ — governo, tributado", ProductTesouroIPCA, "", IssuerTesouro, false},
		{"CDB — banco, tributado", ProductCDB, "", IssuerBanco, false},
		{"LCI — banco, isento de IR", ProductLCI, "", IssuerBanco, true},
		{"LCA — banco, isento de IR", ProductLCA, "", IssuerBanco, true},
		{"CRI — securitizadora, isento de IR", ProductCRI, "AA+", IssuerSecuritizadora, true},
		{"CRA — securitizadora, isento de IR", ProductCRA, "BBB", IssuerSecuritizadora, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewFixedIncomeProduct(tt.productType, tt.creditRiskRating)
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if got.IssuerType != tt.wantIssuer {
				t.Errorf("IssuerType = %q, want %q", got.IssuerType, tt.wantIssuer)
			}
			if got.TaxExempt != tt.wantTaxExempt {
				t.Errorf("TaxExempt = %v, want %v", got.TaxExempt, tt.wantTaxExempt)
			}
			if got.Type != tt.productType {
				t.Errorf("Type = %q, want %q", got.Type, tt.productType)
			}
			if got.CreditRiskRating != tt.creditRiskRating {
				t.Errorf("CreditRiskRating = %q, want %q", got.CreditRiskRating, tt.creditRiskRating)
			}
		})
	}
}

func TestNewFixedIncomeProduct_TipoDesconhecido(t *testing.T) {
	_, err := NewFixedIncomeProduct(ProductType("debenture"), "AA")
	if !errors.Is(err, ErrUnknownProductType) {
		t.Errorf("err = %v, want ErrUnknownProductType", err)
	}
}

func TestNewFixedIncomeProduct_CRI_CRA_ExigemClassificacaoDeRisco(t *testing.T) {
	for _, pt := range []ProductType{ProductCRI, ProductCRA} {
		_, err := NewFixedIncomeProduct(pt, "")
		if !errors.Is(err, ErrMissingCreditRiskRating) {
			t.Errorf("NewFixedIncomeProduct(%q, \"\") erro = %v, want ErrMissingCreditRiskRating", pt, err)
		}
	}
}

func TestNewFixedIncomeProduct_TesouroECDB_LCI_LCA_DispensamClassificacaoDeRisco(t *testing.T) {
	// Tesouro é soberano, CDB/LCI/LCA são cobertos por FGC — não exigem
	// credit_risk_rating pra serem cadastrados.
	semGarantiaFGC := []ProductType{
		ProductTesouroSelic, ProductTesouroPrefixado, ProductTesouroIPCA,
		ProductCDB, ProductLCI, ProductLCA,
	}
	for _, pt := range semGarantiaFGC {
		if _, err := NewFixedIncomeProduct(pt, ""); err != nil {
			t.Errorf("NewFixedIncomeProduct(%q, \"\") erro inesperado: %v", pt, err)
		}
	}
}

func TestIsPrefixado(t *testing.T) {
	tests := []struct {
		productType ProductType
		want        bool
	}{
		{ProductTesouroPrefixado, true},
		{ProductTesouroSelic, false},
		{ProductTesouroIPCA, false},
		{ProductCDB, false},
		{ProductLCI, false},
		{ProductLCA, false},
		{ProductCRI, false},
		{ProductCRA, false},
	}

	for _, tt := range tests {
		if got := IsPrefixado(tt.productType); got != tt.want {
			t.Errorf("IsPrefixado(%q) = %v, want %v", tt.productType, got, tt.want)
		}
	}
}

func TestRequiresCreditRiskRating(t *testing.T) {
	tests := []struct {
		productType ProductType
		want        bool
	}{
		{ProductTesouroSelic, false},
		{ProductTesouroPrefixado, false},
		{ProductTesouroIPCA, false},
		{ProductCDB, false},
		{ProductLCI, false},
		{ProductLCA, false},
		{ProductCRI, true},
		{ProductCRA, true},
	}

	for _, tt := range tests {
		if got := RequiresCreditRiskRating(tt.productType); got != tt.want {
			t.Errorf("RequiresCreditRiskRating(%q) = %v, want %v", tt.productType, got, tt.want)
		}
	}
}
