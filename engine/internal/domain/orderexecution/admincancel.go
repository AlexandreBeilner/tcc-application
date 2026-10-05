package orderexecution

import (
	"context"
	"errors"
	"fmt"
)

// MaxAdminCancelBatch é o teto de ordens que um único cancelamento em lote do
// painel pode atingir (tarefa N.10). Acima disso o lote é recusado inteiro, sem
// cancelar nada: um filtro largo demais é quase sempre engano, e a ação pede
// confirmação explícita com a lista de ids.
const MaxAdminCancelBatch = 500

var (
	// ErrCancelFilterRequired é devolvido quando o lote não traz ativo nem dono:
	// "cancelar tudo" não é uma operação do painel.
	ErrCancelFilterRequired = errors.New("informe o ativo ou o dono para cancelar em lote")
)

// BatchTooLargeError é a recusa de um lote que atingiria mais ordens que o teto.
// Carrega quantas ordens o filtro atinge, pro admin estreitar o filtro.
type BatchTooLargeError struct {
	Matched int
	Max     int
}

func (e *BatchTooLargeError) Error() string {
	return fmt.Sprintf("o filtro atinge %d ordens, acima do teto de %d por lote", e.Matched, e.Max)
}

// CancelFilter escolhe as ordens em repouso de um cancelamento em lote. Pelo
// menos um dos dois campos é obrigatório; com os dois, vale a interseção (as
// ordens do dono naquele ativo, que é o que a N.1 usa ao tirar um ativo de um
// Market Maker).
type CancelFilter struct {
	AssetID string
	UserID  string
}

// Validate recusa o filtro vazio.
func (f CancelFilter) Validate() error {
	if f.AssetID == "" && f.UserID == "" {
		return ErrCancelFilterRequired
	}
	return nil
}

// AdminRepository é o que o cancelamento administrativo precisa do banco. Fica
// separado de Repository porque é um caminho próprio do painel (sem checagem de
// dono), implementado pelo mesmo *db.OrderExecutionRepository.
type AdminRepository interface {
	// AdminCancelOrder cancela uma ordem em repouso com CancelReasonAdmin,
	// qualquer que seja o dono: ErrOrderNotFound se não existe,
	// ErrOrderNotCancellable se já está filled/cancelled.
	AdminCancelOrder(ctx context.Context, orderID string) error
	// AdminCancelBatch cancela as ordens em repouso que casam com o filtro, numa
	// transação, e devolve os ids cancelados. Se o filtro atinge mais que max
	// ordens, não cancela nenhuma e devolve *BatchTooLargeError.
	AdminCancelBatch(ctx context.Context, filter CancelFilter, max int) ([]string, error)
}

// AdminService é o cancelamento por intervenção do painel (tarefa N.10). Cancelar
// só muda o status da ordem: nenhuma ordem em repouso reserva saldo nem posição
// (achado 015, revalidação no match), então não há reserva a devolver e nada passa
// por market_events, igual ao cancelamento do próprio dono (O.1).
type AdminService struct {
	repo AdminRepository
}

func NewAdminService(repo AdminRepository) *AdminService {
	return &AdminService{repo: repo}
}

// Cancel cancela uma ordem por intervenção administrativa.
func (s *AdminService) Cancel(ctx context.Context, orderID string) error {
	return s.repo.AdminCancelOrder(ctx, orderID)
}

// CancelBatch cancela as ordens em repouso do filtro, até MaxAdminCancelBatch.
func (s *AdminService) CancelBatch(ctx context.Context, filter CancelFilter) ([]string, error) {
	if err := filter.Validate(); err != nil {
		return nil, err
	}
	return s.repo.AdminCancelBatch(ctx, filter, MaxAdminCancelBatch)
}
