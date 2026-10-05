package adminview

import (
	"math"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func approx(a, b float64) bool { return math.Abs(a-b) < 1e-9 }

func TestSpreadPct(t *testing.T) {
	tests := []struct {
		name     string
		bid, ask *float64
		want     *float64
	}{
		{"sem bid", nil, ptr(10.0), nil},
		{"sem ask", ptr(10.0), nil, nil},
		{"book cruzado", ptr(10.5), ptr(10.0), nil},
		{"bid zerado", ptr(0.0), ptr(10.0), nil},
		{"book travado", ptr(10.0), ptr(10.0), ptr(0.0)},
		{"spread de 2%", ptr(9.9), ptr(10.1), ptr(2.0)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SpreadPct(tt.bid, tt.ask)
			if (got == nil) != (tt.want == nil) || (got != nil && !approx(*got, *tt.want)) {
				t.Fatalf("SpreadPct() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDailyChangePct(t *testing.T) {
	if got := DailyChangePct(ptr(11.0), ptr(10.0)); got == nil || !approx(*got, 10) {
		t.Fatalf("DailyChangePct() = %v, want 10", got)
	}
	if DailyChangePct(nil, ptr(10.0)) != nil || DailyChangePct(ptr(10.0), nil) != nil || DailyChangePct(ptr(10.0), ptr(0.0)) != nil {
		t.Fatal("DailyChangePct() deveria ser nil sem insumo válido")
	}
}

func TestClassIndicator(t *testing.T) {
	shares := ptr(int64(1000))
	tests := []struct {
		name     string
		in       IndicatorInputs
		wantKind IndicatorKind
		want     float64
		wantNil  bool
	}{
		{"ação: P/L = preço / LPA", IndicatorInputs{Type: "acao", Price: ptr(20.0), NetIncome: ptr(2000.0), OutstandingShares: shares}, IndicatorPriceToEarnings, 10, false},
		{"ação sem relatório", IndicatorInputs{Type: "acao", Price: ptr(20.0), OutstandingShares: shares}, "", 0, true},
		{"ação sem cotação", IndicatorInputs{Type: "acao", NetIncome: ptr(2000.0), OutstandingShares: shares}, "", 0, true},
		{"ETF: ágio vem pronto do NAV", IndicatorInputs{Type: "etf", NAVPremiumPct: ptr(-1.5)}, IndicatorNAVPremium, -1.5, false},
		{"ETF sem NAV", IndicatorInputs{Type: "etf"}, "", 0, true},
		{"FII: P/VP = preço / VP por cota", IndicatorInputs{Type: "fii", Price: ptr(90.0), BookValue: ptr(100000.0), OutstandingShares: shares}, IndicatorPriceToBook, 0.9, false},
		{"FII sem cotas", IndicatorInputs{Type: "fii", Price: ptr(90.0), BookValue: ptr(100000.0), OutstandingShares: ptr(int64(0))}, "", 0, true},
		{"classe sem indicador", IndicatorInputs{Type: "cdb", Price: ptr(1.0)}, "", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ClassIndicator(tt.in)
			if tt.wantNil {
				if got != nil {
					t.Fatalf("ClassIndicator() = %+v, want nil", got)
				}
				return
			}
			if got == nil || got.Kind != tt.wantKind || !approx(got.Value, tt.want) {
				t.Fatalf("ClassIndicator() = %+v, want {%s %v}", got, tt.wantKind, tt.want)
			}
		})
	}
}
