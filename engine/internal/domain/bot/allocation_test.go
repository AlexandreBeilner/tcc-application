package bot

import (
	"errors"
	"testing"
)

func TestInitialAllocation_SomaBateExatamenteComTotalFloat(t *testing.T) {
	tests := []struct {
		name                string
		totalFloat          int64
		marketMakerSharePct float64
		otherBotCount       int
	}{
		{name: "float grande, 20 bots, MM no meio da faixa", totalFloat: 1_000_000, marketMakerSharePct: 0.50, otherBotCount: 20},
		{name: "float pequeno, poucos bots, MM no piso da faixa", totalFloat: 137, marketMakerSharePct: MarketMakerShareMin, otherBotCount: 3},
		{name: "float ímpar, MM no teto da faixa", totalFloat: 9_999_999, marketMakerSharePct: MarketMakerShareMax, otherBotCount: 24},
		{name: "um único outro bot", totalFloat: 5_000, marketMakerSharePct: 0.45, otherBotCount: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			for seed := int64(0); seed < 20; seed++ {
				got, err := InitialAllocation("ATIVO1", tt.totalFloat, tt.marketMakerSharePct, tt.otherBotCount, seed)
				if err != nil {
					t.Fatalf("seed %d: err = %v, want nil", seed, err)
				}

				sum := got.MarketMaker
				for _, share := range got.Others {
					sum += share
				}
				if sum != tt.totalFloat {
					t.Fatalf("seed %d: soma = %d, want %d (MarketMaker=%d, Others=%v)", seed, sum, tt.totalFloat, got.MarketMaker, got.Others)
				}
			}
		})
	}
}

func TestInitialAllocation_MarketMakerSempreDentroDaFaixa(t *testing.T) {
	const totalFloat = 1_000_000
	pcts := []float64{MarketMakerShareMin, 0.45, 0.50, 0.55, MarketMakerShareMax}

	for _, pct := range pcts {
		got, err := InitialAllocation("ATIVO1", totalFloat, pct, 15, 1)
		if err != nil {
			t.Fatalf("pct %v: err = %v, want nil", pct, err)
		}

		gotShare := float64(got.MarketMaker) / float64(totalFloat)
		if gotShare < MarketMakerShareMin-0.001 || gotShare > MarketMakerShareMax+0.001 {
			t.Errorf("pct %v: MarketMaker share = %v, want dentro de [%v, %v]", pct, gotShare, MarketMakerShareMin, MarketMakerShareMax)
		}
	}
}

func TestInitialAllocation_MarketMakerShareForaDaFaixaRetornaErro(t *testing.T) {
	tests := []struct {
		name string
		pct  float64
	}{
		{name: "abaixo do piso", pct: 0.39},
		{name: "acima do teto", pct: 0.61},
		{name: "zero", pct: 0},
		{name: "negativo", pct: -0.5},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := InitialAllocation("ATIVO1", 1000, tt.pct, 10, 1)
			if !errors.Is(err, ErrInvalidAllocation) {
				t.Errorf("err = %v, want ErrInvalidAllocation", err)
			}
		})
	}
}

func TestInitialAllocation_TotalFloatInvalidoRetornaErro(t *testing.T) {
	tests := []struct {
		name       string
		totalFloat int64
	}{
		{name: "zero", totalFloat: 0},
		{name: "negativo", totalFloat: -100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := InitialAllocation("ATIVO1", tt.totalFloat, 0.5, 10, 1)
			if !errors.Is(err, ErrInvalidAllocation) {
				t.Errorf("err = %v, want ErrInvalidAllocation", err)
			}
		})
	}
}

func TestInitialAllocation_OtherBotCountInvalidoRetornaErro(t *testing.T) {
	tests := []struct {
		name          string
		otherBotCount int
	}{
		{name: "zero", otherBotCount: 0},
		{name: "negativo", otherBotCount: -1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := InitialAllocation("ATIVO1", 1000, 0.5, tt.otherBotCount, 1)
			if !errors.Is(err, ErrInvalidAllocation) {
				t.Errorf("err = %v, want ErrInvalidAllocation", err)
			}
		})
	}
}

func TestInitialAllocation_MesmaSeedProduzMesmaDistribuicao(t *testing.T) {
	a, errA := InitialAllocation("ATIVO1", 1_000_000, 0.5, 20, 42)
	b, errB := InitialAllocation("ATIVO1", 1_000_000, 0.5, 20, 42)
	if errA != nil || errB != nil {
		t.Fatalf("errA = %v, errB = %v, want nil", errA, errB)
	}

	if a.MarketMaker != b.MarketMaker {
		t.Errorf("MarketMaker divergiu: %d != %d — mesma seed devia produzir a mesma distribuição", a.MarketMaker, b.MarketMaker)
	}
	if len(a.Others) != len(b.Others) {
		t.Fatalf("len(Others) divergiu: %d != %d", len(a.Others), len(b.Others))
	}
	for i := range a.Others {
		if a.Others[i] != b.Others[i] {
			t.Errorf("Others[%d] divergiu: %d != %d — mesma seed devia produzir a mesma distribuição", i, a.Others[i], b.Others[i])
		}
	}
}

func TestInitialAllocation_SeedsDiferentesGeramDistribuicoesDiferentes(t *testing.T) {
	a, _ := InitialAllocation("ATIVO1", 1_000_000, 0.5, 20, 1)
	b, _ := InitialAllocation("ATIVO1", 1_000_000, 0.5, 20, 2)

	identical := true
	for i := range a.Others {
		if a.Others[i] != b.Others[i] {
			identical = false
			break
		}
	}
	if identical {
		t.Error("seeds diferentes produziram a mesma distribuição entre os outros bots")
	}
}

func TestInitialAllocation_AtivosDiferentesGeramDistribuicoesDiferentesComMesmaSeed(t *testing.T) {
	a, _ := InitialAllocation("ATIVO1", 1_000_000, 0.5, 20, 42)
	b, _ := InitialAllocation("ATIVO2", 1_000_000, 0.5, 20, 42)

	identical := true
	for i := range a.Others {
		if a.Others[i] != b.Others[i] {
			identical = false
			break
		}
	}
	if identical {
		t.Error("assetID diferente produziu a mesma distribuição com a mesma seed base — cada ativo precisa de um processo de sorteio independente")
	}
}

// TestInitialAllocation_DistribuicaoConcentradaNaoUniforme confere o
// critério de aceite "distribuição entre não-Market-Maker é visivelmente
// concentrada (poucos grandes, muitos pequenos), não uniforme": numa
// distribuição uniforme entre 20 bots, todo bot receberia ~5% do restante;
// pesos exponenciais normalizados (Dirichlet(1,...,1)) produzem, por
// estatística de valores extremos, um maior bem acima disso.
func TestInitialAllocation_DistribuicaoConcentradaNaoUniforme(t *testing.T) {
	const otherBotCount = 20
	const uniformShare = 1.0 / otherBotCount

	for seed := int64(0); seed < 10; seed++ {
		got, err := InitialAllocation("ATIVO1", 1_000_000, 0.5, otherBotCount, seed)
		if err != nil {
			t.Fatalf("seed %d: err = %v, want nil", seed, err)
		}

		remaining := int64(0)
		var max int64
		for _, share := range got.Others {
			remaining += share
			if share > max {
				max = share
			}
		}

		maxShareOfRemaining := float64(max) / float64(remaining)
		if maxShareOfRemaining < 2*uniformShare {
			t.Errorf("seed %d: maior fatia individual = %.4f do restante, want bem acima de %.4f (uniforme) — distribuição não parece concentrada",
				seed, maxShareOfRemaining, uniformShare)
		}
	}
}

func TestInitialAllocation_UmUnicoOutroBotRecebeTodoORestante(t *testing.T) {
	got, err := InitialAllocation("ATIVO1", 1000, 0.5, 1, 1)
	if err != nil {
		t.Fatalf("err = %v, want nil", err)
	}
	if len(got.Others) != 1 {
		t.Fatalf("len(Others) = %d, want 1", len(got.Others))
	}
	if got.Others[0] != 500 {
		t.Errorf("Others[0] = %d, want 500 (todo o restante)", got.Others[0])
	}
}

func TestLargestRemainderAllocation_NenhumaFatiaNegativa(t *testing.T) {
	weights := []float64{0.001, 100, 0.5, 3, 0.0001}
	totalWeight := 0.0
	for _, w := range weights {
		totalWeight += w
	}

	shares := largestRemainderAllocation(weights, totalWeight, 7)

	sum := int64(0)
	for _, s := range shares {
		if s < 0 {
			t.Errorf("fatia negativa: %d", s)
		}
		sum += s
	}
	if sum != 7 {
		t.Errorf("soma = %d, want 7", sum)
	}
}
