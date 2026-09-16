// Package macroevent modela o mecanismo de Eventos Macro (spec seção
// 3.3/4, RF13/RF14/RF15/RF16): rupturas exógenas (crises, novas leis,
// choques cambiais) que afetam preço e/ou fundamentos de ativos de renda
// variável, disparadas manualmente pelo admin (tela 10.2) ou a partir de
// um dos 10 templates pré-definidos (tarefa 4.3).
//
// "Empresa específica" como alvo (um dos três escopos possíveis, junto
// com setor e ativo individual) não tem coluna própria em
// macro_event_targets — o alvo aponta pro(s) asset_id emitido(s) por ela
// (via variable_income_assets.company_id, tarefa 1.3/3.9). Documentado
// aqui pra não ser redescoberto: um evento "sobre a Empresa X" sempre vira,
// na prática, um ou mais Target com AssetID preenchido, nunca um campo
// CompanyID direto.
package macroevent

import (
	"errors"
	"time"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// Direction espelha o enum Postgres macro_direction.
type Direction string

const (
	DirectionPositivo Direction = "positivo"
	DirectionNegativo Direction = "negativo"
	DirectionMisto    Direction = "misto"
)

// Band espelha o enum Postgres macro_magnitude_band — as faixas de
// efeito/duração por banda (tarefa 4.2) vivem em magnitude.go.
type Band string

const (
	BandLeve     Band = "leve"
	BandModerado Band = "moderado"
	BandSevero   Band = "severo"
)

// Status espelha o enum Postgres macro_event_status.
type Status string

const (
	StatusPendente Status = "pendente"
	StatusAplicado Status = "aplicado"
)

// Metric espelha o enum Postgres macro_target_metric — qual indicador um
// Target específico afeta (preço, ou um dos quatro fundamentos sem
// fórmula de geração definida ainda, mesma nota de escopo já deixada em
// fundamentals.RevenueSeries pra net_income/ebit/gross_debt/
// cash_equivalents).
type Metric string

const (
	MetricPrice           Metric = "price"
	MetricNetIncome       Metric = "net_income"
	MetricEbit            Metric = "ebit"
	MetricGrossDebt       Metric = "gross_debt"
	MetricCashEquivalents Metric = "cash_equivalents"
)

var (
	ErrMissingTitle                = errors.New("título do evento macro é obrigatório")
	ErrMissingNarrative            = errors.New("narrativa do evento macro é obrigatória")
	ErrNoEffectEnabled             = errors.New("evento macro precisa afetar preço e/ou fundamentos")
	ErrNoTarget                    = errors.New("evento macro precisa de pelo menos um alvo")
	ErrTargetScopeAmbiguous        = errors.New("alvo de evento macro deve preencher exatamente um entre setor, risk_class e ativo")
	ErrTargetDirectionMustBeSigned = errors.New("direção própria de alvo de evento macro deve ser positivo ou negativo, nunca misto")
)

// Target é um alvo de um evento macro (macro_event_targets) — exatamente
// um entre Sector, RiskClass e AssetID é preenchido (CHECK
// macro_target_scope_chk do banco, replicado aqui a nível de aplicação,
// mesmo padrão de fii.NewDetails pro CHECK fii_type_fields_chk). "Empresa
// específica" como alvo não tem campo próprio — ver nota do pacote.
//
// Direction é a direção própria do alvo (proposta seção 3, tarefa E.1) —
// nil na maioria dos eventos (o alvo simplesmente herda Event.Direction,
// via ResolvedDirection, sem UX nova no caso simples). Só é preenchido
// quando o admin declara um sinal específico pra este alvo dentro de um
// evento "misto" (ex: setor Exportador positivo, Importador negativo, no
// mesmo evento — o caso didático da spec de câmbio). PriceEffectPct/
// FundamentalsEffectPct espelham os campos de mesmo nome em Event, mas
// amostrados com a direção própria deste alvo — só preenchidos quando
// Direction != nil (targets que herdam a direção do evento continuam
// usando Event.PriceEffectPct/FundamentalsEffectPct como sempre, sem
// nenhum dado redundante gravado por alvo).
type Target struct {
	Sector                *catalog.Sector
	RiskClass             *string
	AssetID               *string
	AffectedMetric        Metric
	Direction             *Direction
	PriceEffectPct        *float64
	FundamentalsEffectPct *float64
}

// NewTarget valida a exclusividade mútua de escopo (setor XOR risk_class
// XOR ativo) e, quando direction é informado, que ele é um sinal (positivo
// ou negativo) — misto não faz sentido como direção própria de um único
// alvo, só como composição de 2+ alvos de sinais opostos (E.1) — antes de
// montar o Target.
func NewTarget(sector *catalog.Sector, riskClass *string, assetID *string, affectedMetric Metric, direction *Direction) (Target, error) {
	filled := 0
	if sector != nil {
		filled++
	}
	if riskClass != nil {
		filled++
	}
	if assetID != nil {
		filled++
	}
	if filled != 1 {
		return Target{}, ErrTargetScopeAmbiguous
	}
	if direction != nil && *direction != DirectionPositivo && *direction != DirectionNegativo {
		return Target{}, ErrTargetDirectionMustBeSigned
	}

	return Target{Sector: sector, RiskClass: riskClass, AssetID: assetID, AffectedMetric: affectedMetric, Direction: direction}, nil
}

// ResolvedDirection devolve a direção efetiva do alvo pra sorteio/leitura
// de sinal: a direção própria (t.Direction) quando declarada, senão a
// direção do evento — é assim que um evento "não-misto" continua simples
// (nenhum alvo declara Direction, todos resolvem pra eventDirection) e um
// evento "misto" ganha sinais diferentes por alvo (E.1) sem precisar que
// todo alvo declare a própria direção.
func (t Target) ResolvedDirection(eventDirection Direction) Direction {
	if t.Direction != nil {
		return *t.Direction
	}
	return eventDirection
}

// Event é um evento macro (macro_events) — a definição do evento em si
// (título, narrativa, direção, banda, quais efeitos habilitados, alvos)
// mais o estado de disparo (dia simulado, duração, efeitos já amostrados).
// Id/CreatedAt/TriggeredAt não fazem parte do value object — atribuídos
// pelo banco na persistência, mesmo padrão já usado por catalog.Asset/
// catalog.Company.
type Event struct {
	TemplateKey         *string
	Title               string
	Narrative           string
	Direction           Direction
	MagnitudeBand       Band
	AffectsPrice        bool
	AffectsFundamentals bool
	Status              Status
	CreatedBy           *string
	Targets             []Target

	// TriggeredOnDay/DurationDays/PriceEffectPct/FundamentalsEffectPct/
	// FundamentalsReportDay só são preenchidos no disparo de fato (tarefa
	// 4.4), a partir do dia simulado corrente do Temporizador (3.11) e do
	// sorteio/tabela de duração por banda de magnitude (tarefa 4.2) —
	// ficam zero-valued/nil num Event recém-criado por NewEvent.
	TriggeredOnDay        int
	DurationDays          int
	PriceEffectPct        *float64
	FundamentalsEffectPct *float64
	FundamentalsReportDay *int
}

// Record é um Event já persistido, pareado com o id e o created_at gerados
// pelo banco — Event em si deliberadamente não carrega esses dois campos
// (ver doc do pacote), então qualquer leitura que precise deles (GET
// /macro-events, tarefas 4.5/6.6.1) usa este tipo, não Event sozinho.
type Record struct {
	ID        string
	CreatedAt time.Time
	Event
}

// NewEvent valida a definição de um evento macro: título/narrativa não
// vazios, pelo menos um efeito habilitado (evento que não afeta nada não
// faz sentido existir) e pelo menos um alvo. Não valida nada sobre o
// disparo em si (dia simulado, duração, efeitos amostrados) — isso é
// responsabilidade da tarefa 4.4, que preenche os campos correspondentes
// depois que NewEvent já devolveu um Event com a definição válida.
// Status começa sempre StatusPendente — não é parâmetro.
func NewEvent(templateKey *string, title, narrative string, direction Direction, band Band, affectsPrice, affectsFundamentals bool, targets []Target, createdBy *string) (Event, error) {
	if title == "" {
		return Event{}, ErrMissingTitle
	}
	if narrative == "" {
		return Event{}, ErrMissingNarrative
	}
	if !affectsPrice && !affectsFundamentals {
		return Event{}, ErrNoEffectEnabled
	}
	if len(targets) == 0 {
		return Event{}, ErrNoTarget
	}

	return Event{
		TemplateKey:         templateKey,
		Title:               title,
		Narrative:           narrative,
		Direction:           direction,
		MagnitudeBand:       band,
		AffectsPrice:        affectsPrice,
		AffectsFundamentals: affectsFundamentals,
		Status:              StatusPendente,
		CreatedBy:           createdBy,
		Targets:             targets,
	}, nil
}
