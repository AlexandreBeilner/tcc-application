package assetprovision

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// Kind é o formulário do cadastro: cada um tem os campos próprios da classe (RF21).
type Kind string

const (
	KindAcao      Kind = "acao"
	KindFIITijolo Kind = "fii_tijolo"
	KindFIIPapel  Kind = "fii_papel"
	KindETF       Kind = "etf"
)

const (
	// MinOutstandingShares e MaxOutstandingShares limitam o float de uma ação nova. O teto
	// é o de uma ordem (market_events.quantity é inteiro de 32 bits); o piso garante que
	// o Market Maker consiga cobrir uma fatia inteira dentro da faixa 40-60%.
	MinOutstandingShares = int64(1_000_000)
	MaxOutstandingShares = int64(2_000_000_000)
	MaxETFHoldings       = 30
	maxNameLength        = 100
	maxMethodologyLength = 1000
)

var (
	equityTicker = regexp.MustCompile(`^[A-Z]{4}[34]$`)
	fundTicker   = regexp.MustCompile(`^[A-Z]{4}11$`)
	papelIndexes = map[string]bool{"CDI": true, "IPCA+": true}
)

// ValidationError é uma entrada recusada pela regra de domínio (vira 422). Field aponta o
// campo do formulário quando há um só responsável.
type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string { return e.Message }

func invalid(field, format string, args ...any) error {
	return &ValidationError{Field: field, Message: fmt.Sprintf(format, args...)}
}

// ConflictError é a recusa por colisão com o que já existe (vira 409): ticker ou CNPJ em uso.
type ConflictError struct{ Message string }

func (e *ConflictError) Error() string { return e.Message }

// HoldingSpec é um constituinte da cesta de um ETF novo, por ticker de um ativo já cadastrado.
type HoldingSpec struct {
	Ticker    string
	WeightPct float64
}

// Spec é o pedido de cadastro. Só os campos da classe escolhida valem; os outros devem vir vazios.
type Spec struct {
	Kind   Kind
	Ticker string
	Name   string

	// Ação: o cadastro cria a empresa emissora junto (uma ação ON).
	CompanyName       string
	CNPJ              string
	Sector            catalog.Sector
	OutstandingShares int64
	BaseGrowthPct     float64
	QualityMultiplier float64

	// FII de tijolo (Segment, VacancyRate) e de papel (Indexador).
	Segment     string
	VacancyRate float64
	Indexador   string

	// ETF.
	BenchmarkIndex string
	Methodology    string
	Holdings       []HoldingSpec
}

func checkName(field, value string, max int) error {
	name := strings.TrimSpace(value)
	if name == "" || utf8.RuneCountInString(name) > max {
		return invalid(field, "o campo %s é obrigatório e tem no máximo %d caracteres", field, max)
	}
	return nil
}

// Validate confere só o formato e as faixas, sem consultar o banco (ticker e CNPJ em uso, e
// constituintes inexistentes, são checados pelo serviço).
func (s Spec) Validate() error {
	switch s.Kind {
	case KindAcao:
		if !equityTicker.MatchString(s.Ticker) {
			return invalid("ticker", "o ticker de uma ação tem 4 letras maiúsculas e termina em 3 ou 4 (ex: ABCD3)")
		}
	case KindFIITijolo, KindFIIPapel, KindETF:
		if !fundTicker.MatchString(s.Ticker) {
			return invalid("ticker", "o ticker de um FII ou ETF tem 4 letras maiúsculas e termina em 11 (ex: ABCD11)")
		}
	default:
		return invalid("kind", "classe de ativo desconhecida: escolha acao, fii_tijolo, fii_papel ou etf")
	}
	if err := checkName("name", s.Name, maxNameLength); err != nil {
		return err
	}
	switch s.Kind {
	case KindAcao:
		return s.validateEquity()
	case KindFIITijolo:
		if err := checkName("segment", s.Segment, 50); err != nil {
			return err
		}
		if math.IsNaN(s.VacancyRate) || s.VacancyRate < 0 || s.VacancyRate > 100 {
			return invalid("vacancy_rate", "a vacância é um percentual entre 0 e 100")
		}
	case KindFIIPapel:
		if !papelIndexes[s.Indexador] {
			return invalid("indexador", "o indexador de um FII de papel é CDI ou IPCA+")
		}
	case KindETF:
		return s.validateETF()
	}
	return nil
}

func (s Spec) validateEquity() error {
	if err := checkName("company_name", s.CompanyName, maxNameLength); err != nil {
		return err
	}
	if s.OutstandingShares < MinOutstandingShares || s.OutstandingShares > MaxOutstandingShares {
		return invalid("outstanding_shares", "as ações em circulação precisam estar entre %d e %d", MinOutstandingShares, MaxOutstandingShares)
	}
	// NewCompany reaproveita as regras do cadastro (CNPJ de 14 dígitos, setor, crescimento, qualidade).
	if _, err := catalog.NewCompany(strings.TrimSpace(s.CompanyName), s.CNPJ, s.Sector, s.BaseGrowthPct, s.QualityMultiplier); err != nil {
		field := "company"
		switch err {
		case catalog.ErrInvalidCNPJ:
			field = "cnpj"
		case catalog.ErrUnknownSector:
			field = "sector"
		case catalog.ErrInvalidBaseGrowthPct:
			field = "base_growth_pct"
		case catalog.ErrInvalidQualityMultiplier:
			field = "quality_multiplier"
		}
		return invalid(field, "%s", err.Error())
	}
	return nil
}

func (s Spec) validateETF() error {
	if err := checkName("benchmark_index", s.BenchmarkIndex, maxNameLength); err != nil {
		return err
	}
	if utf8.RuneCountInString(s.Methodology) > maxMethodologyLength {
		return invalid("methodology", "a metodologia tem no máximo %d caracteres", maxMethodologyLength)
	}
	if len(s.Holdings) == 0 || len(s.Holdings) > MaxETFHoldings {
		return invalid("holdings", "a cesta precisa de 1 a %d constituintes", MaxETFHoldings)
	}
	seen := map[string]bool{}
	for _, h := range s.Holdings {
		if seen[h.Ticker] {
			return invalid("holdings", "o ticker %s aparece duas vezes na cesta", h.Ticker)
		}
		seen[h.Ticker] = true
		if h.WeightPct <= 0 || h.WeightPct > 100 || math.IsNaN(h.WeightPct) {
			return invalid("holdings", "o peso de %s precisa estar entre 0 (exclusive) e 100", h.Ticker)
		}
	}
	return nil
}

// RiskClassFor deriva a classe de risco da ação do setor, a mesma convenção do seed
// (Mineração e Energia conservadoras, o resto sofisticado).
func RiskClassFor(sector catalog.Sector) string {
	if sector == catalog.SectorMineracao || sector == catalog.SectorEnergia {
		return "Conservador"
	}
	return "Sofisticado"
}
