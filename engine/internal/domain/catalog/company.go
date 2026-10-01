package catalog

import "errors"

// Sector espelha o enum Postgres company_sector — lista fixa exigida pela
// spec 3.3.2 pra casar com o catálogo de templates de evento macro.
type Sector string

const (
	SectorMineracao   Sector = "Mineração"
	SectorAgronegocio Sector = "Agronegócio"
	SectorBancario    Sector = "Bancário/Financeiro"
	SectorVarejo      Sector = "Varejo"
	SectorEnergia     Sector = "Energia"
	SectorTecnologia  Sector = "Tecnologia"
)

var validSectors = map[Sector]bool{
	SectorMineracao: true, SectorAgronegocio: true, SectorBancario: true,
	SectorVarejo: true, SectorEnergia: true, SectorTecnologia: true,
}

// IsValidSector indica se sector é um dos 6 valores fixos da spec 3.3.2 —
// usado pela tarefa 4.4 (disparo de evento macro) pra devolver 400 num
// setor desconhecido em vez de repassar a string direto pro enum do banco,
// mesmo padrão de IsValidAssetType (tarefa 3.10).
func IsValidSector(sector Sector) bool {
	return validSectors[sector]
}

// DefaultReportFrequencyDays é o default do schema (company_fundamentals
// migration 000033) e o valor fixado pela spec 3.3.1 (ciclo global, tarefa
// 3.6) — um trimestre real de 91 dias simulados desde a tarefa S.2; não
// configurável por empresa nesta fase.
const DefaultReportFrequencyDays = 91

const cnpjDigits = 14

// DefaultBaseGrowthPct é o default do schema (companies.base_growth_pct,
// migration 000035) — mesmo crescimento_base ilustrativo (3% ao ciclo) que
// fundamentals.DefaultBaseGrowth já expressava como fração antes desta
// tarefa (0.03 == 3.00%), duplicado aqui como constante independente
// porque fundamentals importa catalog, não o contrário (mesma convenção de
// etf.InitialSharePrice duplicar tick.DefaultInitialPrice). Toda empresa
// seedada antes da tarefa 7.2 (Mineradora Vale do Rio, Banco Nordeste
// Digital) usa este valor, preservando o comportamento anterior a
// base_growth_pct existir.
const DefaultBaseGrowthPct = 3.00

// minBaseGrowthPct é o piso de baseGrowthPct: abaixo de -100% o fator
// (1+crescimento) usado por fundamentals.BootstrapFinancialsForTargetPrice/
// NextGrowth zera ou inverte, sem leitura financeira útil (mesma restrição
// de fundamentals.ErrInvalidGrowthRate).
const minBaseGrowthPct = -100.0

// DefaultQualityMultiplier é o default do schema (companies.
// quality_multiplier, migration 000039): empresa na média do setor, com os
// coeficientes de fundamentals.CoefficientsBySector sem ajuste.
const DefaultQualityMultiplier = 1.00

// maxQualityMultiplier é o teto de qualityMultiplier: acima disso a margem
// líquida do setor mais rentável (Bancário, 22%) passaria de 44% e deixaria
// de ser plausível pra uma empresa sintética.
const maxQualityMultiplier = 2.0

var (
	ErrMissingCompanyName       = errors.New("nome da empresa é obrigatório")
	ErrInvalidCNPJ              = errors.New("CNPJ deve ter 14 dígitos")
	ErrUnknownSector            = errors.New("setor de empresa desconhecido")
	ErrInvalidBaseGrowthPct     = errors.New("crescimento_base da empresa não pode zerar ou inverter o fator (1+crescimento)")
	ErrInvalidQualityMultiplier = errors.New("multiplicador de qualidade da empresa precisa estar em (0, 2]")
)

// Company é o cadastro de uma empresa emissora de ações (companies) —
// separado do ativo negociável em si (uma empresa pode emitir ON e PN,
// spec 3.6/DER).
type Company struct {
	Name                string
	CNPJ                string
	Sector              Sector
	ReportFrequencyDays int
	// BaseGrowthPct (tarefa 7.2, migration 000035) é o crescimento_base
	// desta empresa por ciclo de relatório, em % (ex: 8.00 = 8% ao
	// trimestre) — substitui o único valor global que toda empresa usava
	// (fundamentals.DefaultBaseGrowth) por um grau de liberdade por
	// empresa — junto de QualityMultiplier (achado 025), que varia ROE/
	// margem/alavancagem, expressa "empresa boa/média/ruim" dentro de um
	// mesmo setor. Uma empresa com crescimento mais alto sustenta um preço
	// justo mais alto (fundamentals.BootstrapFinancialsForTargetPrice/
	// bot.FundamentalistFairPrice), lido todo dia pelo Fundamentalista
	// (tick.companyRoundContexts), não só no dia de relatório.
	BaseGrowthPct float64
	// QualityMultiplier (achado 025, migration 000039) escala a rentabilidade
	// e a alavancagem do setor pra esta empresa (fundamentals.
	// CoefficientsForCompany): 1.00 é a média do setor, acima disso a
	// empresa tem margem/ROE maiores e menos dívida, abaixo o contrário.
	// Complementa BaseGrowthPct: sem ele, ROE/margem/alavancagem eram
	// idênticos pra toda empresa do mesmo setor.
	QualityMultiplier float64
}

// NewCompany valida os invariantes mínimos de uma empresa cadastrada —
// nome não vazio, CNPJ com 14 dígitos (sem validar dígito verificador,
// fora de escopo pra dado sintético), setor dentre os 6 valores fixos,
// baseGrowthPct que não zere/inverta o fator (1+crescimento) (tarefa 7.2),
// qualityMultiplier em (0, 2] (achado 025).
func NewCompany(name, cnpj string, sector Sector, baseGrowthPct, qualityMultiplier float64) (Company, error) {
	if name == "" {
		return Company{}, ErrMissingCompanyName
	}
	if len(cnpj) != cnpjDigits {
		return Company{}, ErrInvalidCNPJ
	}
	for _, r := range cnpj {
		if r < '0' || r > '9' {
			return Company{}, ErrInvalidCNPJ
		}
	}
	if !validSectors[sector] {
		return Company{}, ErrUnknownSector
	}
	if baseGrowthPct <= minBaseGrowthPct {
		return Company{}, ErrInvalidBaseGrowthPct
	}

	if qualityMultiplier <= 0 || qualityMultiplier > maxQualityMultiplier {
		return Company{}, ErrInvalidQualityMultiplier
	}

	return Company{
		Name:                name,
		CNPJ:                cnpj,
		Sector:              sector,
		ReportFrequencyDays: DefaultReportFrequencyDays,
		BaseGrowthPct:       baseGrowthPct,
		QualityMultiplier:   qualityMultiplier,
	}, nil
}
