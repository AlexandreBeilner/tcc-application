package simcalendar

import (
	"testing"
	"time"
)

func TestBaseDateEhSegundaFeira(t *testing.T) {
	if BaseDate.Weekday() != time.Monday {
		t.Fatalf("BaseDate deve ser segunda-feira, foi %s", BaseDate.Weekday())
	}
}

func TestDateOfEDayOfSaoInversos(t *testing.T) {
	for _, day := range []int{0, 1, 6, 7, 364, 730, 5000} {
		if got := DayOf(DateOf(day)); got != day {
			t.Errorf("DayOf(DateOf(%d)) = %d", day, got)
		}
	}
	if got := DayOf(DateOf(10).Add(15 * time.Hour)); got != 10 {
		t.Errorf("a hora deve ser ignorada, DayOf = %d", got)
	}
}

func TestIsBusinessDay(t *testing.T) {
	tests := []struct {
		day  int
		want bool
	}{
		{0, true}, {4, true}, // segunda e sexta
		{5, false}, {6, false}, // sábado e domingo
		{7, true}, {11, true}, {12, false}, {13, false},
	}
	for _, tt := range tests {
		if got := IsBusinessDay(tt.day); got != tt.want {
			t.Errorf("IsBusinessDay(%d) = %v, quer %v", tt.day, got, tt.want)
		}
	}
}

func TestBusinessDaysBetween(t *testing.T) {
	tests := []struct {
		name     string
		from, to int
		want     int
	}{
		{"mesmo dia", 3, 3, 0},
		{"para trás", 5, 2, 0},
		{"segunda até sexta", 0, 4, 4},
		{"sexta até segunda seguinte", 4, 7, 1},
		{"semana inteira", 0, 7, 5},
		{"91 dias (13 semanas)", 0, 91, 65},
		{"sábado até domingo", 5, 6, 0},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := BusinessDaysBetween(tt.from, tt.to); got != tt.want {
				t.Errorf("BusinessDaysBetween(%d, %d) = %d, quer %d", tt.from, tt.to, got, tt.want)
			}
		})
	}
}
