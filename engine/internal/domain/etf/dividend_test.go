package etf

import "testing"

func TestDistributionPerShare(t *testing.T) {
	tests := []struct {
		name       string
		cash, liab float64
		shares     int64
		want       float64
	}{
		{"divide o caixa livre", 1000, 0, 100, 10},
		{"arredonda para baixo em centavos", 1000, 0, 300, 3.33},
		{"desconta o passivo já devido", 1000, 400, 100, 6},
		{"sem caixa livre", 100, 100, 100, 0},
		{"passivo maior que o caixa", 100, 300, 100, 0},
		{"sem cotas", 1000, 0, 0, 0},
		{"menos de um centavo por cota", 0.5, 0, 100, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := DistributionPerShare(tt.cash, tt.liab, tt.shares); got != tt.want {
				t.Errorf("DistributionPerShare = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestDistributionTotal_NuncaExcedeOCaixa(t *testing.T) {
	cash := 1000.0
	perShare := DistributionPerShare(cash, 0, 300)
	if total := DistributionTotal(perShare, 300); total != 999 || total > cash {
		t.Errorf("total = %v, want 999 (nunca acima do caixa de %v)", total, cash)
	}
}
