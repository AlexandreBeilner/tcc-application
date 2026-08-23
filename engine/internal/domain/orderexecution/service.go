package orderexecution

import (
	"context"

	"tcc-investimentos/engine/internal/domain/orderbook"
)

// incomingOrderID é um ID de placeholder pra ordem recebida durante o
// matching em memória (Execute) — nunca persistido nem usado como chave de
// busca de contraparte (só ordens *pendentes* têm ID real, vindo do banco;
// a ordem recebida ainda não tem linha em order_book quando é processada).
const incomingOrderID = "incoming"

// Request é a ordem recebida via HTTP, antes de qualquer persistência.
type Request struct {
	UserID   string
	AssetID  string
	Side     orderbook.Side
	Type     orderbook.Type
	Price    float64 // ignorado por ordens a mercado
	Quantity int
}

// Repository é o colaborador que Service precisa pra ler o contexto de
// execução (liquidez real pendente pro ativo, preço de referência
// corrente, saldo/posição do usuário da ordem recebida) e persistir o
// resultado atomicamente — implementado por *db.OrderExecutionRepository,
// injetado em NewService.
type Repository interface {
	// LoadContext lê tudo que Execute precisa pra processar uma ordem de
	// userID no ativo assetID: ordens reais pendentes desse ativo (em
	// ordem de chegada), o preço de referência corrente (asset_quotes,
	// tarefa 3.11) e o saldo/posição atuais do usuário.
	LoadContext(ctx context.Context, assetID, userID string) (Context, error)
	// Persist grava o resultado de Execute atomicamente: o evento
	// imutável em market_events de cada Fill (real e sintético) **antes**
	// de projetar em accounts/positions/order_book — Event Sourcing é a
	// fonte da verdade financeira (CLAUDE.md). Nunca chamado se Execute
	// devolveu erro (nada é persistido de uma ordem rejeitada).
	Persist(ctx context.Context, req Request, outcome Outcome) error
}

// Service orquestra a execução de uma ordem ponta a ponta (tarefa 3.12):
// carrega o contexto real do book + saldo/posição, roda o matching puro
// (Execute) e persiste o resultado, na mesma ordem que tick.Service.Run já
// estabelece (ler → calcular → persistir).
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Submit processa uma ordem recebida. Se Execute rejeitar (saldo/posição
// insuficiente, quantidade/preço inválidos), nada é persistido — o erro
// devolvido identifica o motivo pro handler HTTP mapear pro status certo.
func (s *Service) Submit(ctx context.Context, req Request) (Outcome, error) {
	execCtx, err := s.repo.LoadContext(ctx, req.AssetID, req.UserID)
	if err != nil {
		return Outcome{}, err
	}

	incoming := orderbook.Order{
		ID:       incomingOrderID,
		Side:     req.Side,
		Type:     req.Type,
		Price:    req.Price,
		Quantity: req.Quantity,
	}

	outcome, err := Execute(incoming, execCtx)
	if err != nil {
		return Outcome{}, err
	}

	if err := s.repo.Persist(ctx, req, outcome); err != nil {
		return Outcome{}, err
	}
	return outcome, nil
}
