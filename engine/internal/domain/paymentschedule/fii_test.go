package paymentschedule

import (
	"testing"
	"time"

	"tcc-investimentos/engine/internal/domain/simcalendar"
)

func date(day int) string { return simcalendar.DateOf(day).Format("2006-01-02") }

func TestFIIPayoutDays(t *testing.T) {
	tests := []struct {
		name                 string
		year                 int
		month                time.Month
		payBusinessDay       int
		wantCom, wantEx, pay string
	}{
		{"mês que termina em dia útil (jan/2026, 31 é sábado: com na sexta 30)", 2026, time.January, 10, "2026-01-30", "2026-02-02", "2026-02-13"},
		{"fevereiro de 28 dias terminando em sábado", 2026, time.February, 10, "2026-02-27", "2026-03-02", "2026-03-13"},
		{"março, mês seguinte começa na quarta (abril/2026)", 2026, time.March, 5, "2026-03-31", "2026-04-01", "2026-04-07"},
		{"ano bissexto (fev/2028 termina numa terça)", 2028, time.February, 5, "2028-02-29", "2028-03-01", "2028-03-07"},
		{"virada de ano (dez/2026 termina numa quinta; feriados são ignorados)", 2026, time.December, 8, "2026-12-31", "2027-01-01", "2027-01-12"},
		{"dia útil fora do intervalo é ajustado (0 vira 1)", 2026, time.February, 0, "2026-02-27", "2026-03-02", "2026-03-02"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			com, ex, pay := FIIPayoutDays(tt.year, tt.month, tt.payBusinessDay)
			if date(com) != tt.wantCom || date(ex) != tt.wantEx || date(pay) != tt.pay {
				t.Errorf("com %s, ex %s, pagamento %s; quer %s, %s, %s", date(com), date(ex), date(pay), tt.wantCom, tt.wantEx, tt.pay)
			}
		})
	}
}

func TestFIIPayoutDays_DozePorAnoEEmDiaUtil(t *testing.T) {
	for payBD := 1; payBD <= MaxFIIPaymentBusinessDay; payBD++ {
		prevPay := -1
		for month := time.January; month <= time.December; month++ {
			com, ex, pay := FIIPayoutDays(2026, month, payBD)
			for _, d := range []int{com, ex, pay} {
				if !simcalendar.IsBusinessDay(d) {
					t.Fatalf("dia útil %d, %s: dia %s não é útil", payBD, month, date(d))
				}
			}
			if com >= ex || ex > pay || pay <= prevPay {
				t.Fatalf("dia útil %d, %s: ordem quebrada %d %d %d (anterior %d)", payBD, month, com, ex, pay, prevPay)
			}
			// O pagamento cai no mês seguinte ao de referência.
			if want := month%12 + 1; simcalendar.DateOf(pay).Month() != want {
				t.Fatalf("pagamento de %s caiu em %s", month, simcalendar.DateOf(pay).Month())
			}
			prevPay = pay
		}
	}
}
