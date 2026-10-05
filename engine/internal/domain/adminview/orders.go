package adminview

import "time"

// Limites de paginação de GET /admin/orders (tarefa N.10).
const (
	DefaultOrdersLimit = 50
	MaxOrdersLimit     = 200
)

// OrderFilter escolhe as ordens da tela "Ordens". Campo vazio não filtra.
// Status aceita os valores de order_book (pending, partially_filled, filled,
// cancelled) e o atalho "open" (pending + partially_filled).
type OrderFilter struct {
	UserID  string
	AssetID string
	Side    string
	Status  string
	From    *time.Time
	To      *time.Time
	Limit   int
	Offset  int
}

// NormalizePage aplica o padrão e o teto de paginação.
func (f OrderFilter) NormalizePage() OrderFilter {
	if f.Limit <= 0 {
		f.Limit = DefaultOrdersLimit
	}
	if f.Limit > MaxOrdersLimit {
		f.Limit = MaxOrdersLimit
	}
	if f.Offset < 0 {
		f.Offset = 0
	}
	return f
}

// OrderRow é uma ordem do book vista pelo admin. Diferente da leitura pública,
// traz o dono (o admin investiga ordens), mas nunca patrimônio.
type OrderRow struct {
	OrderID        string
	AssetID        string
	Ticker         string
	UserID         string
	IsBot          bool
	Archetype      *string
	Side           string
	Type           string
	Quantity       int
	FilledQuantity int
	Price          float64
	Status         string
	CancelReason   *string
	SimulatedDay   int
	CreatedAt      time.Time
}
