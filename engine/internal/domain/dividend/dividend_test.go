package dividend

import "testing"

func TestEquityValuePerShare(t *testing.T) {
	tests := map[string]struct {
		netIncome    float64
		onShares     int64
		pnShares     int64
		pnPremiumPct float64
		wantOn       float64
		wantPn       float64
		wantOK       bool
	}{
		// Empresa só-ON: pnShares = 0 reduz à mesma fórmula de antes desta
		// tarefa (netIncome * payout / outstandingShares) — sem quebra de
		// compatibilidade (critério de aceite da J.2).
		"só-ON, caso normal": {
			netIncome: 100_000, onShares: 1_000, pnShares: 0, pnPremiumPct: DefaultPnDividendPremiumPct,
			wantOn: 50, wantPn: 55.00000000000001, wantOK: true,
		},
		"só-ON, ações em circulação zero":     {netIncome: 100_000, onShares: 0, pnShares: 0, pnPremiumPct: DefaultPnDividendPremiumPct, wantOK: false},
		"só-ON, ações em circulação negativa": {netIncome: 100_000, onShares: -1, pnShares: 0, pnPremiumPct: DefaultPnDividendPremiumPct, wantOK: false},
		"só-ON, net_income negativo": {
			netIncome: -100_000, onShares: 1_000, pnShares: 0, pnPremiumPct: DefaultPnDividendPremiumPct,
			wantOn: -50, wantPn: -55.00000000000001, wantOK: true,
		},
		// ON+PN, premium default de 10% (piso legal do art. 17): pool =
		// 100_000 * 0.5 = 50_000; denom = 1_000 + 500*1.10 = 1_550;
		// on = 50_000/1_550 ≈ 32,258...; pn = on*1.10.
		"ON+PN, premium default 10%": {
			netIncome: 100_000, onShares: 1_000, pnShares: 500, pnPremiumPct: DefaultPnDividendPremiumPct,
			wantOn: 32.25806451612903, wantPn: 35.483870967741936, wantOK: true,
		},
		// ON+PN, premium customizado acima do mínimo legal (20%): pool =
		// 50_000; denom = 1_000 + 500*1.20 = 1_600; on = 50_000/1_600 =
		// 31,25; pn = on*1.20 = 37,5.
		"ON+PN, premium customizado 20%": {
			netIncome: 100_000, onShares: 1_000, pnShares: 500, pnPremiumPct: 20,
			wantOn: 31.25, wantPn: 37.5, wantOK: true,
		},
	}
	for name, tt := range tests {
		t.Run(name, func(t *testing.T) {
			gotOn, gotPn, ok := EquityValuePerShare(tt.netIncome, tt.onShares, tt.pnShares, tt.pnPremiumPct)
			if ok != tt.wantOK {
				t.Fatalf("ok = %v, want %v", ok, tt.wantOK)
			}
			if !ok {
				return
			}
			if gotOn != tt.wantOn {
				t.Errorf("onValue = %v, want %v", gotOn, tt.wantOn)
			}
			if gotPn != tt.wantPn {
				t.Errorf("pnValue = %v, want %v", gotPn, tt.wantPn)
			}
			if tt.pnShares > 0 && gotPn <= gotOn {
				t.Errorf("pnValue (%v) deveria ser maior que onValue (%v) com premium > 0", gotPn, gotOn)
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
