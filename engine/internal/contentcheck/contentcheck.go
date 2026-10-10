// Package contentcheck reúne as regras de conteúdo proibido em texto visível
// ao usuário (tarefa RC.1.1 do backlog de revisão) e os helpers de varredura
// de código-fonte usados pelos testes do engine. Não é código de produção: só
// os testes deste pacote o importam. A lista de padrões espelha a do backend
// (backend/src/content/contentRules.ts).
package contentcheck

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"regexp"
	"sort"
	"strconv"
)

// Rule é um padrão proibido em texto que o usuário lê.
type Rule struct {
	ID      string
	Pattern *regexp.Regexp
}

var Rules = []Rule{
	{"tcc", regexp.MustCompile(`\bTCC\b`)},
	{"spec", regexp.MustCompile(`(?i)\bspec\b|\bespecifica[cç][aã]o\b`)},
	{"capitulo", regexp.MustCompile(`(?i)\bcap\.\s*\d`)},
	{"backlog", regexp.MustCompile(`(?i)\bbacklog\b`)},
	{"motor", regexp.MustCompile(`(?i)\bmotor\b`)},
	{"nesta-plataforma", regexp.MustCompile(`(?i)\b(nesta|desta|na) plataforma\b|\ba plataforma registra\b`)},
	{"simulado", regexp.MustCompile(`(?i)simulad`)},
	{"travessao", regexp.MustCompile(`—`)},
	{"snake-case", regexp.MustCompile(`\b[a-z]+_[a-z_]+\b`)},
	{"numero-de-licao", regexp.MustCompile(`(?i)\bli[cç][aã]o\s+\d`)},
	{"sandbox", regexp.MustCompile(`(?i)sandbox`)},
	{"jargao-tecnico", regexp.MustCompile(`(?i)\b(tick|temporizador|endpoint|payload)\b`)},
}

// Field é um trecho de texto visível com a origem legível (usada na chave de
// baseline e na mensagem de falha).
type Field struct {
	Source string
	Text   string
}

// Count devolve, por "regra|origem", quantas violações há nos campos.
func Count(fields []Field) map[string]int {
	counts := map[string]int{}
	for _, f := range fields {
		for _, r := range Rules {
			if r.Pattern.MatchString(f.Text) {
				counts[r.ID+"|"+f.Source]++
			}
		}
	}
	return counts
}

// Diff compara contagens atuais com o baseline: added = violação nova (ou a
// mais), stale = violação resolvida que ainda consta no baseline. O baseline é
// uma catraca: só pode encolher.
func Diff(current, baseline map[string]int) (added, stale []string) {
	keys := map[string]bool{}
	for k := range current {
		keys[k] = true
	}
	for k := range baseline {
		keys[k] = true
	}
	for k := range keys {
		switch now, before := current[k], baseline[k]; {
		case now > before:
			added = append(added, fmt.Sprintf("%s (%d -> %d)", k, before, now))
		case now < before:
			stale = append(stale, fmt.Sprintf("%s (%d -> %d)", k, before, now))
		}
	}
	sort.Strings(added)
	sort.Strings(stale)
	return added, stale
}

// CallLiterals devolve os literais de string passados como argumento a
// chamadas cujo nome (ex: "errors.New", "seedETFAsset") satisfaz match, num
// arquivo Go. Source = "chamada:arquivo:início do literal" (sem número de linha,
// que mudaria a cada edição do arquivo e quebraria o baseline).
func CallLiterals(path string, match func(callee string) bool) ([]Field, error) {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, path, nil, 0)
	if err != nil {
		return nil, err
	}
	var fields []Field
	ast.Inspect(file, func(n ast.Node) bool {
		call, ok := n.(*ast.CallExpr)
		if !ok {
			return true
		}
		callee := calleeName(call.Fun)
		if callee == "" || !match(callee) {
			return true
		}
		for _, arg := range call.Args {
			lit, ok := arg.(*ast.BasicLit)
			if !ok || lit.Kind != token.STRING {
				continue
			}
			text, err := strconv.Unquote(lit.Value)
			if err != nil {
				continue
			}
			head := []rune(text)
			if len(head) > 40 {
				head = head[:40]
			}
			fields = append(fields, Field{Source: fmt.Sprintf("%s:%s:%q", callee, shortName(path), string(head)), Text: text})
		}
		return true
	})
	return fields, nil
}

func calleeName(expr ast.Expr) string {
	switch fn := expr.(type) {
	case *ast.Ident:
		return fn.Name
	case *ast.SelectorExpr:
		if x, ok := fn.X.(*ast.Ident); ok {
			return x.Name + "." + fn.Sel.Name
		}
	}
	return ""
}

func shortName(path string) string {
	for i := len(path) - 1; i >= 0; i-- {
		if path[i] == '/' {
			return path[i+1:]
		}
	}
	return path
}
