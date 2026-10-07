package paymentschedule

import (
	"fmt"
	"math"
	"testing"

	"tcc-investimentos/engine/internal/domain/catalog"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

var allSectors = []catalog.Sector{
	catalog.SectorMineracao, catalog.SectorAgronegocio, catalog.SectorBancario,
	catalog.SectorVarejo, catalog.SectorEnergia, catalog.SectorTecnologia,
}

func syntheticTickers(n int) []string {
	tickers := make([]string, n)
	for i := range tickers {
		tickers[i] = fmt.Sprintf("SYN%04d3", i)
	}
	return tickers
}

func TestDefaultsFor_Deterministico(t *testing.T) {
	first := DefaultsFor("BNDD3", catalog.SectorBancario)
	for i := 0; i < 5; i++ {
		if got := DefaultsFor("BNDD3", catalog.SectorBancario); got != first {
			t.Fatalf("mesma entrada, saídas diferentes: %+v e %+v", first, got)
		}
	}
	// A ordem em que os ativos são cadastrados não muda a agenda de nenhum.
	forward := map[string]Schedule{}
	tickers := syntheticTickers(50)
	for _, ticker := range tickers {
		forward[ticker] = DefaultsFor(ticker, catalog.SectorEnergia)
	}
	for i := len(tickers) - 1; i >= 0; i-- {
		if got := DefaultsFor(tickers[i], catalog.SectorEnergia); got != forward[tickers[i]] {
			t.Fatalf("%s mudou com a ordem de cadastro", tickers[i])
		}
	}
}

func TestDefaultsFor_DentroDasFaixas(t *testing.T) {
	for _, ticker := range syntheticTickers(2000) {
		for _, sector := range allSectors {
			s := DefaultsFor(ticker, sector)
			switch {
			case s.ReportOffsetBusinessDays < 0 || s.ReportOffsetBusinessDays >= ReportWindowBusinessDays:
				t.Fatalf("%s: offset %d fora de [0, %d)", ticker, s.ReportOffsetBusinessDays, ReportWindowBusinessDays)
			case !s.Policy.IsValid():
				t.Fatalf("%s: política %q inválida", ticker, s.Policy)
			case s.ComLagBusinessDays < MinComLagBusinessDays || s.ComLagBusinessDays > MaxComLagBusinessDays:
				t.Fatalf("%s: defasagem da data-com %d", ticker, s.ComLagBusinessDays)
			case s.PaymentLagBusinessDays < MinPaymentLagBusinessDays || s.PaymentLagBusinessDays > MaxPaymentLagBusinessDays:
				t.Fatalf("%s: defasagem do pagamento %d", ticker, s.PaymentLagBusinessDays)
			case s.FIIPaymentBusinessDay < 5 || s.FIIPaymentBusinessDay > 15:
				t.Fatalf("%s: dia útil do FII %d fora de 5..15", ticker, s.FIIPaymentBusinessDay)
			}
		}
	}
}

func TestDefaultsFor_SetorDesconhecidoPagaTrimestral(t *testing.T) {
	if got := DefaultsFor("XYZW3", catalog.Sector("Outro")).Policy; got != Quarterly {
		t.Errorf("política = %s, quer %s", got, Quarterly)
	}
}

// Catálogo de 1.000 ativos: a distribuição segue os pesos calibrados e nenhum dia
// concentra mais que o limiar documentado: balanço, pior dia <= 14% do catálogo;
// FII, <= 20% (o pico do 10º dia útil é real, ver calibracao-calendario-proventos.md).
func TestDefaultsFor_DispersaoEmCatalogoSintetico(t *testing.T) {
	const n = 1000
	limits := map[string]float64{"balanço": 0.14, "FII": 0.20}
	tickers := syntheticTickers(n)

	offsets := map[int]int{}
	fiiDays := map[int]int{}
	for _, ticker := range tickers {
		s := DefaultsFor(ticker, catalog.SectorEnergia)
		offsets[s.ReportOffsetBusinessDays]++
		fiiDays[s.FIIPaymentBusinessDay]++
	}
	for name, counts := range map[string]map[int]int{"balanço": offsets, "FII": fiiDays} {
		worst := 0
		for _, c := range counts {
			worst = max(worst, c)
		}
		if share := float64(worst) / n; share > limits[name] {
			t.Errorf("%s: pior dia concentra %.1f%% do catálogo (limite %.0f%%)", name, share*100, limits[name]*100)
		}
	}

	// As três faixas do offset de balanço seguem 5/30/65 com tolerância de amostra.
	bands := [3]int{}
	for off, c := range offsets {
		switch {
		case off <= 20:
			bands[0] += c
		case off <= 25:
			bands[1] += c
		default:
			bands[2] += c
		}
	}
	for i, want := range []float64{0.05, 0.30, 0.65} {
		if got := float64(bands[i]) / n; math.Abs(got-want) > 0.05 {
			t.Errorf("faixa %d do offset: %.1f%%, esperado %.0f%%", i, got*100, want*100)
		}
	}
}

func TestDefaultsFor_PesosDePoliticaPorSetor(t *testing.T) {
	const n = 3000
	for sector, weights := range policyWeights {
		counts := map[Policy]int{}
		for _, ticker := range syntheticTickers(n) {
			counts[DefaultsFor(ticker, sector).Policy]++
		}
		for i, p := range []Policy{Quarterly, Semiannual, Annual} {
			if got, want := float64(counts[p])/n, float64(weights[i])/100; math.Abs(got-want) > 0.04 {
				t.Errorf("%s/%s: %.1f%%, esperado %.0f%%", sector, p, got*100, want*100)
			}
		}
	}
}

// O balanço escalonado de um catálogo sintético nunca cai em fim de semana e fica
// dentro do prazo, e a pior concentração em um único dia útil respeita o limiar.
func TestDefaultsFor_BalancoEscalonadoEmDiasUteis(t *testing.T) {
	const n = 1000
	perDay := map[int]int{}
	for _, ticker := range syntheticTickers(n) {
		s := DefaultsFor(ticker, catalog.SectorVarejo)
		day := ReportDay(91, s.ReportOffsetBusinessDays, 0)
		if s.ReportOffsetBusinessDays > 0 && !simcalendar.IsBusinessDay(day) {
			t.Fatalf("%s: balanço em dia não útil %d", ticker, day)
		}
		perDay[day]++
	}
	worst := 0
	for _, c := range perDay {
		worst = max(worst, c)
	}
	if share := float64(worst) / n; share > 0.14 {
		t.Errorf("pior dia do trimestre concentra %.1f%% dos balanços", share*100)
	}
}
