package httpserver

import (
	"context"
	"net/http"

	"tcc-investimentos/engine/internal/domain/catalog"
)

// companyCatalogReader é o colaborador que o handler de /companies/:id
// precisa pra ler o catálogo — implementado por *db.CatalogRepository,
// injetado em New (tarefa 3.10).
type companyCatalogReader interface {
	FindCompanyByID(ctx context.Context, id string) (catalog.CompanyRecord, bool, error)
	ListAssetsByCompany(ctx context.Context, companyID string) ([]catalog.IssuedAsset, error)
}

type companyAssetResponse struct {
	ID         string  `json:"id"`
	Ticker     string  `json:"ticker"`
	Name       string  `json:"name"`
	ShareClass *string `json:"share_class,omitempty"`
}

type companyDetailResponse struct {
	ID     string                 `json:"id"`
	Name   string                 `json:"name"`
	CNPJ   string                 `json:"cnpj"`
	Sector string                 `json:"sector"`
	Assets []companyAssetResponse `json:"assets"`
}

// handleGetCompany serve GET /companies/:id — dados cadastrais da empresa
// mais a lista de ativos de renda variável por ela emitidos (tarefa 3.10).
func handleGetCompany(catalogReader companyCatalogReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if catalogReader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de catálogo indisponível")
			return
		}

		id := r.PathValue("id")

		company, found, err := catalogReader.FindCompanyByID(r.Context(), id)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar empresa")
			return
		}
		if !found {
			writeCatalogError(w, http.StatusNotFound, "empresa não encontrada")
			return
		}

		issued, err := catalogReader.ListAssetsByCompany(r.Context(), company.ID)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao listar ativos da empresa")
			return
		}

		assets := make([]companyAssetResponse, 0, len(issued))
		for _, ia := range issued {
			assets = append(assets, companyAssetResponse{
				ID:         ia.AssetID,
				Ticker:     ia.Ticker,
				Name:       ia.Name,
				ShareClass: ia.ShareClass,
			})
		}

		writeJSON(w, http.StatusOK, companyDetailResponse{
			ID:     company.ID,
			Name:   company.Name,
			CNPJ:   company.CNPJ,
			Sector: string(company.Sector),
			Assets: assets,
		})
	}
}
