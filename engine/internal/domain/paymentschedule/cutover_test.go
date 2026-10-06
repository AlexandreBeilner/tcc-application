package paymentschedule

import "testing"

func TestCycleIndexWithCutover_SemCorteEquivaleAoCycleIndex(t *testing.T) {
	for _, offset := range []int{0, 5, 30, 65 % 32} {
		for i := 0; i <= 1500; i++ {
			wantK, wantOK := CycleIndex(i, 91, offset)
			gotK, gotOK := CycleIndexWithCutover(i, 91, offset, 0)
			if gotK != wantK || gotOK != wantOK {
				t.Fatalf("offset %d dayIndex %d: got (%d,%v), want (%d,%v)", offset, i, gotK, gotOK, wantK, wantOK)
			}
		}
	}
}

func TestCycleIndexWithCutover_CicloAnteriorAoCorteSaiNoLegado(t *testing.T) {
	const freq, offset, cutover = 91, 10, 100
	// Ciclo 0 (base 91) fechou antes do corte: sai no dia 91, nunca em 91+offset.
	if k, ok := CycleIndexWithCutover(90, freq, offset, cutover); !ok || k != 0 {
		t.Fatalf("dia 91: got (%d,%v), want (0,true)", k, ok)
	}
	for d := 92; d <= 110; d++ {
		if k, ok := CycleIndexWithCutover(d-1, freq, offset, cutover); ok {
			t.Fatalf("dia %d não deveria ter balanço (ciclo %d)", d, k)
		}
	}
	// Ciclo 1 (base 182) fecha depois do corte: usa o offset.
	want := ReportDay(freq, offset, 1)
	if k, ok := CycleIndexWithCutover(want-1, freq, offset, cutover); !ok || k != 1 {
		t.Fatalf("dia %d: got (%d,%v), want (1,true)", want, k, ok)
	}
}

func TestCycleIndexWithCutover_UmBalancoPorCicloAtravessandoOCorte(t *testing.T) {
	const freq, cutover = 91, 150
	for _, offset := range []int{0, 7, 20, 31} {
		seen := map[int]int{}
		for i := 0; i < 1000; i++ {
			if k, ok := CycleIndexWithCutover(i, freq, offset, cutover); ok {
				seen[k]++
			}
		}
		for k := 0; k < 10; k++ {
			if seen[k] != 1 {
				t.Fatalf("offset %d: ciclo %d reportou %d vezes, want 1", offset, k, seen[k])
			}
		}
	}
}

func TestDaysSinceReport(t *testing.T) {
	tests := []struct {
		name                     string
		dayIndex, offset, cutoff int
		wantDays                 int
		wantOK                   bool
	}{
		{"antes do primeiro balanço", 50, 0, 0, 0, false},
		{"offset 0 no dia do balanço", 90, 0, 0, 0, true},
		{"offset 0 três dias depois", 93, 0, 0, 3, true},
		{"com offset ainda sem balanço", 95, 10, 0, 0, false},
		{"com offset no dia do balanço", ReportDay(91, 10, 0) - 1, 10, 0, 0, true},
		{"com offset dois dias depois", ReportDay(91, 10, 0) + 1, 10, 0, 2, true},
		{"legado antes do corte, 5 dias depois", 95, 10, 200, 5, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			days, ok := DaysSinceReport(tt.dayIndex, 91, tt.offset, tt.cutoff)
			if days != tt.wantDays || ok != tt.wantOK {
				t.Fatalf("got (%d,%v), want (%d,%v)", days, ok, tt.wantDays, tt.wantOK)
			}
		})
	}
}

func TestDaysSinceReport_OffsetZeroEquivaleAoModuloLegado(t *testing.T) {
	for i := 90; i <= 1500; i++ {
		days, ok := DaysSinceReport(i, 91, 0, 0)
		if !ok || days != (i+1)%91 {
			t.Fatalf("dayIndex %d: got (%d,%v), want %d", i, days, ok, (i+1)%91)
		}
	}
}
