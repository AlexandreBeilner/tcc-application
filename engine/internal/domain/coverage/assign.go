// Package coverage é o domínio da cobertura de Market Maker (tarefa P.1,
// proposta-cobertura-market-maker.md): qual Market Maker cota qual ativo.
// Cobertura é dado, não código: este pacote só decide a atribuição, sem I/O.
package coverage

import "sort"

// MarketMaker é a visão mínima de um Market Maker que a atribuição precisa:
// identidade, se está ativo, o teto de ativos e quais já cobre.
type MarketMaker struct {
	AccountID       string
	Active          bool
	MaxAssets       int
	CoveredAssetIDs []string
}

func (m MarketMaker) covers(assetID string) bool {
	for _, id := range m.CoveredAssetIDs {
		if id == assetID {
			return true
		}
	}
	return false
}

// hasRoom indica se o Market Maker ainda pode assumir mais um ativo.
func (m MarketMaker) hasRoom() bool {
	return len(m.CoveredAssetIDs) < m.MaxAssets
}

// Assign devolve o Market Maker que deve assumir assetID: o ativo com menos
// ativos cobertos entre os que têm folga, desempate por AccountID (menor
// primeiro) pra ser determinístico. Ignora Market Maker inativo e quem já
// cobre assetID. ok = false sinaliza "precisa criar Market Maker" (nenhum com
// folga). Distribuir pelo menos carregado faz 15 ativos virarem dois Market
// Makers de 8 e 7, não 10 e 5.
func Assign(assetID string, marketMakers []MarketMaker) (accountID string, ok bool) {
	candidates := make([]MarketMaker, 0, len(marketMakers))
	for _, mm := range marketMakers {
		if mm.Active && mm.hasRoom() && !mm.covers(assetID) {
			candidates = append(candidates, mm)
		}
	}
	if len(candidates) == 0 {
		return "", false
	}

	sort.Slice(candidates, func(i, j int) bool {
		if len(candidates[i].CoveredAssetIDs) != len(candidates[j].CoveredAssetIDs) {
			return len(candidates[i].CoveredAssetIDs) < len(candidates[j].CoveredAssetIDs)
		}
		return candidates[i].AccountID < candidates[j].AccountID
	})
	return candidates[0].AccountID, true
}
