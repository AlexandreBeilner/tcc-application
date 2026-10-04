package contentcheck

import (
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"testing"

	"tcc-investimentos/engine/internal/domain/macroevent"
)

// Dívida conhecida de conteúdo visível (RC.1.1). A tarefa RC.1.4 zera este
// mapa; enquanto isso ele só pode encolher. Chave: "regra|origem".
// Gerar o estado atual: UPDATE_BASELINE=1 go test ./internal/contentcheck/
var knownViolations = map[string]int{
	"jargao-tecnico|errors.New:fixedincomeexecution.go:\"temporizador ainda não rodou nenhum tick\"": 1,
	"numero-de-licao|ensureAsset:main.go:\"Ação Sandbox — Lição 2.3\"":                               1,
	"numero-de-licao|seedFixedIncome:main.go:\"Tesouro Prefixado Sandbox — Lição 1.7\"":              1,
	"sandbox|ensureAsset:main.go:\"Ação Sandbox — Lição 2.3\"":                                       1,
	"sandbox|seedFixedIncome:main.go:\"Tesouro Prefixado Sandbox — Lição 1.7\"":                      1,
	"simulado|errors.New:fixedincomeexecution.go:\"dias de permanência simulados devem ser \"":       1,
	"simulado|errors.New:fixedincomeexecution.go:\"temporizador ainda não rodou nenhum tick\"":       1,
	"snake-case|errors.New:position.go:\"soma das posições excede outstanding_sha\"":                 1,
	"snake-case|seedETFAsset:main.go:\"Réplica por amostragem das empresas de m\"":                   1,
	"travessao|ensureAsset:main.go:\"Ação Sandbox — Lição 2.3\"":                                     1,
	"travessao|errors.New:fixedincomeexecution.go:\"temporizador ainda não rodou nenhum tick\"":      1,
	"travessao|macroevent:desvalorizacao-real:Narrative":                                             1,
	"travessao|macroevent:expansao-parceria-corporativa:Narrative":                                   1,
	"travessao|macroevent:inadimplencia-bancos:Narrative":                                            1,
	"travessao|macroevent:quebra-safra-agronegocio:Narrative":                                        1,
	"travessao|seedETFAsset:main.go:\"Réplica por amostragem das empresas de m\"":                    1,
	"travessao|seedETFAsset:main.go:\"Réplica por amostragem de ativos histori\"":                    1,
	"travessao|seedFixedIncome:main.go:\"Tesouro Prefixado Sandbox — Lição 1.7\"":                    1,
}

// domainErrorFiles são os pacotes de domínio cujas mensagens de erro chegam
// ao usuário (ordem, renda fixa, posição, conta).
var domainErrorDirs = []string{"orderexecution", "fixedincomeexecution", "position", "account"}

func collectFields(t *testing.T) []Field {
	t.Helper()
	var fields []Field

	for _, tpl := range macroevent.Templates {
		fields = append(fields,
			Field{"macroevent:" + tpl.Key + ":Title", tpl.Title},
			Field{"macroevent:" + tpl.Key + ":Narrative", tpl.Narrative},
		)
	}

	seedLiterals, err := CallLiterals("../../cmd/seed/main.go", func(callee string) bool {
		return strings.HasPrefix(callee, "seed") || callee == "ensureAsset"
	})
	if err != nil {
		t.Fatalf("lendo cmd/seed/main.go: %v", err)
	}
	fields = append(fields, seedLiterals...)

	for _, dir := range domainErrorDirs {
		files, _ := filepath.Glob(filepath.Join("../domain", dir, "*.go"))
		for _, f := range files {
			if strings.HasSuffix(f, "_test.go") {
				continue
			}
			lits, err := CallLiterals(f, func(callee string) bool { return callee == "errors.New" || callee == "fmt.Errorf" })
			if err != nil {
				t.Fatalf("lendo %s: %v", f, err)
			}
			fields = append(fields, lits...)
		}
	}
	return fields
}

func TestVisibleContent_SemViolacaoNova(t *testing.T) {
	fields := collectFields(t)
	if len(fields) < 20 {
		t.Fatalf("varredura achou só %d campos de texto, esperado bem mais (coletor quebrado?)", len(fields))
	}
	current := Count(fields)

	if os.Getenv("UPDATE_BASELINE") == "1" {
		t.Logf("baseline atual:\n%s", renderBaseline(current))
		return
	}

	added, stale := Diff(current, knownViolations)
	if len(added) > 0 {
		t.Errorf("conteúdo proibido novo em texto visível:\n  %s", strings.Join(added, "\n  "))
	}
	if len(stale) > 0 {
		t.Errorf("violações resolvidas, remova de knownViolations:\n  %s", strings.Join(stale, "\n  "))
	}
}

func TestRules_PegamCadaPadrao(t *testing.T) {
	samples := map[string]string{
		"tcc":              "veja o TCC",
		"spec":             "conforme a spec",
		"capitulo":         "ver cap. 3",
		"backlog":          "item do backlog",
		"motor":            "o motor calcula",
		"nesta-plataforma": "Nesta plataforma é diferente",
		"simulado":         "dia simulado",
		"travessao":        "perdas — pressão",
		"snake-case":       "excede outstanding_shares",
		"numero-de-licao":  "Ação Sandbox Lição 2.3",
		"sandbox":          "o Sandbox não entra",
		"jargao-tecnico":   "ainda não rodou nenhum tick",
	}
	for id, text := range samples {
		if got := Count([]Field{{"s", text}}); got[id+"|s"] == 0 {
			t.Errorf("regra %q não pegou %q", id, text)
		}
	}
	if got := Count([]Field{{"s", "O CDB paga 110% do CDI, e o FGC cobre até R$ 250 mil."}}); len(got) != 0 {
		t.Errorf("texto limpo disparou regras: %v", got)
	}
}

func renderBaseline(m map[string]int) string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, k := range keys {
		b.WriteString("\t" + strconv.Quote(k) + ": " + strconv.Itoa(m[k]) + ",\n")
	}
	return b.String()
}
