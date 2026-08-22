// Package fii modela a especialização de FIIs (`fii_details`, spec 3.6,
// RF21): divididos em dois perfis com campos próprios e mutuamente
// exclusivos — tijolo (ativos físicos: segmento, patrimônio líquido,
// vacância) e papel (recebíveis: indexador da carteira).
package fii

import "errors"

// Type espelha o enum Postgres fii_type.
type Type string

const (
	TypeTijolo Type = "tijolo"
	TypePapel  Type = "papel"
)

var (
	ErrUnknownType         = errors.New("tipo de FII desconhecido")
	ErrTijoloComIndexador  = errors.New("FII de tijolo não pode ter indexador preenchido")
	ErrPapelComVacancyRate = errors.New("FII de papel não pode ter taxa de vacância preenchida")
)

// Details é a especialização de um FII (spec 3.6, RF21): campos próprios
// por perfil, mutuamente exclusivos entre si — o CHECK
// `fii_type_fields_chk` já garante essa exclusividade no banco (migration
// 000001_init_market_schema), mas o critério de aceite da tarefa 3.8 pede
// a mesma regra replicada "a nível de aplicação", não só confiada ao
// banco. Segment, NetWorth, VacancyRate e Indexador são ponteiros porque
// todos são nullable no schema (só Type é NOT NULL).
type Details struct {
	Type        Type
	Segment     *string
	NetWorth    *float64
	VacancyRate *float64
	Indexador   *string
}

// NewDetails monta a especialização de um FII, validando o critério de
// aceite da tarefa 3.8 — "FII de tijolo nunca tem indexador preenchido e
// vice-versa" (papel nunca tem taxa de vacância preenchida) — a mesma
// regra do CHECK fii_type_fields_chk do banco, replicada aqui na
// aplicação. Segment e NetWorth não são exigidos por perfil: a spec 3.6
// os descreve como os campos típicos do tijolo, mas nem o schema
// (nenhum dos dois é NOT NULL) nem o critério de aceite desta tarefa
// exigem essa obrigatoriedade — só a exclusividade mútua importa aqui.
func NewDetails(fiiType Type, segment *string, netWorth *float64, vacancyRate *float64, indexador *string) (Details, error) {
	switch fiiType {
	case TypeTijolo:
		if indexador != nil {
			return Details{}, ErrTijoloComIndexador
		}
	case TypePapel:
		if vacancyRate != nil {
			return Details{}, ErrPapelComVacancyRate
		}
	default:
		return Details{}, ErrUnknownType
	}

	return Details{
		Type:        fiiType,
		Segment:     segment,
		NetWorth:    netWorth,
		VacancyRate: vacancyRate,
		Indexador:   indexador,
	}, nil
}
