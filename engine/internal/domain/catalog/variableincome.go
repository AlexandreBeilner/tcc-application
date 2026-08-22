package catalog

import "errors"

var ErrMissingAssetID = errors.New("asset_id é obrigatório para especialização de renda variável")

// VariableIncomeAsset é a especialização de um ativo de renda variável
// (variable_income_assets) — CompanyID é nulo pra ETFs/FIIs (não têm
// empresa emissora individual); ShareClass/OutstandingShares só fazem
// sentido pra ações (ON/PN).
type VariableIncomeAsset struct {
	AssetID           string
	CompanyID         *string
	ShareClass        *string
	OutstandingShares *int64
}

// NewVariableIncomeAsset valida o único invariante comum às três classes
// (ação/ETF/FII): precisa estar associado a um asset_id já existente. A
// obrigatoriedade de CompanyID pra ações é responsabilidade de quem monta
// o catálogo (seed), não do construtor — o schema já deixa CompanyID
// nullable porque ETFs/FIIs legitimamente não têm empresa.
func NewVariableIncomeAsset(assetID string, companyID *string, shareClass *string, outstandingShares *int64) (VariableIncomeAsset, error) {
	if assetID == "" {
		return VariableIncomeAsset{}, ErrMissingAssetID
	}

	return VariableIncomeAsset{
		AssetID:           assetID,
		CompanyID:         companyID,
		ShareClass:        shareClass,
		OutstandingShares: outstandingShares,
	}, nil
}
