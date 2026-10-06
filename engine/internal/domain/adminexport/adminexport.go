// Package adminexport é a exportação de dados do painel admin (tarefa N.21): as linhas
// brutas de ordens e de eventos de mercado num período, com teto de linhas. O formato
// (CSV) é decisão do backend; aqui ficam só o recorte e o teto.
//
// Privacidade (RNF09, LGPD): as linhas identificam a conta só pelo id (nunca nome nem
// e-mail, que vivem no banco do backend) e não carregam patrimônio agregado. O painel é a
// única porta de saída e a exportação é auditada.
package adminexport

import "time"

// MaxRows é o teto de linhas por exportação. Passou disso a resposta vem truncada e marcada,
// pra uma exportação sem filtro não carregar a tabela inteira na memória.
const MaxRows = 50_000

// DefaultRows é o limite quando o chamador não informa um.
const DefaultRows = 10_000

// Range é o recorte de período, ambos os lados opcionais e inclusivos.
type Range struct {
	From *time.Time
	To   *time.Time
}

// ClampLimit normaliza o limite pedido: zero ou negativo vira o padrão e acima do teto vira o teto.
func ClampLimit(requested int) int {
	if requested <= 0 {
		return DefaultRows
	}
	if requested > MaxRows {
		return MaxRows
	}
	return requested
}

// OrderRow é uma ordem do livro. Valores monetários em texto (numeric exato, duas casas).
type OrderRow struct {
	ID             string
	UserID         string
	IsBot          bool
	Ticker         string
	Side           string
	Type           string
	Quantity       int
	FilledQuantity int
	Price          string
	Status         string
	CancelReason   string
	SimulatedDay   int
	CreatedAt      time.Time
}

// EventRow é um evento de `market_events`.
type EventRow struct {
	ID           string
	UserID       string
	IsBot        bool
	Ticker       string
	EventType    string
	Quantity     *int
	UnitValue    *string
	SimulatedDay int
	Timestamp    time.Time
}
