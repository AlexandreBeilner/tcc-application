// Package catalog modela o catálogo de ativos negociáveis do mercado — o
// dado de referência (assets/companies/variable_income_assets) sobre o
// qual as fórmulas de precificação (fixedincome, equity, etf, fii) e o
// order book operam. Diferente de account/eventstore, não é Event
// Sourcing: catálogo é dado cadastral, não histórico financeiro.
package catalog

import "errors"

// AssetType espelha o enum Postgres asset_type (migration
// 000001_init_market_schema).
type AssetType string

const (
	AssetTesouroSelic     AssetType = "tesouro_selic"
	AssetTesouroPrefixado AssetType = "tesouro_prefixado"
	AssetTesouroIPCA      AssetType = "tesouro_ipca"
	AssetCDB              AssetType = "cdb"
	AssetLCI              AssetType = "lci"
	AssetLCA              AssetType = "lca"
	AssetCRI              AssetType = "cri"
	AssetCRA              AssetType = "cra"
	AssetAcao             AssetType = "acao"
	AssetETF              AssetType = "etf"
	AssetFII              AssetType = "fii"
)

var validAssetTypes = map[AssetType]bool{
	AssetTesouroSelic: true, AssetTesouroPrefixado: true, AssetTesouroIPCA: true,
	AssetCDB: true, AssetLCI: true, AssetLCA: true, AssetCRI: true, AssetCRA: true,
	AssetAcao: true, AssetETF: true, AssetFII: true,
}

var (
	ErrMissingTicker    = errors.New("ticker do ativo é obrigatório")
	ErrMissingName      = errors.New("nome do ativo é obrigatório")
	ErrUnknownAssetType = errors.New("tipo de ativo desconhecido")
)

// Asset é um ativo negociável do catálogo — a linha comum a todas as
// classes (renda fixa, ação, ETF, FII); a especialização por classe fica
// em fixed_income_assets/variable_income_assets + etf_details/fii_details.
type Asset struct {
	Ticker    string
	Name      string
	Type      AssetType
	RiskClass *string
	IsSandbox bool
}

// NewAsset valida os invariantes mínimos de um ativo do catálogo — ticker
// e nome não vazios, tipo dentre os 11 valores do enum. Não valida a
// nomenclatura de ticker (final 3/4/11 — ON/PN/units) porque essa é uma
// convenção de exibição, não uma restrição do schema; fica a cargo de quem
// monta o catálogo (seed, e futuramente 7.2) escolher tickers coerentes.
func NewAsset(ticker, name string, assetType AssetType, riskClass *string, isSandbox bool) (Asset, error) {
	if ticker == "" {
		return Asset{}, ErrMissingTicker
	}
	if name == "" {
		return Asset{}, ErrMissingName
	}
	if !validAssetTypes[assetType] {
		return Asset{}, ErrUnknownAssetType
	}

	return Asset{
		Ticker:    ticker,
		Name:      name,
		Type:      assetType,
		RiskClass: riskClass,
		IsSandbox: isSandbox,
	}, nil
}
