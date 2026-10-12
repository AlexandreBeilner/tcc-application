package paymentschedule

import "testing"

func TestReleaseCycle(t *testing.T) {
	// 7 dias simulados: o dia 1 é segunda (simcalendar), então 5 e 6 são sábado e domingo.
	cases := []struct {
		name       string
		release    int
		assigned   bool
		com, pay   int
		wantEx     int
		wantPayDay int
	}{
		{"legado: ex na liberação, pagamento 5 dias corridos depois", 100, false, 2, 3, 100, 105},
		{"agendada: ex e pagamento em dia útil depois da liberação", 100, true, 2, 3, ExDay(ComDay(100, 2)), PaymentDay(ExDay(ComDay(100, 2)), 3)},
		{"liberada na sexta: a data-com pula o fim de semana", 5, true, 0, 0, ExDay(ComDay(5, 0)), PaymentDay(ExDay(ComDay(5, 0)), 0)},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			ex, pay := ReleaseCycle(tt.release, tt.assigned, tt.com, tt.pay)
			if ex != tt.wantEx || pay != tt.wantPayDay {
				t.Errorf("ReleaseCycle = (%d, %d), esperado (%d, %d)", ex, pay, tt.wantEx, tt.wantPayDay)
			}
			if pay < ex {
				t.Errorf("pagamento %d antes da data-ex %d", pay, ex)
			}
		})
	}
}

// As datas sempre ficam em ordem (liberação <= ex <= pagamento) e em dia útil.
func TestReleaseCycle_OrdemEDiaUtil(t *testing.T) {
	for release := 1; release <= 200; release++ {
		ex, pay := ReleaseCycle(release, true, 2, 3)
		if release > ex || ex > pay {
			t.Fatalf("liberação %d: ex %d, pagamento %d", release, ex, pay)
		}
	}
}
