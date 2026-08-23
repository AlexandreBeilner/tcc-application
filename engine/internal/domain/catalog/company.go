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
// migration 000001) e o valor fixado pela spec 3.3.1 (ciclo quinzenal
// global, tarefa 3.6) — não configurável por empresa nesta fase.
const DefaultReportFrequencyDays = 14

const cnpjDigits = 14

var (
	ErrMissingCompanyName = errors.New("nome da empresa é obrigatório")
	ErrInvalidCNPJ        = errors.New("CNPJ deve ter 14 dígitos")
	ErrUnknownSector      = errors.New("setor de empresa desconhecido")
)

// Company é o cadastro de uma empresa emissora de ações (companies) —
// separado do ativo negociável em si (uma empresa pode emitir ON e PN,
// spec 3.6/DER).
type Company struct {
	Name                string
	CNPJ                string
	Sector              Sector
	ReportFrequencyDays int
}

// NewCompany valida os invariantes mínimos de uma empresa cadastrada —
// nome não vazio, CNPJ com 14 dígitos (sem validar dígito verificador,
// fora de escopo pra dado sintético), setor dentre os 6 valores fixos.
func NewCompany(name, cnpj string, sector Sector) (Company, error) {
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

	return Company{
		Name:                name,
		CNPJ:                cnpj,
		Sector:              sector,
		ReportFrequencyDays: DefaultReportFrequencyDays,
	}, nil
}
