package bot

import "testing"

func TestPoolSize(t *testing.T) {
	tests := []struct {
		assets int
		want   int
	}{
		{0, MinPoolSize},
		{5, MinPoolSize}, // seed real: o pool atual de 19 não muda
		{9, MinPoolSize},
		{10, 20},
		{15, 30},
		{30, 60},
		{50, 100},
		{75, 150},
		{100, MaxPoolSize},
		{1000, MaxPoolSize},
	}
	for _, tt := range tests {
		if got := PoolSize(tt.assets); got != tt.want {
			t.Errorf("PoolSize(%d) = %d, want %d", tt.assets, got, tt.want)
		}
	}
}

// O pool nunca encolhe quando o catálogo cresce: um ativo novo nunca faz um bot
// já criado sobrar.
func TestPoolSize_Monotonico(t *testing.T) {
	prev := 0
	for n := 0; n <= 300; n++ {
		size := PoolSize(n)
		if size < prev {
			t.Fatalf("PoolSize(%d) = %d < PoolSize(%d) = %d", n, size, n-1, prev)
		}
		prev = size
	}
}
