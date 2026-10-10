package coverage

import "testing"

func TestAssign(t *testing.T) {
	tests := []struct {
		name    string
		assetID string
		mms     []MarketMaker
		wantID  string
		wantOK  bool
	}{
		{
			name:    "escolhe o com menos ativos cobertos",
			assetID: "a9",
			mms: []MarketMaker{
				{AccountID: "mm1", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"a1", "a2", "a3"}},
				{AccountID: "mm2", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"a4"}},
			},
			wantID: "mm2", wantOK: true,
		},
		{
			name:    "empate desempata por AccountID",
			assetID: "a9",
			mms: []MarketMaker{
				{AccountID: "mm2", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"a1"}},
				{AccountID: "mm1", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"a2"}},
			},
			wantID: "mm1", wantOK: true,
		},
		{
			name:    "pula quem está no teto",
			assetID: "a9",
			mms: []MarketMaker{
				{AccountID: "mm1", Active: true, MaxAssets: 2, CoveredAssetIDs: []string{"a1", "a2"}},
				{AccountID: "mm2", Active: true, MaxAssets: 2, CoveredAssetIDs: []string{"a3"}},
			},
			wantID: "mm2", wantOK: true,
		},
		{
			name:    "nenhum com folga pede Market Maker novo",
			assetID: "a9",
			mms: []MarketMaker{
				{AccountID: "mm1", Active: true, MaxAssets: 1, CoveredAssetIDs: []string{"a1"}},
			},
			wantOK: false,
		},
		{
			name:    "Market Maker inativo é ignorado",
			assetID: "a9",
			mms: []MarketMaker{
				{AccountID: "mm1", Active: false, MaxAssets: 10},
				{AccountID: "mm2", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"a1", "a2"}},
			},
			wantID: "mm2", wantOK: true,
		},
		{
			name:    "só inativos pede Market Maker novo",
			assetID: "a9",
			mms:     []MarketMaker{{AccountID: "mm1", Active: false, MaxAssets: 10}},
			wantOK:  false,
		},
		{
			name:    "quem já cobre o ativo não é escolhido de novo",
			assetID: "a1",
			mms: []MarketMaker{
				{AccountID: "mm1", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"a1"}},
				{AccountID: "mm2", Active: true, MaxAssets: 10, CoveredAssetIDs: []string{"a2", "a3"}},
			},
			wantID: "mm2", wantOK: true,
		},
		{name: "sem Market Makers pede um novo", assetID: "a1", wantOK: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotID, gotOK := Assign(tt.assetID, tt.mms)
			if gotID != tt.wantID || gotOK != tt.wantOK {
				t.Errorf("Assign() = (%q, %v), want (%q, %v)", gotID, gotOK, tt.wantID, tt.wantOK)
			}
		})
	}
}

// Atribuir 15 ativos em sequência distribui 8 e 7, não 10 e 5.
func TestAssign_DistribuiPeloMenosCarregado(t *testing.T) {
	mms := []MarketMaker{
		{AccountID: "mm1", Active: true, MaxAssets: 10},
		{AccountID: "mm2", Active: true, MaxAssets: 10},
	}
	for i := 0; i < 15; i++ {
		assetID := string(rune('a' + i))
		id, ok := Assign(assetID, mms)
		if !ok {
			t.Fatalf("ativo %d sem Market Maker", i)
		}
		for j := range mms {
			if mms[j].AccountID == id {
				mms[j].CoveredAssetIDs = append(mms[j].CoveredAssetIDs, assetID)
			}
		}
	}
	if len(mms[0].CoveredAssetIDs) != 8 || len(mms[1].CoveredAssetIDs) != 7 {
		t.Errorf("distribuição = %d e %d, want 8 e 7", len(mms[0].CoveredAssetIDs), len(mms[1].CoveredAssetIDs))
	}
}
