package catalog

import (
	"errors"
	"testing"
)

func TestNewAsset(t *testing.T) {
	conservador := "Conservador"

	tests := []struct {
		name      string
		ticker    string
		assetName string
		assetType AssetType
		riskClass *string
		wantErr   error
	}{
		{name: "ação válida", ticker: "PETR4", assetName: "Petrobras PN", assetType: AssetAcao, riskClass: &conservador},
		{name: "renda fixa sem risk_class", ticker: "TESOURO-SELIC", assetName: "Tesouro Selic 2029", assetType: AssetTesouroSelic},
		{name: "etf válido", ticker: "BOVA11", assetName: "iShares Ibovespa", assetType: AssetETF},
		{name: "ticker vazio", ticker: "", assetName: "x", assetType: AssetAcao, wantErr: ErrMissingTicker},
		{name: "nome vazio", ticker: "PETR4", assetName: "", assetType: AssetAcao, wantErr: ErrMissingName},
		{name: "tipo desconhecido", ticker: "XPTO4", assetName: "x", assetType: AssetType("cripto"), wantErr: ErrUnknownAssetType},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := NewAsset(tt.ticker, tt.assetName, tt.assetType, tt.riskClass, false)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("err = %v, want %v", err, tt.wantErr)
			}
			if tt.wantErr != nil {
				return
			}
			if got.Ticker != tt.ticker || got.Name != tt.assetName || got.Type != tt.assetType {
				t.Errorf("got = %+v, want ticker=%q name=%q type=%q", got, tt.ticker, tt.assetName, tt.assetType)
			}
		})
	}
}
