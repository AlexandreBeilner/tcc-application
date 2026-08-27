package fixedincome

import "testing"

func TestRegressiveIncomeTaxRate(t *testing.T) {
	tests := []struct {
		name     string
		daysHeld int
		want     float64
	}{
		{"1 dia — dentro da primeira faixa", 1, 0.225},
		{"exatamente 180 dias — ainda 22.5%", 180, 0.225},
		{"181 dias — cai pra 20%", 181, 0.20},
		{"exatamente 360 dias — ainda 20%", 360, 0.20},
		{"361 dias — cai pra 17.5%", 361, 0.175},
		{"exatamente 720 dias — ainda 17.5%", 720, 0.175},
		{"721 dias — cai pra 15%, alíquota mínima", 721, 0.15},
		{"muito acima de 720 dias — permanece 15%", 3650, 0.15},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := RegressiveIncomeTaxRate(tt.daysHeld); got != tt.want {
				t.Errorf("RegressiveIncomeTaxRate(%d) = %v, want %v", tt.daysHeld, got, tt.want)
			}
		})
	}
}
