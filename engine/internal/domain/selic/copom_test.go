package selic

import (
	"math"
	"testing"
)

func TestCalendarSeries_ReversaoAMediaSoNoDiaDeReuniao(t *testing.T) {
	// Volatility = 0 remove o ruído, InflationWeight = 0 remove o termo de
	// IPCA (tarefa I.1), deixando só a reversão à média — mesmo espírito
	// do teste numérico exato de Series. Os deltas deste cenário (-5, -2.5)
	// já são múltiplos exatos de CopomStepIncrement, então a quantização
	// (tarefa I.2) não muda os valores esperados.
	cfg := Config{Initial: 20, Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}

	got := CalendarSeries(cfg, CopomMeetingIntervalDays*2, nil)

	// Do dia 1 ao 20 (índices 0-19): nenhuma reunião ainda, taxa parada no
	// Initial.
	for i := 0; i < CopomMeetingIntervalDays-1; i++ {
		if got[i] != 20 {
			t.Fatalf("got[%d] = %v, want 20 (sem reunião ainda)", i, got[i])
		}
	}

	// Dia 21 (índice 20): primeira reunião — 20 + 0.5*(10-20) = 15.
	if math.Abs(got[CopomMeetingIntervalDays-1]-15) > 1e-9 {
		t.Fatalf("got[%d] = %v, want 15 (primeira reunião do Copom)", CopomMeetingIntervalDays-1, got[CopomMeetingIntervalDays-1])
	}

	// Dias 22-41 (índices 21-40): taxa parada em 15, sem nova reunião.
	for i := CopomMeetingIntervalDays; i < 2*CopomMeetingIntervalDays-1; i++ {
		if math.Abs(got[i]-15) > 1e-9 {
			t.Fatalf("got[%d] = %v, want 15 (entre reuniões)", i, got[i])
		}
	}

	// Dia 42 (índice 41): segunda reunião — 15 + 0.5*(10-15) = 12.5.
	last := 2*CopomMeetingIntervalDays - 1
	if math.Abs(got[last]-12.5) > 1e-9 {
		t.Fatalf("got[%d] = %v, want 12.5 (segunda reunião do Copom)", last, got[last])
	}
}

func TestCalendarSeries_DeterministicaPorSeed(t *testing.T) {
	cfg := DefaultConfig(10.75, 42)

	a := CalendarSeries(cfg, 100, nil)
	b := CalendarSeries(cfg, 100, nil)

	if len(a) != len(b) {
		t.Fatalf("len(a) = %d, len(b) = %d", len(a), len(b))
	}
	for i := range a {
		if a[i] != b[i] {
			t.Fatalf("curva divergiu no índice %d: %v != %v — mesmo seed devia gerar curva idêntica", i, a[i], b[i])
		}
	}
}

func TestCalendarSeries_SeedsDiferentesGeramCurvasDiferentes(t *testing.T) {
	a := CalendarSeries(DefaultConfig(10.75, 1), 100, nil)
	b := CalendarSeries(DefaultConfig(10.75, 2), 100, nil)

	identical := true
	for i := range a {
		if a[i] != b[i] {
			identical = false
			break
		}
	}
	if identical {
		t.Error("curvas com seeds diferentes vieram idênticas")
	}
}

func TestCalendarSeries_NuncaNegativa(t *testing.T) {
	cfg := Config{Initial: 0.5, Neutral: 0, ReversionSpeed: 0.1, Volatility: 5, InflationWeight: DefaultInflationWeight, Seed: 7}

	for i, rate := range CalendarSeries(cfg, 1000, nil) {
		if rate < 0 {
			t.Fatalf("curve[%d] = %v, curva de juros simulada não pode ser negativa", i, rate)
		}
	}
}

func TestNextCalendarRate_ForaDeDiaDeReuniaoDevolveTaxaInalterada(t *testing.T) {
	cfg := Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 1, Seed: 1}

	for i := 0; i < CopomMeetingIntervalDays-1; i++ {
		if got := NextCalendarRate(cfg, i, 20, 0.02); got != 20 {
			t.Fatalf("NextCalendarRate(dia %d, sem reunião) = %v, want 20 (inalterada)", i, got)
		}
	}
}

func TestNextCalendarRate_DiaDeReuniaoMudaATaxa(t *testing.T) {
	// InflationWeight = 0 e ipcaAccumulatedDeviation = 0.05 (não-zero, de
	// propósito): prova que o termo de IPCA (tarefa I.1) é ignorado quando
	// o peso é zero — regressão da fórmula anterior a esta tarefa. -5 já é
	// múltiplo exato de CopomStepIncrement, então a quantização (I.2) não
	// altera o resultado.
	cfg := Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, InflationWeight: 0, Seed: 1}

	dayIndex := CopomMeetingIntervalDays - 1 // primeiro dia de reunião
	got := NextCalendarRate(cfg, dayIndex, 20, 0.05)

	want := 20 + 0.5*(10-20) // sem ruído (Volatility=0), só a reversão à média
	if got != want {
		t.Errorf("NextCalendarRate(dia de reunião) = %v, want %v", got, want)
	}
}

func TestNextCalendarRate_DeterministicaPorSeedEDayIndex(t *testing.T) {
	cfg := Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 1, InflationWeight: DefaultInflationWeight, Seed: 1}
	dayIndex := CopomMeetingIntervalDays - 1

	a := NextCalendarRate(cfg, dayIndex, 20, 0.01)
	b := NextCalendarRate(cfg, dayIndex, 20, 0.01)

	if a != b {
		t.Fatalf("NextCalendarRate divergiu com mesmos parâmetros: %v != %v", a, b)
	}
}

func TestNextCalendarRate_NuncaNegativa(t *testing.T) {
	cfg := Config{Neutral: 0, ReversionSpeed: 0.1, Volatility: 5, InflationWeight: DefaultInflationWeight, Seed: 7}

	rate := 0.5
	for day := 0; day < 1000; day++ {
		rate = NextCalendarRate(cfg, day, rate, 0.01)
		if rate < 0 {
			t.Fatalf("NextCalendarRate(dia %d) = %v, curva de juros simulada não pode ser negativa", day, rate)
		}
	}
}

func TestCalendarSeries_DiasNaoPositivoRetornaNil(t *testing.T) {
	tests := []int{0, -1, -10}
	for _, days := range tests {
		if got := CalendarSeries(DefaultConfig(10, 1), days, nil); got != nil {
			t.Errorf("CalendarSeries(days=%d) = %v, want nil", days, got)
		}
	}
}

// TestCalendarSeries_CurvaReflecteRendimentoDaRendaFixaPosFixada confere o
// critério de aceite da tarefa 3.3: a curva reage às "decisões" simuladas
// do Copom, refletindo no rendimento diário de um título pós-fixado
// (Tesouro Selic, CDB/LCI/LCA %CDI) — que, por definição, acompanha a taxa
// vigente dia a dia. O cálculo de capitalização diária é feito aqui, no
// teste, como consumidor ilustrativo da curva (a fórmula de precificação
// de pós-fixado em si é escopo de tarefa futura) — o que se comprova é que
// o fator de capitalização diário só muda no dia de uma reunião do Copom e
// fica idêntico entre reuniões.
func TestCalendarSeries_CurvaReflecteRendimentoDaRendaFixaPosFixada(t *testing.T) {
	cfg := Config{Initial: 20, Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}
	curve := CalendarSeries(cfg, CopomMeetingIntervalDays*2, nil)

	dailyAccrualFactor := func(annualRate float64) float64 {
		return math.Pow(1+annualRate/100, 1.0/252)
	}

	for i := 1; i < len(curve); i++ {
		factorToday := dailyAccrualFactor(curve[i])
		factorYesterday := dailyAccrualFactor(curve[i-1])

		if IsCopomMeetingDay(i) {
			if factorToday == factorYesterday {
				t.Fatalf("dia %d é reunião do Copom, mas o fator de capitalização do pós-fixado não mudou", i+1)
			}
		} else if factorToday != factorYesterday {
			t.Fatalf("dia %d não é reunião do Copom, mas o fator de capitalização do pós-fixado mudou (%v -> %v)", i+1, factorYesterday, factorToday)
		}
	}
}

// --- Tarefa I.1: regra de reação ao IPCA (backlog-motor-mercado-realista) ---

func TestNextCalendarRate_RegraDeReacaoAoDesvioDoIPCA(t *testing.T) {
	// ReversionSpeed = 0 e Neutral = currentRate isolam o termo de
	// reversão à média (fica em 0), deixando só o termo de IPCA (tarefa
	// I.1) mover a taxa — Volatility = 0 remove o ruído.
	cfg := Config{Neutral: 10, ReversionSpeed: 0, Volatility: 0, InflationWeight: DefaultInflationWeight, Seed: 1}
	dayIndex := CopomMeetingIntervalDays - 1

	tests := []struct {
		name                     string
		ipcaAccumulatedDeviation float64
		wantDirection            int // +1 sobe, -1 desce, 0 sem mudança
	}{
		// 0.02 (2 p.p.) — desvio realista (achado 007, resolvido:
		// DefaultInflationWeight recalibrado pra 7.5 exatamente pra que um
		// desvio desse tamanho já cruze meio passo de CopomStepIncrement —
		// 7.5×0.02 = 0.15 > 0.125 — em vez de precisar de um choque
		// artificial de 10 p.p. como antes da recalibração.
		{"IPCA acumulado acima da meta empurra a Selic simulada pra cima", 0.02, +1},
		{"IPCA acumulado abaixo da meta empurra a Selic simulada pra baixo", -0.02, -1},
		{"IPCA acumulado na meta não move a Selic via o termo de inflação", 0, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := NextCalendarRate(cfg, dayIndex, 10, tt.ipcaAccumulatedDeviation)
			switch tt.wantDirection {
			case 1:
				if got <= 10 {
					t.Fatalf("got = %v, esperava Selic simulada > 10 (IPCA acima da meta)", got)
				}
			case -1:
				if got >= 10 {
					t.Fatalf("got = %v, esperava Selic simulada < 10 (IPCA abaixo da meta)", got)
				}
			case 0:
				if got != 10 {
					t.Fatalf("got = %v, esperava Selic simulada inalterada (IPCA na meta)", got)
				}
			}
		})
	}
}

// TestCalendarSeries_IPCAPersistenteMoveASelicNasReuniõesSeguintes confere
// o critério de aceite da tarefa I.1 na forma de série: IPCA acumulado
// persistentemente acima (abaixo) da meta, em todo dia, empurra a Selic
// simulada pra cima (baixo) em cada reunião seguinte, comparado à mesma
// curva sem desvio de IPCA algum — mesmo Seed, então a sequência de ruído
// sorteada é idêntica nas duas curvas; só o termo de inflação (determinístico,
// sem aleatoriedade própria) diferencia o resultado.
func TestCalendarSeries_IPCAPersistenteMoveASelicNasReuniõesSeguintes(t *testing.T) {
	cfg := Config{Initial: 10, Neutral: 10, ReversionSpeed: 0.1, Volatility: 0.2, InflationWeight: DefaultInflationWeight, Seed: 1}
	days := CopomMeetingIntervalDays * 3
	meetingIndices := []int{CopomMeetingIntervalDays - 1, 2*CopomMeetingIntervalDays - 1, 3*CopomMeetingIntervalDays - 1}

	above := make([]float64, days)
	below := make([]float64, days)
	for i := range above {
		// 0.02 (2 p.p.), mesma magnitude realista de
		// TestNextCalendarRate_RegraDeReacaoAoDesvioDoIPCA (achado 007,
		// resolvido) — com ruído ativo (Volatility=0.2) nem toda reunião
		// isolada teria garantia de cruzar o arredondamento na direção
		// certa por si só, mas o teste soma 3 reuniões consecutivas com o
		// mesmo desvio persistente, e cada curva usa exatamente o mesmo
		// ruído sorteado (mesmo Seed) — só o termo de inflação diferencia
		// above/below/baseline, então o efeito acumula na direção certa.
		above[i] = 0.02
		below[i] = -0.02
	}

	baseline := CalendarSeries(cfg, days, nil)
	curveAbove := CalendarSeries(cfg, days, above)
	curveBelow := CalendarSeries(cfg, days, below)

	for _, i := range meetingIndices {
		if curveAbove[i] <= baseline[i] {
			t.Errorf("reunião no dia %d: IPCA acima da meta devia deixar a Selic mais alta que a curva-base — acima=%v base=%v", i+1, curveAbove[i], baseline[i])
		}
		if curveBelow[i] >= baseline[i] {
			t.Errorf("reunião no dia %d: IPCA abaixo da meta devia deixar a Selic mais baixa que a curva-base — abaixo=%v base=%v", i+1, curveBelow[i], baseline[i])
		}
	}
}

func TestNextCalendarRate_IndiceDeDesvioForaDoSliceValeZero(t *testing.T) {
	cfg := Config{Initial: 10, Neutral: 10, ReversionSpeed: 0, Volatility: 0, InflationWeight: DefaultInflationWeight, Seed: 1}
	dayIndex := CopomMeetingIntervalDays - 1

	got := NextCalendarRate(cfg, dayIndex, 10, 0)
	if got != 10 {
		t.Fatalf("got = %v, want 10 (desvio 0 não move a taxa)", got)
	}

	// CalendarSeries com slice mais curto que `days`: dias sem entrada
	// correspondente tratam o desvio como 0, sem pânico de índice.
	curve := CalendarSeries(cfg, CopomMeetingIntervalDays+5, []float64{0.1})
	if curve[CopomMeetingIntervalDays-1] != 10 {
		t.Fatalf("curve[%d] = %v, want 10 (índice de reunião fora do slice curto vale desvio 0)", CopomMeetingIntervalDays-1, curve[CopomMeetingIntervalDays-1])
	}
}

// TestNextCalendarRate_DesvioRealistaDeIPCAReageDeFormaGradualEEstavel
// documenta a resolução do achado 007 (pontos-em-aberto-decisao-produto.md,
// decisão do autor em 2026-09-19): `DefaultInflationWeight` recalibrado de
// 1.5 pra 7.5, mantendo `ipcaAccumulatedDeviation` decimal (ex: 0.02 para 2
// p.p., mesma convenção de `ipca.Config`) — o valor original tomava o
// coeficiente clássico da regra de Taylor (~1.5x) ao pé da letra sem
// considerar essa escala, deixando o termo praticamente inerte (só reagia
// a choques acima de 8,33 p.p., ver histórico do achado). 7.5 foi escolhido
// simulando `NextCalendarRate` reunião a reunião, não só o efeito isolado
// de uma reunião — porque o termo de inflação soma de novo a cada reunião
// enquanto o desvio persistir, e precisa conviver com `ReversionSpeed`/
// `CopomStepIncrement` sem divergir pra valores absurdos: este teste prova
// as três propriedades que a calibração buscou (rodando reunião a reunião
// com `ReversionSpeed`/`Volatility` puros de `DefaultConfig`, sem isolar o
// termo de inflação como os testes de I.1 acima) — desvio de ruído (<1
// p.p.) nunca move a Selic; um desvio persistente de 2 p.p. move em passos
// de 0,25 realistas e converge (não diverge) a um patamar estável; sinal
// negativo espelha o positivo.
func TestNextCalendarRate_DesvioRealistaDeIPCAReageDeFormaGradualEEstavel(t *testing.T) {
	cfg := DefaultConfig(10, 1)
	cfg.Volatility = 0 // isola o efeito do termo de inflação do ruído

	run := func(deviation float64, meetings int) (finalRate float64, changedMeetings int) {
		rate := cfg.Neutral
		dayIndex := CopomMeetingIntervalDays - 1
		for m := 0; m < meetings; m++ {
			next := NextCalendarRate(cfg, dayIndex, rate, deviation)
			if next != rate {
				changedMeetings++
			}
			rate = next
			dayIndex += CopomMeetingIntervalDays
		}
		return rate, changedMeetings
	}

	t.Run("desvio de ruído (0.5 p.p.) nunca move a Selic", func(t *testing.T) {
		finalRate, changed := run(0.005, 8)
		if changed != 0 || finalRate != cfg.Neutral {
			t.Fatalf("changed = %d, finalRate = %v — desvio de ruído não devia mover a Selic (achado 007)", changed, finalRate)
		}
	})

	t.Run("desvio persistente de 2 p.p. move em passos e converge, não diverge", func(t *testing.T) {
		finalRate, changed := run(0.02, 12)
		if changed == 0 {
			t.Fatal("desvio persistente de 2 p.p. devia mover a Selic em pelo menos uma reunião")
		}
		// Converge a um patamar estável bem antes das 12 reuniões — se
		// ainda estivesse mudando na última reunião simulada, é sinal de
		// que o termo está divergindo em vez de convergir (a regressão que
		// a recalibração do achado 007 quis evitar).
		penultimate, _ := run(0.02, 11)
		if finalRate != penultimate {
			t.Fatalf("finalRate(12 reuniões) = %v != finalRate(11 reuniões) = %v — devia ter convergido antes da 12ª", finalRate, penultimate)
		}
		// Ordem de grandeza plausível: nem inerte (achado 007 original),
		// nem um choque de política monetária inteiro numa única direção.
		if finalRate <= cfg.Neutral || finalRate-cfg.Neutral > 2.0 {
			t.Fatalf("finalRate = %v, esperava um patamar acima da neutra (%v) mas plausível (<= +2.0 p.p.)", finalRate, cfg.Neutral)
		}
	})

	t.Run("desvio negativo espelha o positivo", func(t *testing.T) {
		above, _ := run(0.02, 12)
		below, _ := run(-0.02, 12)
		if below >= cfg.Neutral {
			t.Fatalf("below = %v, esperava Selic abaixo da neutra (%v)", below, cfg.Neutral)
		}
		if math.Abs((above-cfg.Neutral)-(cfg.Neutral-below)) > 1e-9 {
			t.Fatalf("assimetria entre desvio positivo (+%v) e negativo (-%v) em torno da neutra", above-cfg.Neutral, cfg.Neutral-below)
		}
	})
}

// --- Tarefa I.2: passos discretos do Copom (backlog-motor-mercado-realista) ---

func Test_quantizeStep(t *testing.T) {
	tests := []struct {
		step float64
		want float64
	}{
		{0, 0},
		{0.1, 0},
		{0.2, 0.25},
		{-0.2, -0.25},
		{0.37, 0.25},
		{0.63, 0.75},
		{1.1, 1.0},
		{-1.1, -1.0},
		{0.25, 0.25},
		{-0.25, -0.25},
	}
	for _, tt := range tests {
		if got := quantizeStep(tt.step); math.Abs(got-tt.want) > 1e-9 {
			t.Errorf("quantizeStep(%v) = %v, want %v", tt.step, got, tt.want)
		}
	}
}

func TestNextCalendarRate_MovimentoQuantizadoParaOMultiploMaisProximo(t *testing.T) {
	// ReversionSpeed = 0.37 sobre um desvio de 10 p.p. produz um delta
	// bruto de -3.7 (não é múltiplo de 0,25) — a tarefa I.2 exige que o
	// movimento final aplicado seja o mais próximo múltiplo de
	// CopomStepIncrement, não o valor contínuo direto da regra de reação.
	cfg := Config{Neutral: 10, ReversionSpeed: 0.37, Volatility: 0, InflationWeight: 0, Seed: 1}
	dayIndex := CopomMeetingIntervalDays - 1

	got := NextCalendarRate(cfg, dayIndex, 20, 0)

	wantStep := quantizeStep(0.37 * (10 - 20)) // -3.75
	want := 20 + wantStep
	if math.Abs(got-want) > 1e-9 {
		t.Fatalf("got = %v, want %v (movimento quantizado pra %v, não o delta bruto -3.7)", got, want, wantStep)
	}
}

func TestNextCalendarRate_MudancaEmDiaDeReuniaoEhSempreMultiploDeCopomStepIncrement(t *testing.T) {
	cfg := Config{Neutral: 10, ReversionSpeed: 0.37, Volatility: 1.3, InflationWeight: DefaultInflationWeight, Seed: 7}

	rate := 10.0
	for day := 0; day < CopomMeetingIntervalDays*100; day++ {
		next := NextCalendarRate(cfg, day, rate, 0.017)
		if IsCopomMeetingDay(day) && next != 0 {
			// next == 0 é o piso de "Selic nunca negativa" clampando um
			// movimento que já era negativo o bastante — não é mais um
			// múltiplo exato de CopomStepIncrement em relação a rate, e
			// esse clamp não é uma "decisão de tamanho" do Copom.
			delta := next - rate
			steps := delta / CopomStepIncrement
			if math.Abs(steps-math.Round(steps)) > 1e-9 {
				t.Fatalf("dia %d: mudança de %v p.p. não é múltiplo de %v p.p.", day+1, delta, CopomStepIncrement)
			}
		}
		rate = next
	}
}
