package httpserver

import (
	"context"
	"net/http"

	"tcc-investimentos/engine/internal/domain/tick"
)

// indicatorHistoryReader é o colaborador que GET /market/indicators/history
// precisa pra ler a série histórica de Selic/IPCA (tarefa M.2) —
// implementado por *db.TickRepository, que já grava market_indicator_history
// em SaveTick (tarefa M.1) e por isso é o dono natural da leitura também.
type indicatorHistoryReader interface {
	ListIndicatorHistory(ctx context.Context, days int) ([]tick.IndicatorHistoryEntry, error)
}

// defaultIndicatorHistoryDays é o "default razoável" pedido pela tarefa M.2
// pra ?days= — bem maior que defaultQuoteHistoryDays (30, tarefa 4.6)
// porque Selic/IPCA só mudam no máximo 1x a cada ciclo de ~21-30 dias
// simulados (selic.CopomMeetingIntervalDays/ipca.DefaultMonthDays): 30 dias
// mostraria quase sempre uma linha reta. 90 dias cobre uns 4 ciclos de
// Copom e 3 meses de IPCA, o bastante pra um gráfico com movimento
// (tarefa M.4).
const defaultIndicatorHistoryDays = 90

type indicatorHistoryEntryResponse struct {
	SimulatedDay       int     `json:"simulated_day"`
	SelicRate          float64 `json:"selic_rate"`
	IPCAMonthlyRate    float64 `json:"ipca_monthly_rate"`
	IPCAAccumulated12m float64 `json:"ipca_accumulated_12m"`
}

// handleGetIndicatorHistory serve GET /market/indicators/history — série
// histórica de Selic/IPCA (tarefa M.2, base do gráfico da tela "Indicadores
// Econômicos", tarefa M.4). Sem conceito de "não encontrado": lista vazia
// (não erro) se o Temporizador nunca rodou ainda, mesmo tratamento de
// handleGetAssetQuoteHistory (4.6)/handleListMacroEvents (4.5).
func handleGetIndicatorHistory(reader indicatorHistoryReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reader == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "serviço de indicadores indisponível")
			return
		}

		days, ok := parsePaginationParam(r.URL.Query().Get("days"), defaultIndicatorHistoryDays, 1, 0)
		if !ok {
			writeCatalogError(w, http.StatusBadRequest, "days inválido")
			return
		}

		history, err := reader.ListIndicatorHistory(r.Context(), days)
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao buscar histórico de indicadores")
			return
		}

		entries := make([]indicatorHistoryEntryResponse, 0, len(history))
		for _, e := range history {
			entries = append(entries, indicatorHistoryEntryResponse{
				SimulatedDay:       e.SimulatedDay,
				SelicRate:          e.SelicRate,
				IPCAMonthlyRate:    e.IPCAMonthlyRate,
				IPCAAccumulated12m: e.IPCAAccumulated12m,
			})
		}
		writeJSON(w, http.StatusOK, entries)
	}
}
