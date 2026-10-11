package corporategovernance

import "testing"

func TestCumulativeDelta(t *testing.T) {
	tests := []struct {
		name                 string
		total, ramp, elapsed int
		want                 int
	}{
		{"antes de começar", 50, 10, 0, 0},
		{"negativo vira zero", 50, 10, -3, 0},
		{"metade", 50, 10, 5, 25},
		{"fim exato", 50, 10, 10, 50},
		{"depois do fim fica no total", 50, 10, 99, 50},
		{"negativo, metade", -50, 10, 5, -25},
		{"rampa de um tick aplica tudo", 7, 1, 1, 7},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := CumulativeDelta(tt.total, tt.ramp, tt.elapsed); got != tt.want {
				t.Errorf("CumulativeDelta(%d,%d,%d) = %d, esperado %d", tt.total, tt.ramp, tt.elapsed, got, tt.want)
			}
		})
	}
}

// A soma dos passos fecha exatamente no total, de qualquer jeito que os ticks cheguem: um por
// vez ou recuperados em lotes depois de uma parada do motor.
func TestStepDelta_SomaFechaNoTotal(t *testing.T) {
	for _, total := range []int{50, -50, 7, -7, 1, -1, 33, 5, -3} {
		for _, ramp := range []int{1, 3, 7, 30, 90, 365} {
			for _, jump := range []int{1, 2, 5, 29} {
				applied, sum := 0, 0
				for applied < ramp {
					next := applied + jump
					if next > ramp {
						next = ramp
					}
					sum += StepDelta(total, ramp, applied, next)
					applied = next
				}
				if sum != total {
					t.Fatalf("total=%d rampa=%d salto=%d: soma dos passos = %d", total, ramp, jump, sum)
				}
			}
		}
	}
}

func TestStepDelta_NuncaVaiNaDirecaoContraria(t *testing.T) {
	for _, total := range []int{50, -50, 3, -3} {
		prev := 0
		for k := 1; k <= 30; k++ {
			step := StepDelta(total, 30, k-1, k)
			if total > 0 && step < 0 || total < 0 && step > 0 {
				t.Fatalf("total=%d tick=%d: passo %d no sentido contrário", total, k, step)
			}
			prev += step
		}
		if prev != total {
			t.Fatalf("total=%d: acumulou %d", total, prev)
		}
	}
}

func TestElapsedTicks(t *testing.T) {
	tests := []struct {
		name                string
		start, newDay, ramp int
		want                int
	}{
		{"antes do início", 10, 9, 5, 0},
		{"primeiro tick é o do dia de início", 10, 10, 5, 1},
		{"terceiro tick", 10, 12, 5, 3},
		{"último tick", 10, 14, 5, 5},
		{"depois do fim satura", 10, 40, 5, 5},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ElapsedTicks(tt.start, tt.newDay, tt.ramp); got != tt.want {
				t.Errorf("ElapsedTicks = %d, esperado %d", got, tt.want)
			}
		})
	}
}
