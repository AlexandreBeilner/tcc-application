package selic

import (
	"math"
	"testing"
)

func TestCalendarSeries_ReversaoAMediaSoNoDiaDeReuniao(t *testing.T) {
	// Volatility = 0 remove o ruído, deixando só a reversão à média —
	// mesmo espírito do teste numérico exato de Series.
	cfg := Config{Initial: 20, Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}

	got := CalendarSeries(cfg, CopomMeetingIntervalDays*2)

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

	a := CalendarSeries(cfg, 100)
	b := CalendarSeries(cfg, 100)

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
	a := CalendarSeries(DefaultConfig(10.75, 1), 100)
	b := CalendarSeries(DefaultConfig(10.75, 2), 100)

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
	cfg := Config{Initial: 0.5, Neutral: 0, ReversionSpeed: 0.1, Volatility: 5, Seed: 7}

	for i, rate := range CalendarSeries(cfg, 1000) {
		if rate < 0 {
			t.Fatalf("curve[%d] = %v, curva de juros simulada não pode ser negativa", i, rate)
		}
	}
}

func TestNextCalendarRate_ForaDeDiaDeReuniaoDevolveTaxaInalterada(t *testing.T) {
	cfg := Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 1, Seed: 1}

	for i := 0; i < CopomMeetingIntervalDays-1; i++ {
		if got := NextCalendarRate(cfg, i, 20); got != 20 {
			t.Fatalf("NextCalendarRate(dia %d, sem reunião) = %v, want 20 (inalterada)", i, got)
		}
	}
}

func TestNextCalendarRate_DiaDeReuniaoMudaATaxa(t *testing.T) {
	cfg := Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 0, Seed: 1}

	dayIndex := CopomMeetingIntervalDays - 1 // primeiro dia de reunião
	got := NextCalendarRate(cfg, dayIndex, 20)

	want := 20 + 0.5*(10-20) // sem ruído (Volatility=0), só a reversão à média
	if got != want {
		t.Errorf("NextCalendarRate(dia de reunião) = %v, want %v", got, want)
	}
}

func TestNextCalendarRate_DeterministicaPorSeedEDayIndex(t *testing.T) {
	cfg := Config{Neutral: 10, ReversionSpeed: 0.5, Volatility: 1, Seed: 1}
	dayIndex := CopomMeetingIntervalDays - 1

	a := NextCalendarRate(cfg, dayIndex, 20)
	b := NextCalendarRate(cfg, dayIndex, 20)

	if a != b {
		t.Fatalf("NextCalendarRate divergiu com mesmos parâmetros: %v != %v", a, b)
	}
}

func TestNextCalendarRate_NuncaNegativa(t *testing.T) {
	cfg := Config{Neutral: 0, ReversionSpeed: 0.1, Volatility: 5, Seed: 7}

	rate := 0.5
	for day := 0; day < 1000; day++ {
		rate = NextCalendarRate(cfg, day, rate)
		if rate < 0 {
			t.Fatalf("NextCalendarRate(dia %d) = %v, curva de juros simulada não pode ser negativa", day, rate)
		}
	}
}

func TestCalendarSeries_DiasNaoPositivoRetornaNil(t *testing.T) {
	tests := []int{0, -1, -10}
	for _, days := range tests {
		if got := CalendarSeries(DefaultConfig(10, 1), days); got != nil {
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
	curve := CalendarSeries(cfg, CopomMeetingIntervalDays*2)

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
