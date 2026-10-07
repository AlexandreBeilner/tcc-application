package paymentschedule

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/fundamentals"
	"tcc-investimentos/engine/internal/domain/simcalendar"
)

// O dia 0 simulado é segunda-feira: 4 = sexta, 5 = sábado, 6 = domingo, 7 = segunda.
func TestAddBusinessDays(t *testing.T) {
	tests := []struct {
		name   string
		day, n int
		want   int
	}{
		{"zero em dia útil fica", 2, 0, 2},
		{"zero em sábado vai para segunda", 5, 0, 7},
		{"zero em domingo vai para segunda", 6, 0, 7},
		{"sexta mais 1 é segunda", 4, 1, 7},
		{"sábado mais 1 é terça (a segunda já é o 0)", 5, 1, 8},
		{"segunda mais 5 é a segunda seguinte", 0, 5, 7},
		{"segunda mais 10", 0, 10, 14},
		{"negativo vale zero", 2, -3, 2},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := AddBusinessDays(tt.day, tt.n); got != tt.want {
				t.Errorf("AddBusinessDays(%d, %d) = %d, quer %d", tt.day, tt.n, got, tt.want)
			}
		})
	}
}

// Offset 0 é o legado, sem nenhum ajuste de dia útil: equivalência exaustiva.
func TestIsReportDay_OffsetZeroEquivaleAoLegado(t *testing.T) {
	for _, freq := range []int{fundamentals.DefaultReportFrequencyDays, 7, 30, 91} {
		for dayIndex := 0; dayIndex <= 2000; dayIndex++ {
			if got, want := IsReportDay(dayIndex, freq, 0), fundamentals.IsReportDay(dayIndex, freq); got != want {
				t.Fatalf("freq %d, dayIndex %d: %v, legado %v", freq, dayIndex, got, want)
			}
			if k, ok := CycleIndex(dayIndex, freq, 0); ok && k != (dayIndex+1)/freq-1 {
				t.Fatalf("freq %d, dayIndex %d: ciclo %d, legado %d", freq, dayIndex, k, (dayIndex+1)/freq-1)
			}
		}
	}
}

func TestReportDay_ComOffset(t *testing.T) {
	// Ciclo 0 fecha no dia 91 (quinta-feira: 91 % 7 = 0 é segunda, 91 = 13 semanas = segunda).
	if got := ReportDay(91, 0, 0); got != 91 {
		t.Fatalf("offset 0 deve ser o fim do ciclo, foi %d", got)
	}
	tests := []struct {
		name          string
		offset, cycle int
		want          int
	}{
		{"1 dia útil depois de uma segunda é terça", 1, 0, 92},
		{"5 dias úteis depois são uma semana", 5, 0, 98},
		{"4 dias úteis caem na sexta, sem empurrar", 4, 0, 95},
		{"6 dias úteis passam o fim de semana", 6, 0, 99},
		{"ciclo seguinte", 3, 1, 182 + 3 + 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := ReportDay(91, tt.offset, tt.cycle)
			if tt.name == "ciclo seguinte" {
				// 182 % 7 = 0 (segunda), 3 dias úteis = quinta.
				tt.want = 185
			}
			if got != tt.want {
				t.Errorf("ReportDay(91, %d, %d) = %d, quer %d", tt.offset, tt.cycle, got, tt.want)
			}
		})
	}
}

func TestReportDay_ComOffsetSempreEmDiaUtilEUnicoPorCiclo(t *testing.T) {
	for offset := 1; offset < ReportWindowBusinessDays; offset++ {
		reports := map[int]int{} // newDay -> ciclo
		for dayIndex := 0; dayIndex < 91*8; dayIndex++ {
			k, ok := CycleIndex(dayIndex, 91, offset)
			if !ok {
				if IsReportDay(dayIndex, 91, offset) {
					t.Fatalf("offset %d: IsReportDay e CycleIndex divergem em %d", offset, dayIndex)
				}
				continue
			}
			newDay := dayIndex + 1
			if !simcalendar.IsBusinessDay(newDay) {
				t.Fatalf("offset %d: balanço em dia não útil %d", offset, newDay)
			}
			if got := ReportDay(91, offset, k); got != newDay {
				t.Fatalf("offset %d: ciclo %d volta %d, achou em %d", offset, k, got, newDay)
			}
			reports[newDay] = k
		}
		// Um balanço por ciclo, ciclos 0..6 (o 7º cai depois da janela varrida) em ordem.
		if len(reports) < 7 {
			t.Fatalf("offset %d: só %d balanços em 8 trimestres", offset, len(reports))
		}
		seen := map[int]bool{}
		for _, k := range reports {
			if seen[k] {
				t.Fatalf("offset %d: ciclo %d reportou duas vezes", offset, k)
			}
			seen[k] = true
		}
	}
}

func TestReportDay_DentroDoPrazoDeAproximadamente45Dias(t *testing.T) {
	for offset := 0; offset < ReportWindowBusinessDays; offset++ {
		for cycle := 0; cycle < 12; cycle++ {
			base := (cycle + 1) * 91
			if lag := ReportDay(91, offset, cycle) - base; lag < 0 || lag > 46 {
				t.Fatalf("offset %d, ciclo %d: atraso de %d dias corridos", offset, cycle, lag)
			}
		}
	}
}

func TestComExPagamento(t *testing.T) {
	// Balanço numa sexta (dia 4): com 0 dias depois = sexta, ex = segunda, pagamento 5 dias úteis depois.
	com := ComDay(4, 0)
	if com != 4 {
		t.Errorf("data-com = %d, quer 4", com)
	}
	if ex := ExDay(com); ex != 7 {
		t.Errorf("data-ex = %d, quer 7 (a segunda)", ex)
	}
	if pay := PaymentDay(7, 5); pay != 14 {
		t.Errorf("pagamento = %d, quer 14", pay)
	}
	// Declaração num sábado do legado: a data-com vai para a segunda.
	if got := ComDay(5, 0); got != 7 {
		t.Errorf("com de declaração em sábado = %d, quer 7", got)
	}
}

func TestPagamentoNuncaEmFimDeSemana(t *testing.T) {
	for declaration := 0; declaration < 120; declaration++ {
		for comLag := MinComLagBusinessDays; comLag <= MaxComLagBusinessDays; comLag++ {
			com := ComDay(declaration, comLag)
			ex := ExDay(com)
			for payLag := MinPaymentLagBusinessDays; payLag <= MaxPaymentLagBusinessDays; payLag++ {
				pay := PaymentDay(ex, payLag)
				if !simcalendar.IsBusinessDay(com) || !simcalendar.IsBusinessDay(ex) || !simcalendar.IsBusinessDay(pay) {
					t.Fatalf("declaração %d: com %d, ex %d ou pagamento %d em dia não útil", declaration, com, ex, pay)
				}
				if declaration > com || com >= ex || ex >= pay {
					t.Fatalf("ordem quebrada: %d, %d, %d, %d", declaration, com, ex, pay)
				}
				if pay-ex > 60 {
					t.Fatalf("pagamento %d dias corridos depois da ex passa o teto legal de 60", pay-ex)
				}
			}
		}
	}
}

func TestPolicy(t *testing.T) {
	tests := []struct {
		policy      Policy
		wantCycles  [4]bool
		wantPerYear int
		wantPool    int
	}{
		{Quarterly, [4]bool{true, true, true, true}, 4, 1},
		{Semiannual, [4]bool{false, true, false, true}, 2, 2},
		{Annual, [4]bool{false, false, false, true}, 1, 4},
		{Policy("mensal"), [4]bool{true, true, true, true}, 4, 1},
	}
	for _, tt := range tests {
		t.Run(string(tt.policy), func(t *testing.T) {
			if got := EquityPayoutCycles(tt.policy); got != tt.wantCycles {
				t.Errorf("ciclos = %v, quer %v", got, tt.wantCycles)
			}
			payments := 0
			for cycle := 0; cycle < 8; cycle++ {
				if PaysInCycle(tt.policy, cycle) {
					payments++
				}
			}
			if payments != tt.wantPerYear*2 {
				t.Errorf("%d pagamentos em 2 anos, quer %d", payments, tt.wantPerYear*2)
			}
			if got := PoolCycles(tt.policy); got != tt.wantPool {
				t.Errorf("pool = %d, quer %d", got, tt.wantPool)
			}
		})
	}
	if PaysInCycle(Quarterly, -1) {
		t.Error("ciclo negativo não paga")
	}
	if Policy("x").IsValid() || !Annual.IsValid() {
		t.Error("IsValid errado")
	}
}

// O pool de um pagamento cobre exatamente os ciclos desde o pagamento anterior.
func TestPoolCoincideComOIntervaloEntrePagamentos(t *testing.T) {
	for _, p := range []Policy{Quarterly, Semiannual, Annual} {
		last := -1
		for cycle := 0; cycle < 16; cycle++ {
			if !PaysInCycle(p, cycle) {
				continue
			}
			if last >= 0 && cycle-last != PoolCycles(p) {
				t.Errorf("%s: pagamentos nos ciclos %d e %d, pool %d", p, last, cycle, PoolCycles(p))
			}
			last = cycle
		}
	}
}
