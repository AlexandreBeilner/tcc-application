// Package fii modela a especialização de FIIs (`fii_details`, spec 3.6,
// RF21): divididos em dois perfis com campos próprios e mutuamente
// exclusivos — tijolo (ativos físicos: segmento, patrimônio líquido
// (`NetWorth`), vacância) e papel (recebíveis: valor de carteira
// (`PortfolioValue`), indexador). NetWorth/PortfolioValue são a mesma
// grandeza numérica na prática — a base de `dividend.FIIValuePerShare`
// (tarefa 4.9/4.10) — só o nome e a coluna de origem mudam por perfil,
// porque "patrimônio líquido" não é a métrica de um fundo de recebíveis
// (spec 3.6).
package fii

import "errors"

// Type espelha o enum Postgres fii_type.
type Type string

const (
	TypeTijolo Type = "tijolo"
	TypePapel  Type = "papel"
)

var (
	ErrUnknownType             = errors.New("tipo de FII desconhecido")
	ErrTijoloComIndexador      = errors.New("FII de tijolo não pode ter indexador preenchido")
	ErrTijoloComPortfolioValue = errors.New("FII de tijolo não pode ter valor de carteira preenchido")
	ErrPapelComVacancyRate     = errors.New("FII de papel não pode ter taxa de vacância preenchida")
	ErrPapelComNetWorth        = errors.New("FII de papel não pode ter patrimônio líquido preenchido")
)

// Details é a especialização de um FII (spec 3.6, RF21): campos próprios
// por perfil, mutuamente exclusivos entre si — o CHECK
// `fii_type_fields_chk` já garante essa exclusividade no banco (migration
// 000001_init_market_schema, reforçada pela 000009_fii_papel_portfolio_value
// pra NetWorth/PortfolioValue), mas o critério de aceite da tarefa 3.8 pede
// a mesma regra replicada "a nível de aplicação", não só confiada ao
// banco. Segment, NetWorth, VacancyRate, Indexador e PortfolioValue são
// ponteiros porque todos são nullable no schema (só Type é NOT NULL).
type Details struct {
	Type           Type
	Segment        *string
	NetWorth       *float64
	VacancyRate    *float64
	Indexador      *string
	PortfolioValue *float64
	// OutstandingShares (tarefa U.6) são as cotas em circulação
	// (variable_income_assets), preenchidas só na leitura do catálogo
	// (FindFIIDetails) e ignoradas por NewDetails: servem ao P/VP exibido.
	OutstandingShares *int64
}

// NewDetails monta a especialização de um FII, validando o critério de
// aceite da tarefa 3.8 — "FII de tijolo nunca tem indexador preenchido e
// vice-versa" (papel nunca tem taxa de vacância preenchida) — e da tarefa
// 4.10, que estende a mesma exclusividade a NetWorth/PortfolioValue (tijolo
// nunca tem PortfolioValue, papel nunca tem NetWorth) — a mesma regra do
// CHECK fii_type_fields_chk do banco, replicada aqui na aplicação. Segment
// e NetWorth/PortfolioValue não são exigidos por perfil: a spec 3.6 os
// descreve como os campos típicos de cada perfil, mas nem o schema (nenhum
// é NOT NULL) nem o critério de aceite desta tarefa exigem essa
// obrigatoriedade — só a exclusividade mútua importa aqui.
func NewDetails(fiiType Type, segment *string, netWorth *float64, vacancyRate *float64, indexador *string, portfolioValue *float64) (Details, error) {
	switch fiiType {
	case TypeTijolo:
		if indexador != nil {
			return Details{}, ErrTijoloComIndexador
		}
		if portfolioValue != nil {
			return Details{}, ErrTijoloComPortfolioValue
		}
	case TypePapel:
		if vacancyRate != nil {
			return Details{}, ErrPapelComVacancyRate
		}
		if netWorth != nil {
			return Details{}, ErrPapelComNetWorth
		}
	default:
		return Details{}, ErrUnknownType
	}

	return Details{
		Type:           fiiType,
		Segment:        segment,
		NetWorth:       netWorth,
		VacancyRate:    vacancyRate,
		Indexador:      indexador,
		PortfolioValue: portfolioValue,
	}, nil
}
