package dividend

import "testing"

func TestEquityValuePerShare(t *testing.T) {
	tests := map[string]struct {
		netIncome         float64
		outstandingShares int64
		want              float64
		wantOK            bool
	}{
		"caso normal":                  {netIncome: 100_000, outstandingShares: 1_000, want: 50, wantOK: true},
		"ações em circulação zero":     {netIncome: 100_000, outstandingShares: 0, want: 0, wantOK: false},
		"ações em circulação negativa": {netIncome: 100_000, outstandingShares: -1, want: 0, wantOK: false},
		"net_income negativo":          {netIncome: -100_000, outstandingShares: 1_000, want: -50, wantOK: true},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := EquityValuePerShare(tt.netIncome, tt.outstandingShares)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestFIIValuePerShare(t *testing.T) {
	tests := map[string]struct {
		netWorth          float64
		outstandingShares int64
		want              float64
		wantOK            bool
	}{
		"caso normal":                  {netWorth: 100_000_000, outstandingShares: 1_000_000, want: 0.5, wantOK: true},
		"cotas em circulação zero":     {netWorth: 100_000_000, outstandingShares: 0, want: 0, wantOK: false},
		"cotas em circulação negativa": {netWorth: 100_000_000, outstandingShares: -1, want: 0, wantOK: false},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := FIIValuePerShare(tt.netWorth, tt.outstandingShares)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestYield(t *testing.T) {
	tests := map[string]struct {
		sum, price float64
		want       float64
		wantOK     bool
	}{
		"caso normal":    {sum: 5, price: 100, want: 0.05, wantOK: true},
		"preço zero":     {sum: 5, price: 0, want: 0, wantOK: false},
		"preço negativo": {sum: 5, price: -10, want: 0, wantOK: false},
		"sem provento":   {sum: 0, price: 100, want: 0, wantOK: true},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			got, ok := Yield(tt.sum, tt.price)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if ok && got != tt.want {
				t.Errorf("got = %v, want %v", got, tt.want)
			}
		})
	}
}
