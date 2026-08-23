package httpserver

import (
	"context"
	"net/http"

	"tcc-investimentos/engine/internal/domain/tick"
)

// ticker é o colaborador que POST /admin/tick precisa pra forçar um tick
// fora do agendamento normal — implementado por *tick.Service, injetado em
// New (tarefa 3.11).
//
// Sem checagem de role = admin aqui: o motor nunca é exposto ao host (só o
// backend gamificado o chama, na rede interna do Compose — mesmo trust
// boundary de POST /accounts, GET /assets etc.) e não tem acesso ao
// Postgres de usuários/roles (banco "gamification" é do backend). A
// restrição "só role = admin" (RNF07, critério de aceite da 3.11) fica a
// cargo de quem expuser esta rota publicamente — decisão confirmada com o
// usuário em 2026-08-22: o backend valida role = admin (authMiddleware já
// existe desde a tarefa 1.4) antes de repassar a chamada pra cá, quando o
// painel admin (tarefa 4.5) existir. Até lá, POST /admin/tick só é
// alcançável de dentro da rede do Compose.
type ticker interface {
	Run(ctx context.Context) (tick.Result, error)
}

type tickResponse struct {
	Day         int     `json:"day"`
	SelicRate   float64 `json:"selic_rate"`
	QuotesCount int     `json:"quotes_count"`
	IsCopomDay  bool    `json:"is_copom_day"`
	IsReportDay bool    `json:"is_report_day"`
}

// handleAdminTick serve POST /admin/tick — força um tick fora do
// agendamento diário automático (tarefa 3.11), tanto pra testar sem esperar
// um dia real quanto como recurso de demonstração ao vivo pra banca.
func handleAdminTick(t ticker) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if t == nil {
			writeCatalogError(w, http.StatusServiceUnavailable, "temporizador indisponível")
			return
		}

		result, err := t.Run(r.Context())
		if err != nil {
			writeCatalogError(w, http.StatusInternalServerError, "erro ao executar tick")
			return
		}

		writeJSON(w, http.StatusOK, tickResponse{
			Day:         result.State.Day,
			SelicRate:   result.State.SelicRate,
			QuotesCount: len(result.Quotes),
			IsCopomDay:  result.IsCopomDay,
			IsReportDay: result.IsReportDay,
		})
	}
}
