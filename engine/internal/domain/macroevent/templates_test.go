package macroevent

import "testing"

// TestTemplates_DezTemplatesBatemComATabelaDaSpec cobre o critério de
// aceite "os 10 templates da spec 3.3.2 estão todos presentes, com
// categoria/direção/banda/tipo de efeito idênticos à tabela" — comparação
// linha a linha, na mesma ordem da tabela (spec 3.3.2, linhas 132–143).
func TestTemplates_DezTemplatesBatemComATabelaDaSpec(t *testing.T) {
	want := []struct {
		key                 string
		category            Category
		direction           Direction
		band                Band
		affectsPrice        bool
		affectsFundamentals bool
	}{
		{"legislacao-ambiental-mineracao", CategoryRegulatorio, DirectionNegativo, BandModerado, true, true},
		{"alta-minerio-ferro", CategoryCommodities, DirectionPositivo, BandModerado, true, true},
		{"queda-petroleo", CategoryCommodities, DirectionNegativo, BandLeve, true, true},
		{"regulacao-dados-tecnologia", CategorySetorialTecnologia, DirectionNegativo, BandLeve, false, true},
		{"inadimplencia-bancos", CategorySetorialBancario, DirectionNegativo, BandModerado, false, true},
		{"escandalo-contabil-varejo", CategoryCorporativo, DirectionNegativo, BandSevero, true, true},
		{"expansao-parceria-corporativa", CategoryCorporativo, DirectionPositivo, BandModerado, true, false},
		{"desvalorizacao-real", CategoryCambial, DirectionMisto, BandModerado, true, true},
		{"tensao-comercial-internacional", CategoryGeopolitico, DirectionNegativo, BandLeve, true, false},
		{"quebra-safra-agronegocio", CategoryAgronegocio, DirectionMisto, BandModerado, true, true},
	}

	if len(Templates) != len(want) {
		t.Fatalf("len(Templates) = %d, want %d", len(Templates), len(want))
	}

	for i, w := range want {
		t.Run(w.key, func(t *testing.T) {
			got := Templates[i]
			if got.Key != w.key {
				t.Errorf("[%d].Key = %q, want %q (ordem da tabela da spec 3.3.2 divergente)", i, got.Key, w.key)
			}
			if got.Title == "" {
				t.Errorf("[%d].Title vazio", i)
			}
			if got.Narrative == "" {
				t.Errorf("[%d].Narrative vazia", i)
			}
			if got.Category != w.category {
				t.Errorf("[%d].Category = %v, want %v", i, got.Category, w.category)
			}
			if got.Direction != w.direction {
				t.Errorf("[%d].Direction = %v, want %v", i, got.Direction, w.direction)
			}
			if got.Band != w.band {
				t.Errorf("[%d].Band = %v, want %v", i, got.Band, w.band)
			}
			if got.AffectsPrice != w.affectsPrice {
				t.Errorf("[%d].AffectsPrice = %v, want %v", i, got.AffectsPrice, w.affectsPrice)
			}
			if got.AffectsFundamentals != w.affectsFundamentals {
				t.Errorf("[%d].AffectsFundamentals = %v, want %v", i, got.AffectsFundamentals, w.affectsFundamentals)
			}
		})
	}
}

func TestTemplates_ChavesUnicas(t *testing.T) {
	seen := make(map[string]bool, len(Templates))
	for _, tpl := range Templates {
		if seen[tpl.Key] {
			t.Errorf("chave duplicada no catálogo: %q", tpl.Key)
		}
		seen[tpl.Key] = true
	}
}

func TestFindTemplate_EncontraPorChave(t *testing.T) {
	got, ok := FindTemplate("legislacao-ambiental-mineracao")
	if !ok {
		t.Fatal("ok = false, want true")
	}
	if got.Category != CategoryRegulatorio {
		t.Errorf("Category = %v, want %v", got.Category, CategoryRegulatorio)
	}
}

func TestFindTemplate_ChaveInexistenteDevolveFalse(t *testing.T) {
	_, ok := FindTemplate("evento-que-nao-existe")
	if ok {
		t.Error("ok = true, want false pra chave inexistente")
	}
}
