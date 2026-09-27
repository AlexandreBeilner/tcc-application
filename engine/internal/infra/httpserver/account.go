package httpserver

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"time"

	"tcc-investimentos/engine/internal/domain"
	"tcc-investimentos/engine/internal/domain/account"
)

// accountOpener é o colaborador que POST /accounts precisa pra abrir uma
// conta nova — implementado por *account.Service, injetado em New.
type accountOpener interface {
	Open(ctx context.Context, userID string) (account.Account, error)
}

// accountReader é o colaborador que GET /accounts/:user_id precisa pra ler
// uma conta já existente — implementado por *db.AccountRepository, injetado
// em New (tarefa 4.7). Interface separada de accountOpener porque a leitura
// não passa pelo domínio de abertura de conta (account.Service), é
// projeção direta de accounts — mesma separação write/read já usada entre
// macroEventTriggerer e macroEventLister (tarefa 4.4/4.5).
type accountReader interface {
	FindByUserID(ctx context.Context, userID string) (account.Account, bool, error)
}

// userEventLister é o colaborador que GET /accounts/:user_id/events
// precisa pra ler o extrato (tarefa 4.7, RF05) — implementado por
// *db.AccountRepository, injetado em New.
type userEventLister interface {
	ListMarketEventsByUser(ctx context.Context, userID string, limit, offset int) ([]domain.MarketEventRecord, error)
}

// accountSalaryCrediter é o colaborador que POST /accounts/{user_id}/salary
// precisa pra creditar salário (tarefa T.2) — implementado por
// *account.Service, injetado em New junto com accountOpener (mesma conta
// concreta serve as duas portas, mesma convenção de userMarketDataReader
// agregando leituras pequenas pro mesmo *db.AccountRepository).
type accountSalaryCrediter interface {
	CreditSalary(ctx context.Context, userID string, amount float64) error
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

type createAccountRequest struct {
	UserID string `json:"user_id"`
}

type creditSalaryRequest struct {
	Amount float64 `json:"amount"`
}

type accountResponse struct {
	UserID                 string  `json:"user_id"`
	CurrentBalance         float64 `json:"current_balance"`
	TotalInvested          float64 `json:"total_invested"`
	TotalDisinvested       float64 `json:"total_disinvested"`
	TotalDividendsReceived float64 `json:"total_dividends_received"`
}

func writeAccountError(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func toAccountResponse(acc account.Account) accountResponse {
	return accountResponse{
		UserID:                 acc.UserID,
		CurrentBalance:         acc.CurrentBalance,
		TotalInvested:          acc.TotalInvested,
		TotalDisinvested:       acc.TotalDisinvested,
		TotalDividendsReceived: acc.TotalDividendsReceived,
	}
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
		_ = json.NewEncoder(w).Encode(toAccountResponse(acc))
	}
}

// handleGetAccount serve GET /accounts/:user_id — os 3 campos monetários
// de accounts (tarefa 4.7). Nenhum parâmetro além do user_id explícito no
// path: não existe listagem de conta de terceiros (RNF09 é sobre valor
// absoluto de patrimônio pra outro usuário; aqui a garantia equivalente é
// simplesmente nunca aceitar consulta sem um user_id — a decisão de quem
// pode pedir o quê é do backend, não do motor).
func handleGetAccount(accounts accountReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if accounts == nil {
			writeAccountError(w, http.StatusServiceUnavailable, "serviço de contas indisponível")
			return
		}

		userID := r.PathValue("user_id")
		acc, found, err := accounts.FindByUserID(r.Context(), userID)
		if err != nil {
			writeAccountError(w, http.StatusInternalServerError, "erro ao buscar conta")
			return
		}
		if !found {
			writeAccountError(w, http.StatusNotFound, "conta não encontrada")
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(toAccountResponse(acc))
	}
}

// handleCreditSalary serve POST /accounts/{user_id}/salary — crédito de
// salário mensal (tarefa T.2), caixa livre que nunca passa por
// total_invested/total_disinvested/total_dividends_received (T.1). Quem
// decide quando/quanto pagar é externo ao motor (T.5, backend); aqui só se
// valida amount > 0 e se grava o evento imutável correspondente antes de
// creditar current_balance, na mesma transação (Event Sourcing, CLAUDE.md).
// 204 sem corpo no sucesso — mesmo padrão de handleCancelOrder, não há
// recurso novo pra devolver.
func handleCreditSalary(accounts accountSalaryCrediter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if accounts == nil {
			writeAccountError(w, http.StatusServiceUnavailable, "serviço de contas indisponível")
			return
		}

		var req creditSalaryRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Amount <= 0 {
			writeAccountError(w, http.StatusBadRequest, "amount é obrigatório e deve ser positivo")
			return
		}

		userID := r.PathValue("user_id")
		if err := accounts.CreditSalary(r.Context(), userID, req.Amount); err != nil {
			if errors.Is(err, account.ErrNotFound) {
				writeAccountError(w, http.StatusNotFound, err.Error())
				return
			}
			writeAccountError(w, http.StatusInternalServerError, "erro ao creditar salário")
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

type marketEventResponse struct {
	ID        string    `json:"id"`
	EventType string    `json:"event_type"`
	AssetID   *string   `json:"asset_id,omitempty"`
	Quantity  *int      `json:"quantity,omitempty"`
	UnitValue *float64  `json:"unit_value,omitempty"`
	Timestamp time.Time `json:"timestamp"`
}

// handleListAccountEvents serve GET /accounts/:user_id/events — extrato
// cronológico reverso de market_events (tarefa 4.7, RF05, tela 4.8),
// paginado com a mesma convenção ?limit=&offset= de GET /admin/macro-events
// (4.5) — defaultMacroEventListLimit/maxMacroEventListLimit reaproveitados
// de macroevents.go. Usuário sem conta ou sem evento nenhum devolve lista
// vazia, não erro nem 404 — diferente de GET /accounts/:user_id, aqui não
// há "recurso" nenhum a não encontrar, só uma consulta que pode não achar
// linha nenhuma.
func handleListAccountEvents(events userEventLister) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if events == nil {
			writeAccountError(w, http.StatusServiceUnavailable, "serviço de contas indisponível")
			return
		}

		limit, ok := parsePaginationParam(r.URL.Query().Get("limit"), defaultMacroEventListLimit, 1, maxMacroEventListLimit)
		if !ok {
			writeAccountError(w, http.StatusBadRequest, "limit inválido")
			return
		}
		offset, ok := parsePaginationParam(r.URL.Query().Get("offset"), 0, 0, 0)
		if !ok {
			writeAccountError(w, http.StatusBadRequest, "offset inválido")
			return
		}

		userID := r.PathValue("user_id")
		records, err := events.ListMarketEventsByUser(r.Context(), userID, limit, offset)
		if err != nil {
			writeAccountError(w, http.StatusInternalServerError, "erro ao buscar extrato")
			return
		}

		resp := make([]marketEventResponse, 0, len(records))
		for _, rec := range records {
			resp = append(resp, marketEventResponse{
				ID:        rec.ID,
				EventType: string(rec.EventType),
				AssetID:   rec.AssetID,
				Quantity:  rec.Quantity,
				UnitValue: rec.UnitValue,
				Timestamp: rec.Timestamp,
			})
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(resp)
	}
}
