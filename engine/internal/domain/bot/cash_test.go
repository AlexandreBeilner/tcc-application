package bot

import "testing"

func TestInitialCash_MarketMakerGanhaMultiplicadorMaiorQueOutros(t *testing.T) {
	const positionValue = 100_000.0
	const minimumCash = 0.0

	mm := InitialCash(positionValue, minimumCash, true)
	other := InitialCash(positionValue, minimumCash, false)

	if mm <= other {
		t.Errorf("MarketMaker cash = %v, want maior que outros bots (%v)", mm, other)
	}
}

func TestInitialCash_MultiplicadoresAplicadosCorretamente(t *testing.T) {
	const positionValue = 10_000.0
	const minimumCash = 0.0

	tests := []struct {
		name          string
		isMarketMaker bool
		want          float64
	}{
		{name: "Market Maker", isMarketMaker: true, want: positionValue * MarketMakerCashMultiplier},
		{name: "outro bot", isMarketMaker: false, want: positionValue * OtherCashMultiplier},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := InitialCash(positionValue, minimumCash, tt.isMarketMaker)
			if got != tt.want {
				t.Errorf("InitialCash = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestInitialCash_PisoAplicadoQuandoValorDePosicaoENuloOuBaixo(t *testing.T) {
	const minimumCash = 500.0

	tests := []struct {
		name          string
		positionValue float64
		isMarketMaker bool
	}{
		{name: "posição zero, outro bot", positionValue: 0, isMarketMaker: false},
		{name: "posição zero, Market Maker", positionValue: 0, isMarketMaker: true},
		{name: "posição pequena, abaixo do piso mesmo com multiplicador", positionValue: 100, isMarketMaker: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := InitialCash(tt.positionValue, minimumCash, tt.isMarketMaker)
			if got != minimumCash {
				t.Errorf("InitialCash = %v, want piso %v", got, minimumCash)
			}
		})
	}
}

func TestInitialCash_ValorAcimaDoPisoIgnoraOPiso(t *testing.T) {
	const minimumCash = 10.0
	const positionValue = 1_000_000.0

	got := InitialCash(positionValue, minimumCash, false)
	want := positionValue * OtherCashMultiplier
	if got != want {
		t.Errorf("InitialCash = %v, want %v (piso não deveria influenciar aqui)", got, want)
	}
}
