// Package catalogadmin é a consulta e o ajuste do catálogo de ativos pelo painel admin (tarefa N.12).
// O catálogo é dado cadastral (não Event Sourcing), então editar não grava evento; mas só uma
// lista fechada de campos pode mudar, e cada um passa pela mesma validação do cadastro
// (catalog.ValidateBaseGrowthPct etc.). Campos estruturais (ticker, classe, setor, float em
// circulação) são somente leitura: mudar o float reescreve a distribuição dos bots e mudar o
// setor muda quais templates de evento macro atingem a empresa. O ciclo de relatório
// (report_frequency_days) também fica só leitura: a spec 3.3.1 fixa um ciclo global e o
// gatilho de eventos macro, o FII e o ETF dependem dele.
package catalogadmin

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"tcc-investimentos/engine/internal/domain/catalog"
)

const (
	MaxNameLength        = 100
	MaxMethodologyLength = 1000
)

var (
	ErrNotFound           = errors.New("ativo não encontrado")
	ErrSandbox            = errors.New("ativo do sandbox não é editável (achado 023)")
	ErrNothingToUpdate    = errors.New("informe pelo menos um campo a alterar")
	ErrInvalidName        = errors.New("o nome do ativo é obrigatório e tem no máximo 100 caracteres")
	ErrInvalidMethodology = errors.New("a metodologia do ETF tem no máximo 1000 caracteres")
)

// FieldNotEditableError é a recusa de um campo que não se aplica à classe do ativo.
type FieldNotEditableError struct {
	Field string
	Type  catalog.AssetType
}

func (e *FieldNotEditableError) Error() string {
	return fmt.Sprintf("o campo %s não é editável para ativos do tipo %s", e.Field, e.Type)
}

// Nomes dos campos editáveis, os mesmos do corpo do PATCH.
const (
	FieldName              = "name"
	FieldBaseGrowthPct     = "base_growth_pct"
	FieldQualityMultiplier = "quality_multiplier"
	FieldMethodology       = "methodology_summary"
)

// EditableFields devolve a lista fechada de campos que o painel pode alterar numa classe.
// Sandbox nunca é editável.
func EditableFields(assetType catalog.AssetType, isSandbox bool) []string {
	if isSandbox {
		return []string{}
	}
	switch assetType {
	case catalog.AssetAcao:
		return []string{FieldName, FieldBaseGrowthPct, FieldQualityMultiplier}
	case catalog.AssetETF:
		return []string{FieldName, FieldMethodology}
	default:
		return []string{FieldName}
	}
}

// Patch é a alteração parcial: nil = não mexe. Os campos de empresa valem pra empresa
// emissora, então afetam as duas classes (ON e PN) do mesmo emissor.
type Patch struct {
	Name              *string
	BaseGrowthPct     *float64
	QualityMultiplier *float64
	Methodology       *string
}

func (p Patch) isEmpty() bool {
	return p.Name == nil && p.BaseGrowthPct == nil && p.QualityMultiplier == nil && p.Methodology == nil
}

// Validate confere o patch contra a classe do ativo e as regras de cada campo.
func (p Patch) Validate(assetType catalog.AssetType, isSandbox bool) error {
	if isSandbox {
		return ErrSandbox
	}
	if p.isEmpty() {
		return ErrNothingToUpdate
	}
	allowed := map[string]bool{}
	for _, f := range EditableFields(assetType, isSandbox) {
		allowed[f] = true
	}
	check := func(present bool, field string) error {
		if present && !allowed[field] {
			return &FieldNotEditableError{Field: field, Type: assetType}
		}
		return nil
	}
	for _, c := range []struct {
		present bool
		field   string
	}{
		{p.Name != nil, FieldName},
		{p.BaseGrowthPct != nil, FieldBaseGrowthPct},
		{p.QualityMultiplier != nil, FieldQualityMultiplier},
		{p.Methodology != nil, FieldMethodology},
	} {
		if err := check(c.present, c.field); err != nil {
			return err
		}
	}
	if p.Name != nil {
		name := strings.TrimSpace(*p.Name)
		if name == "" || utf8.RuneCountInString(name) > MaxNameLength {
			return ErrInvalidName
		}
	}
	if p.BaseGrowthPct != nil {
		if err := catalog.ValidateBaseGrowthPct(*p.BaseGrowthPct); err != nil {
			return err
		}
	}
	if p.QualityMultiplier != nil {
		if err := catalog.ValidateQualityMultiplier(*p.QualityMultiplier); err != nil {
			return err
		}
	}
	if p.Methodology != nil && utf8.RuneCountInString(*p.Methodology) > MaxMethodologyLength {
		return ErrInvalidMethodology
	}
	return nil
}

// Holding é um componente da cesta de um ETF, como cadastrado.
type Holding struct {
	Name      string
	WeightPct float64
}

// Entry é uma linha do catálogo com tudo que a tela mostra. Os blocos de classe vêm
// preenchidos só pra classe do ativo (RF21: indicadores de ação, ETF e FII não se misturam).
type Entry struct {
	AssetID           string
	Ticker            string
	Name              string
	Type              catalog.AssetType
	RiskClass         *string
	IsSandbox         bool
	ShareClass        *string
	OutstandingShares *int64

	Company     *CompanyParams
	ETF         *ETFParams
	FII         *FIIParams
	FixedIncome *FixedIncomeParams
}

// Editable lista os campos editáveis deste ativo.
func (e Entry) Editable() []string { return EditableFields(e.Type, e.IsSandbox) }

type CompanyParams struct {
	CompanyID           string
	Name                string
	Sector              string
	ReportFrequencyDays int
	BaseGrowthPct       float64
	QualityMultiplier   float64
}

type ETFParams struct {
	BenchmarkIndex         string
	MethodologySummary     *string
	ExpenseRatioPct        float64
	RebalanceFrequencyDays int
	Holdings               []Holding
	HoldingsTotalWeightPct float64
}

type FIIParams struct {
	FIIType     string
	Segment     *string
	VacancyRate *float64
	Indexador   *string
}

type FixedIncomeParams struct {
	InterestRate      *float64
	MaturityDate      *string
	IssuerType        string
	TaxExempt         bool
	CreditRiskRating  *string
	MinimumInvestment float64
}

// Repository é o que o serviço precisa do banco: duas leituras e a gravação do patch.
// Update aplica tudo numa transação e devolve a linha já alterada.
type Repository interface {
	List(ctx context.Context) ([]Entry, error)
	Get(ctx context.Context, assetID string) (Entry, error)
	Update(ctx context.Context, assetID string, patch Patch) (Entry, error)
}

// Service orquestra a validação antes de gravar.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) List(ctx context.Context) ([]Entry, error) { return s.repo.List(ctx) }

// Update valida o patch contra o ativo atual (classe e sandbox) e grava.
func (s *Service) Update(ctx context.Context, assetID string, patch Patch) (Entry, error) {
	current, err := s.repo.Get(ctx, assetID)
	if err != nil {
		return Entry{}, err
	}
	if patch.Name != nil {
		trimmed := strings.TrimSpace(*patch.Name)
		patch.Name = &trimmed
	}
	if err := patch.Validate(current.Type, current.IsSandbox); err != nil {
		return Entry{}, err
	}
	return s.repo.Update(ctx, assetID, patch)
}
