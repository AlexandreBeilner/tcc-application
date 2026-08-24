package fundamentals

import "testing"

func TestLPA(t *testing.T) {
	tests := map[string]struct {
		netIncome         float64
		outstandingShares int64
		want              float64
		wantOK            bool
	}{
		"caso normal":             {netIncome: 100_000, outstandingShares: 10_000, want: 10, wantOK: true},
		"prejuízo":                {netIncome: -50_000, outstandingShares: 10_000, want: -5, wantOK: true},
		"sem ações em circulação": {netIncome: 100_000, outstandingShares: 0, wantOK: false},
		"ações negativas":         {netIncome: 100_000, outstandingShares: -1, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := LPA(tt.netIncome, tt.outstandingShares)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("LPA = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestVPA(t *testing.T) {
	tests := map[string]struct {
		netEquity         float64
		outstandingShares int64
		want              float64
		wantOK            bool
	}{
		"caso normal":             {netEquity: 1_200_000, outstandingShares: 10_000, want: 120, wantOK: true},
		"sem ações em circulação": {netEquity: 1_200_000, outstandingShares: 0, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := VPA(tt.netEquity, tt.outstandingShares)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("VPA = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestROE(t *testing.T) {
	tests := map[string]struct {
		netIncome, netEquity float64
		want                 float64
		wantOK               bool
	}{
		"caso normal":             {netIncome: 100_000, netEquity: 1_000_000, want: 0.1, wantOK: true},
		"patrimônio líquido zero": {netIncome: 100_000, netEquity: 0, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := ROE(tt.netIncome, tt.netEquity)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("ROE = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestEBITMargin(t *testing.T) {
	tests := map[string]struct {
		ebit, netRevenue float64
		want             float64
		wantOK           bool
	}{
		"caso normal":  {ebit: 180_000, netRevenue: 1_000_000, want: 0.18, wantOK: true},
		"receita zero": {ebit: 180_000, netRevenue: 0, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := EBITMargin(tt.ebit, tt.netRevenue)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("EBITMargin = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNetMargin(t *testing.T) {
	tests := map[string]struct {
		netIncome, netRevenue float64
		want                  float64
		wantOK                bool
	}{
		"caso normal":  {netIncome: 100_000, netRevenue: 1_000_000, want: 0.1, wantOK: true},
		"receita zero": {netIncome: 100_000, netRevenue: 0, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := NetMargin(tt.netIncome, tt.netRevenue)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("NetMargin = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestNetDebtToEBIT(t *testing.T) {
	tests := map[string]struct {
		grossDebt, cashEquivalents, ebit float64
		want                             float64
		wantOK                           bool
	}{
		"caso normal": {grossDebt: 480_000, cashEquivalents: 150_000, ebit: 180_000, want: 330_000.0 / 180_000.0, wantOK: true},
		"EBIT zero":   {grossDebt: 480_000, cashEquivalents: 150_000, ebit: 0, wantOK: false},
		"caixa maior que a dívida (dívida líquida negativa)": {grossDebt: 100_000, cashEquivalents: 300_000, ebit: 180_000, want: -200_000.0 / 180_000.0, wantOK: true},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := NetDebtToEBIT(tt.grossDebt, tt.cashEquivalents, tt.ebit)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("NetDebtToEBIT = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPriceToEarnings(t *testing.T) {
	tests := map[string]struct {
		currentPrice, lpa float64
		want              float64
		wantOK            bool
	}{
		"caso normal":             {currentPrice: 100, lpa: 10, want: 10, wantOK: true},
		"LPA zero":                {currentPrice: 100, lpa: 0, wantOK: false},
		"LPA negativo (prejuízo)": {currentPrice: 100, lpa: -5, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := PriceToEarnings(tt.currentPrice, tt.lpa)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("PriceToEarnings = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestPriceToBookValue(t *testing.T) {
	tests := map[string]struct {
		currentPrice, vpa float64
		want              float64
		wantOK            bool
	}{
		"caso normal": {currentPrice: 100, vpa: 120, want: 100.0 / 120.0, wantOK: true},
		"VPA zero":    {currentPrice: 100, vpa: 0, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := PriceToBookValue(tt.currentPrice, tt.vpa)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("PriceToBookValue = %v, want %v", got, tt.want)
			}
		})
	}
}
