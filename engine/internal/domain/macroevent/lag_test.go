package macroevent

import (
	"testing"
)

// TestAssignReportDay_JanelaDeCorte cobre o critério de aceite "evento
// disparado a menos de ReportCutoffDays do fechamento do ciclo de 14 dias
// tem o efeito de fundamentos atribuído ao ciclo seguinte (28 dias à
// frente), não ao mais próximo" — os dois lados do corte, com
// nextReportDay=14/reportFrequencyDays=14 (mesma cadência quinzenal da
// spec 3.3.1).
func TestAssignReportDay_JanelaDeCorte(t *testing.T) {
	const nextReportDay = 14
	const reportFrequencyDays = 14

	tests := []struct {
		name           string
		triggeredOnDay int
		want           int
	}{
		{"exatamente no corte (2 dias de antecedência) vai pro relatório mais próximo", 12, 14},
		{"mais de 2 dias de antecedência vai pro relatório mais próximo", 5, 14},
		{"1 dia de antecedência (abaixo do corte) empurra pro próximo ciclo", 13, 28},
		{"disparado no mesmo dia do relatório empurra pro próximo ciclo", 14, 28},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := AssignReportDay(tt.triggeredOnDay, reportFrequencyDays, nextReportDay)
			if got != tt.want {
				t.Errorf("AssignReportDay(%d, %d, %d) = %d, want %d", tt.triggeredOnDay, reportFrequencyDays, nextReportDay, got, tt.want)
			}
		})
	}
}

// TestCombinePendingEffects_SomaComTeto cobre o critério de aceite "dois
// eventos pendentes na mesma empresa/ciclo somam antes do teto de ±40%
// ser aplicado" — soma abaixo, exatamente no limite, e acima do teto
// (clampada), nos dois sentidos.
func TestCombinePendingEffects_SomaComTeto(t *testing.T) {
	const cap = DefaultFundamentalsCapPct // 40

	tests := []struct {
		name    string
		effects []float64
		want    float64
	}{
		{"soma abaixo do teto", []float64{10, 15}, 25},
		{"soma exatamente no teto positivo", []float64{20, 20}, 40},
		{"soma acima do teto positivo é clampada", []float64{25, 25}, 40},
		{"soma exatamente no teto negativo", []float64{-20, -20}, -40},
		{"soma acima do teto negativo (em módulo) é clampada", []float64{-30, -25}, -40},
		{"efeitos de sinais opostos se cancelam parcialmente", []float64{30, -10}, 20},
		{"sem efeitos pendentes soma zero", nil, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := CombinePendingEffects(tt.effects, cap)
			if got != tt.want {
				t.Errorf("CombinePendingEffects(%v, %v) = %v, want %v", tt.effects, cap, got, tt.want)
			}
		})
	}
}

// TestIsPriceEffectActive_DuracaoDeDoisDias cobre o critério de aceite
// "efeito de preço ... para de ser aplicado no dia seguinte ao fim da
// duração".
func TestIsPriceEffectActive_DuracaoDeDoisDias(t *testing.T) {
	const triggeredOnDay = 10
	const durationDays = 2

	tests := []struct {
		currentDay int
		want       bool
	}{
		{9, false},  // antes do disparo
		{10, true},  // dia do disparo
		{11, true},  // segundo (último) dia da duração
		{12, false}, // dia seguinte ao fim da duração — efeito já parou
		{13, false},
	}

	for _, tt := range tests {
		got := IsPriceEffectActive(triggeredOnDay, durationDays, tt.currentDay)
		if got != tt.want {
			t.Errorf("IsPriceEffectActive(%d, %d, %d) = %v, want %v", triggeredOnDay, durationDays, tt.currentDay, got, tt.want)
		}
	}
}
