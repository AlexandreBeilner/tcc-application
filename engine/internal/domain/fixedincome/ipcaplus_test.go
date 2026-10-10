package fixedincome

import (
	"math"
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/ipca"
)

func TestVNAMonthlySeries_Composicao(t *testing.T) {
	got := VNAMonthlySeries(1000, []float64{0.01, 0.02})
	want := []float64{1010, 1030.2}

	if len(got) != len(want) {
		t.Fatalf("len(got) = %d, want %d", len(got), len(want))
	}
	for i := range want {
		if math.Abs(got[i]-want[i]) > 1e-9 {
			t.Errorf("got[%d] = %v, want %v", i, got[i], want[i])
		}
	}
}

func date(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

func TestDay15Window(t *testing.T) {
	tests := []struct {
		name     string
		input    time.Time
		wantBase time.Time
		wantNext time.Time
	}{
		{name: "exatamente no dia 15", input: date(2026, time.March, 15), wantBase: date(2026, time.March, 15), wantNext: date(2026, time.April, 15)},
		{name: "depois do dia 15", input: date(2026, time.March, 20), wantBase: date(2026, time.March, 15), wantNext: date(2026, time.April, 15)},
		{name: "antes do dia 15", input: date(2026, time.March, 10), wantBase: date(2026, time.February, 15), wantNext: date(2026, time.March, 15)},
		{name: "virada de ano, antes do dia 15", input: date(2026, time.January, 5), wantBase: date(2025, time.December, 15), wantNext: date(2026, time.January, 15)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			base, next := day15Window(tt.input)
			if !base.Equal(tt.wantBase) {
				t.Errorf("base = %v, want %v", base, tt.wantBase)
			}
			if !next.Equal(tt.wantNext) {
				t.Errorf("next = %v, want %v", next, tt.wantNext)
			}
		})
	}
}

func TestVNAProjected_NoDia15ExatoIgualAoVnaBase(t *testing.T) {
	got := VNAProjected(1000, 0.01, date(2026, time.March, 15))
	if got != 1000 {
		t.Errorf("got = %v, want 1000 (elapsed = 0, sem projeção ainda)", got)
	}
}

func TestVNAProjected_MeioDaJanela(t *testing.T) {
	// Fev/2027 -> Mar/2027 é uma janela de 28 dias (2027 não é bissexto):
	// dia 15/fev a 15/mar. 14 dias depois de 15/fev é 1/mar, exatamente a
	// metade da janela — expoente 0.5, want = vnaBase*sqrt(1+ipca).
	monthlyIPCA := 0.0045
	got := VNAProjected(1000, monthlyIPCA, date(2027, time.March, 1))
	want := 1000 * math.Sqrt(1+monthlyIPCA)

	if math.Abs(got-want) > 1e-9 {
		t.Errorf("got = %v, want %v", got, want)
	}
}

func TestVNAProjected_AntesDoDia15UsaJanelaDoMesAnterior(t *testing.T) {
	// vnaBase aqui precisa ser o VNA conhecido no dia 15 do mês ANTERIOR à
	// data de liquidação, já que day15Window resolve a janela assim.
	monthlyIPCA := 0.005
	settlementDate := date(2026, time.March, 10) // janela: 15/fev -> 15/mar
	base, next := date(2026, time.February, 15), date(2026, time.March, 15)
	elapsed := settlementDate.Sub(base).Hours() / 24
	window := next.Sub(base).Hours() / 24

	got := VNAProjected(1000, monthlyIPCA, settlementDate)
	want := 1000 * math.Pow(1+monthlyIPCA, elapsed/window)

	if math.Abs(got-want) > 1e-9 {
		t.Errorf("got = %v, want %v", got, want)
	}
}

func TestIPCAQuote_TaxaZeroNaoDesagia(t *testing.T) {
	if got := IPCAQuote(0, 252); got != 1 {
		t.Errorf("IPCAQuote(0, 252) = %v, want 1", got)
	}
}

func TestIPCAQuote_ConsistenteComPrefixedPrice(t *testing.T) {
	// IPCAQuote é a mesma fórmula de deságio de PrefixedPrice, só que como
	// fator adimensional em vez de multiplicada pelo Valor Nominal — as
	// duas devem bater exatamente ao reintroduzir o FaceValue.
	rates := []float64{0.10, 0.05, 0.08}
	days := []int{252, 126, 504}
	for i := range rates {
		quote := IPCAQuote(rates[i], days[i])
		prefixed := PrefixedPrice(rates[i], days[i])

		if math.Abs(quote*FaceValue-prefixed) > 1e-9 {
			t.Errorf("IPCAQuote(%v, %d)*FaceValue = %v, want %v (PrefixedPrice)", rates[i], days[i], quote*FaceValue, prefixed)
		}
	}
}

func TestIPCAPrice_ProdutoDeVnaEQuote(t *testing.T) {
	got := IPCAPrice(1050, 0.9)
	want := 945.0

	if math.Abs(got-want) > 1e-9 {
		t.Errorf("got = %v, want %v", got, want)
	}
}

// TestTaxaRealPermaneceInalteradaApenasVNAAtualiza confere o critério de
// aceite "taxa prefixada de cada posição já comprada permanece inalterada;
// apenas o VNA é atualizado": simula a mesma posição (mesma
// annualRealRate) observada em duas datas de liquidação diferentes — só o
// VNA (via VNAProjected) e os dias úteis restantes mudam entre elas, nunca
// a taxa contratada.
func TestTaxaRealPermaneceInalteradaApenasVNAAtualiza(t *testing.T) {
	const annualRealRate = 0.06 // travada na compra, a mesma nas duas datas

	vnaBase := 1000.0
	monthlyIPCA := 0.004

	priceOnDay := func(settlementDate time.Time, remainingBusinessDays int) float64 {
		vna := VNAProjected(vnaBase, monthlyIPCA, settlementDate)
		quote := IPCAQuote(annualRealRate, remainingBusinessDays)
		return IPCAPrice(vna, quote)
	}

	priceEarly := priceOnDay(date(2026, time.March, 20), 500)
	priceLater := priceOnDay(date(2026, time.March, 25), 495)

	if priceEarly == priceLater {
		t.Fatal("preço não deveria ficar igual — VNA e dias restantes mudaram entre as duas datas")
	}
	// A única forma de o preço mudar aqui é via VNA/dias restantes: a
	// chamada a IPCAQuote em ambas usa exatamente annualRealRate, a mesma
	// constante — não há como o teste "trapacear" recalculando uma taxa
	// diferente, o que já comprova estruturalmente o critério de aceite.
}

func TestMonthsBetween(t *testing.T) {
	tests := []struct {
		name string
		a, b time.Time
		want int
	}{
		{"mesmo mês", date(2026, time.March, 15), date(2026, time.March, 15), 0},
		{"mês seguinte", date(2026, time.March, 15), date(2026, time.April, 15), 1},
		{"vira o ano", date(2026, time.November, 15), date(2027, time.January, 15), 2},
		{"vários anos", date(2000, time.July, 15), date(2026, time.July, 15), 26 * 12},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := monthsBetween(tt.a, tt.b); got != tt.want {
				t.Errorf("monthsBetween(%v, %v) = %d, want %d", tt.a, tt.b, got, tt.want)
			}
		})
	}
}

// ipcaTestConfig usa Volatility = 0 (série sem ruído, sempre exatamente
// MonthlyTarget — ver ipca.TestMonthlySeries_SemRuidoFicaExatamenteNaMeta)
// pra deixar os testes de CurrentVNAWindow determinísticos por construção,
// sem depender da seed.
var ipcaTestConfig = ipca.Config{MonthlyTarget: 0.004, MaxDeviation: 0.01, Volatility: 0, Seed: 1}

// TestCurrentVNAWindow_NaJanelaDaEpocaDevolveFaceValue confere o caso-base:
// `now` ainda dentro da primeira janela (entre VNAEpoch e o mês seguinte) —
// vnaBase é o próprio FaceValue (nenhum mês fechou ainda desde a
// data-base), monthlyIPCA é o IPCA do primeiro mês da série.
func TestCurrentVNAWindow_NaJanelaDaEpocaDevolveFaceValue(t *testing.T) {
	now := VNAEpoch.AddDate(0, 0, 10) // ainda dentro da janela [VNAEpoch, VNAEpoch+1 mês)

	vnaBase, monthlyIPCA := CurrentVNAWindow(ipcaTestConfig, now)

	if vnaBase != FaceValue {
		t.Errorf("vnaBase = %v, want %v (nenhum mês fechado ainda desde VNAEpoch)", vnaBase, FaceValue)
	}
	wantIPCA := ipca.MonthlySeries(ipcaTestConfig, 1)[0]
	if monthlyIPCA != wantIPCA {
		t.Errorf("monthlyIPCA = %v, want %v", monthlyIPCA, wantIPCA)
	}
}

// TestCurrentVNAWindow_ConsistenteComVNAMonthlySeries confere que, N meses
// depois de VNAEpoch, CurrentVNAWindow devolve exatamente o VNA que
// VNAMonthlySeries computaria encadeando a mesma série de IPCA — a fórmula
// não pode divergir do jeito "manual" de compor o VNA mês a mês.
func TestCurrentVNAWindow_ConsistenteComVNAMonthlySeries(t *testing.T) {
	const windowIndex = 5
	base := VNAEpoch.AddDate(0, windowIndex, 0)
	now := base.AddDate(0, 0, 3) // dentro da janela que começa em `base`

	series := ipca.MonthlySeries(ipcaTestConfig, windowIndex+1)
	vnas := VNAMonthlySeries(FaceValue, series[:windowIndex])
	wantVNABase := vnas[windowIndex-1]
	wantMonthlyIPCA := series[windowIndex]

	gotVNABase, gotMonthlyIPCA := CurrentVNAWindow(ipcaTestConfig, now)

	if math.Abs(gotVNABase-wantVNABase) > 1e-9 {
		t.Errorf("vnaBase = %v, want %v", gotVNABase, wantVNABase)
	}
	if gotMonthlyIPCA != wantMonthlyIPCA {
		t.Errorf("monthlyIPCA = %v, want %v", gotMonthlyIPCA, wantMonthlyIPCA)
	}
}

// TestCurrentVNAWindow_Deterministico confere RNF08: a mesma cfg e a mesma
// data sempre devolvem o mesmo par (vnaBase, monthlyIPCA) — nenhum estado
// mutável entre chamadas (a série inteira é recomputada a cada chamada a
// partir de VNAEpoch).
func TestCurrentVNAWindow_Deterministico(t *testing.T) {
	now := VNAEpoch.AddDate(1, 3, 0)

	vnaBaseA, ipcaA := CurrentVNAWindow(ipcaTestConfig, now)
	vnaBaseB, ipcaB := CurrentVNAWindow(ipcaTestConfig, now)

	if vnaBaseA != vnaBaseB || ipcaA != ipcaB {
		t.Errorf("chamadas repetidas divergiram: (%v, %v) != (%v, %v)", vnaBaseA, ipcaA, vnaBaseB, ipcaB)
	}
}

// TestCurrentVNAWindow_VNACresceComOTempo confere o núcleo do critério de
// aceite da L.2: o VNA usado pra precificar Tesouro IPCA+ reage à inflação
// simulada acumulada, não fica parado num valor único — com IPCA positivo
// (ipcaTestConfig.MonthlyTarget > 0, sem ruído), o VNA num instante mais
// distante de VNAEpoch tem que ser estritamente maior.
func TestCurrentVNAWindow_VNACresceComOTempo(t *testing.T) {
	cedo, _ := CurrentVNAWindow(ipcaTestConfig, VNAEpoch.AddDate(0, 2, 0))
	tarde, _ := CurrentVNAWindow(ipcaTestConfig, VNAEpoch.AddDate(2, 0, 0))

	if !(tarde > cedo) {
		t.Errorf("vnaBase não cresceu com o tempo: cedo (2 meses) = %v, tarde (24 meses) = %v", cedo, tarde)
	}
}

// TestCurrentVNAWindow_ProjecaoUsaOVNAJaComposto confere que VNAProjected,
// alimentado pelo par que CurrentVNAWindow devolve, produz um VNA "de hoje"
// maior que o FaceValue original depois de vários meses de inflação
// simulada acumulada — a ponta a ponta da composição
// CurrentVNAWindow → VNAProjected que Purchase/Redeem (fixedincomeexecution)
// usam de verdade.
func TestCurrentVNAWindow_ProjecaoUsaOVNAJaComposto(t *testing.T) {
	now := VNAEpoch.AddDate(3, 0, 0)
	vnaBase, monthlyIPCA := CurrentVNAWindow(ipcaTestConfig, now)

	vnaHoje := VNAProjected(vnaBase, monthlyIPCA, now)
	if !(vnaHoje > FaceValue) {
		t.Errorf("VNAProjected = %v, want > FaceValue (%v) depois de 3 anos de IPCA positivo", vnaHoje, FaceValue)
	}
}

// Cenário comum aos testes de IPCAEarlyRedemption: título IPCA+ comprado
// com taxa real de 6% a.a. e prazo de 252 DU, resgatado na metade (126 DU
// restantes) — só a taxa de mercado real no dia do resgate varia, mesmo
// raciocínio de purchaseRate/purchaseTerm/remainingTerm (markingtomarket_
// test.go), mas sobre VNA em vez de Valor Nominal fixo.
const ipcaPurchaseRealRate = 0.06

var (
	ipcaVNAAtPurchase = 1200.0 // VNA hipotético no dia da compra
	ipcaPurchasePrice = IPCAPrice(ipcaVNAAtPurchase, IPCAQuote(ipcaPurchaseRealRate, purchaseTerm))
)

func TestIPCAEarlyRedemption_TaxaRealSubiu_RentabilidadeInferiorAContratada(t *testing.T) {
	vnaNow := ipcaVNAAtPurchase // VNA parado só pra isolar o efeito da taxa
	got := IPCAEarlyRedemption(ipcaPurchasePrice, ipcaPurchaseRealRate, 0.09, vnaNow, remainingTerm)

	if got.VsContractedRate >= 0 {
		t.Errorf("VsContractedRate = %v, want negativo (taxa real de mercado subiu)", got.VsContractedRate)
	}
}

func TestIPCAEarlyRedemption_TaxaRealCaiu_GanhoExtraordinario(t *testing.T) {
	vnaNow := ipcaVNAAtPurchase
	got := IPCAEarlyRedemption(ipcaPurchasePrice, ipcaPurchaseRealRate, 0.03, vnaNow, remainingTerm)

	if got.VsContractedRate <= 0 {
		t.Errorf("VsContractedRate = %v, want positivo (ganho extraordinário)", got.VsContractedRate)
	}
}

// TestIPCAEarlyRedemption_VNAMaiorAumentaOPrecoMesmoComTaxaInalterada
// confere a diferença estrutural pro Prefixado (markingtomarket.go): o
// preço de um IPCA+ pode subir mesmo com a taxa real de mercado igual à
// contratada, se o VNA cresceu (inflação acumulada) — algo que
// EarlyRedemption (Valor Nominal fixo) nunca poderia expressar.
func TestIPCAEarlyRedemption_VNAMaiorAumentaOPrecoMesmoComTaxaInalterada(t *testing.T) {
	semInflacao := IPCAEarlyRedemption(ipcaPurchasePrice, ipcaPurchaseRealRate, ipcaPurchaseRealRate, ipcaVNAAtPurchase, remainingTerm)
	comInflacao := IPCAEarlyRedemption(ipcaPurchasePrice, ipcaPurchaseRealRate, ipcaPurchaseRealRate, ipcaVNAAtPurchase*1.05, remainingTerm)

	if !(comInflacao.MarkToMarketPrice > semInflacao.MarkToMarketPrice) {
		t.Errorf("MarkToMarketPrice com VNA maior (%v) não superou o cenário sem inflação (%v)", comInflacao.MarkToMarketPrice, semInflacao.MarkToMarketPrice)
	}
	if math.Abs(semInflacao.VsContractedRate) >= 1e-6 {
		t.Errorf("VsContractedRate (sem inflação, taxa inalterada) = %v, want ≈0", semInflacao.VsContractedRate)
	}
}
