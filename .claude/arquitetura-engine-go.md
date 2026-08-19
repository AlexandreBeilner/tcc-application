# Arquitetura do motor de simulação — Go idiomático

> Equivalente, pro `engine/` (Go), de `.claude/arquitetura-backend-ddd-lite.md` (Node). Fechado em 2026-08-19, antes de começar a Semana 2 (motor de renda fixa) — leia isto antes da primeira fórmula financeira.

## Por que não é o mesmo padrão do Node, ao pé da letra

O princípio é o mesmo (domínio isolado de infraestrutura, inversão de dependência, teste junto com a implementação), mas a **cerimônia é diferente** porque Go não é orientado a objetos como TypeScript e tem tipagem estrutural. Aplicar `domain/application/infrastructure/interfaces` por módulo, com uma pasta `ports/` cheia de interfaces, seria "Java em Go" — os provérbios da própria linguagem (`accept interfaces, return structs`; `a little copying is better than a little dependency`; `the bigger the interface, the weaker the abstraction`) apontam pra menos camada, não mais.

Duas diferenças que mudam a prática:

1. **Interface fica do lado de quem consome, não de quem implementa.** Em Go, um tipo satisfaz uma interface automaticamente, sem `implements` explícito. O idiomático é declarar a interface pequena (1–3 métodos) dentro do próprio pacote `domain`, no ponto onde ela é usada — não numa pasta `ports/` central catalogando tudo. O adapter concreto em `infra` simplesmente bate com a assinatura, sem precisar saber que a interface existe.
2. **Pacote por conceito de domínio, não por camada técnica.** Não existe (e não deve existir) um `application/useCases/` genérico. Conforme a Semana 2 avançar, `internal/domain/` pode virar `internal/domain/fixedincome`, `internal/domain/pricing` etc. — mas só quando um segundo conceito precisar de fato de separação. Não fragmentar preventivamente.

## Estrutura (o que já existe + o que vem)

```
engine/
  cmd/api/main.go        # composição: injeta os adapters concretos, inicia o servidor
  internal/
    domain/                # regras de negócio puras — fórmulas, curvas, event sourcing.
                            # Interfaces pequenas declaradas aqui quando o domínio
                            # precisa de um colaborador (ex: EventStore).
                            # ZERO import de net/http, database/sql, infra/, ou libs
                            # de terceiros de infraestrutura (lib/pq, golang-migrate...).
    infra/
      httpserver/           # HTTP handlers — já existe (health check)
      db/                    # migrations, acesso a Postgres — já existe
      eventstore/            # (Semana 2) implementação concreta de domain.EventStore
                              #  contra o banco `market`
```

`internal/domain/doc.go` já documenta essa regra desde a 1.1a — este arquivo só formaliza o resto.

## Regra de dependência

`domain` nunca importa `infra`, nem pacotes de infraestrutura de terceiros (`database/sql`, `net/http`, `github.com/lib/pq`, `github.com/golang-migrate/migrate`...). Quando o domínio precisa de algo externo (persistir um evento, ler uma cotação), ele declara uma interface pequena no próprio pacote `domain` — ex:

```go
// internal/domain/eventstore.go
type EventStore interface {
    Append(ctx context.Context, event MarketEvent) error
}
```

`internal/infra/eventstore/postgres.go` implementa essa interface contra o banco `market`, sem que `domain` precise importar nada de `infra`. `cmd/api/main.go` é quem instancia o adapter concreto e injeta no tipo de domínio que precisa dele (via construtor/parâmetro de função) — é a mesma raiz de composição do padrão Node, só que sem framework de DI.

## Fórmulas financeiras (RF/RNF do motor, TCC cap. 7.2.4)

Toda fórmula (precificação de renda fixa, curva de juros, cálculo de posição) é uma função pura em `domain` — recebe valores, devolve valores, sem I/O. Isso não é só estilo: é o que o CLAUDE.md já exige ("testes unitários obrigatórios para toda fórmula financeira") e é exatamente o que fica fácil de testar quando não há infraestrutura misturada.

## Testes — sempre junto, estilo Go idiomático

Teste ao lado do arquivo (`_test.go` no mesmo pacote), como já é convenção Go e já usado em `internal/infra/httpserver/health_test.go`. Preferir **table-driven tests** pra fórmulas com múltiplos casos:

```go
func TestPrecoRendaFixa(t *testing.T) {
    tests := []struct {
        name string
        // ...
        want float64
    }{
        {name: "taxa zero", /* ... */ want: 0},
    }
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got := PrecoRendaFixa(/* ... */)
            if got != tt.want {
                t.Errorf("got %v, want %v", got, tt.want)
            }
        })
    }
}
```

Domínio: teste puro, sem mocks (é só matemática/regra). Colaboradores externos (`EventStore` etc.): teste com uma implementação fake em memória satisfazendo a interface, do mesmo jeito que os fakes do Node — só que aqui não precisa de uma pasta `test/fakes/` formal, um `type fakeEventStore struct{...}` no próprio arquivo `_test.go` já resolve (Go idiomático: não criar abstração de teste maior que o necessário). Infra (`internal/infra/`): teste de integração contra Postgres real quando fizer sentido (como já foi feito manualmente pros `CHECK` constraints na 1.3).

## Reforço mecânico (não só disciplina)

Mesma lógica do `no-restricted-imports` do ESLint no Node, adaptada pro Go: `engine/.golangci.yml` tem uma regra `depguard` que bloqueia `internal/domain/**` de importar `net/http`, `database/sql`, `internal/infra` (e subpacotes), `github.com/lib/pq` e `github.com/golang-migrate/migrate`. Violar isso quebra `golangci-lint run`, testado na prática (import de `net/http` e de `internal/infra/httpserver` dentro de `domain/`, ambos rejeitados com a mensagem apontando pra este documento).

## SOLID aplicado ao idioma Go

- **SRP:** função/tipo pequeno, um pacote por conceito — não um pacote `domain` de 2000 linhas fazendo tudo (quando isso acontecer, é o sinal de dividir em subpacotes, não antes).
- **ISP:** interface com 1–3 métodos, nunca uma `EngineService` genérica agregando tudo que o motor faz.
- **DIP:** domínio declara a interface que precisa; infra implementa; `main.go` injeta — sem framework de injeção de dependência, só passagem de parâmetro/construtor (`func NewX(store EventStore) *X`).
- **OCP:** trocar Postgres por outro banco é trocar o que `main.go` injeta atrás de `EventStore`, sem tocar `domain`.
- Go proverb que resume tudo: não adicionar uma interface até existir um segundo caso de uso real pra ela (nada de interface "pra garantir flexibilidade futura").
