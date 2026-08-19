package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"

	"tcc-investimentos/engine/internal/domain/account"
)

// accountOpener é o colaborador que este handler precisa pra abrir uma
// conta nova — implementado por *account.Service, injetado em New.
type accountOpener interface {
	Open(ctx context.Context, userID string) (account.Account, error)
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type createAccountRequest struct {
	UserID string `json:"user_id"`
}

type accountResponse struct {
	UserID                 string  `json:"user_id"`
	CurrentBalance         float64 `json:"current_balance"`
	TotalInvested          float64 `json:"total_invested"`
	TotalDividendsReceived float64 `json:"total_dividends_received"`
}

func writeAccountError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func handleCreateAccount(accounts accountOpener) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if accounts == nil {
			writeAccountError(w, http.StatusServiceUnavailable, "serviço de contas indisponível")
			return
		}

		var req createAccountRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || !uuidPattern.MatchString(req.UserID) {
			writeAccountError(w, http.StatusBadRequest, "user_id é obrigatório e deve ser um UUID válido")
			return
		}

		acc, err := accounts.Open(r.Context(), req.UserID)
		if err != nil {
			if errors.Is(err, account.ErrAlreadyExists) {
				writeAccountError(w, http.StatusConflict, err.Error())
				return
			}
			writeAccountError(w, http.StatusInternalServerError, "erro ao criar conta")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(accountResponse{
			UserID:                 acc.UserID,
			CurrentBalance:         acc.CurrentBalance,
			TotalInvested:          acc.TotalInvested,
			TotalDividendsReceived: acc.TotalDividendsReceived,
		})
	}
}
