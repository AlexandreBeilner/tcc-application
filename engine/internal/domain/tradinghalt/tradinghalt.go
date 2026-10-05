// Package tradinghalt é a pausa de negociação do painel admin (tarefa N.9): um
// "disjuntor" operacional, global ou de um ativo. Enquanto há pausa vigente, ordem
// nova de usuário e de bot naquele escopo é recusada; o tick segue rodando (dia,
// Selic, balanços e dividendos continuam) e as ordens já em repouso permanecem.
//
// Decisão do autor (2026-10-03, achado 029, item 2): a pausa NÃO suspende o tick, o
// relógio tem o próprio interruptor (N.6). Consequência aceita: ordens em repouso
// expiram a cada tick (regra Day) e os bots não recotam durante a pausa, então se ela
// atravessar um tick o book fica vazio ao retomar. Retomar não força uma rodada.
package tradinghalt

import (
	"context"
	"errors"
	"strings"
	"time"
)

// Scope diz o que a pausa barra.
type Scope string

const (
	// ScopeGlobal barra a negociação de todos os ativos.
	ScopeGlobal Scope = "global"
	// ScopeAsset barra a negociação de um ativo.
	ScopeAsset Scope = "asset"
)

// MaxReasonLength limita o motivo (texto livre do admin).
const MaxReasonLength = 200

var (
	ErrInvalidScope     = errors.New(`escopo deve ser "global" ou "asset"`)
	ErrAssetRequired    = errors.New("a pausa de um ativo exige asset_id")
	ErrAssetNotAllowed  = errors.New("a pausa global não leva asset_id")
	ErrReasonRequired   = errors.New("o motivo da pausa é obrigatório")
	ErrReasonTooLong    = errors.New("o motivo da pausa passa de 200 caracteres")
	ErrAlreadyHalted    = errors.New("já existe uma pausa vigente neste escopo")
	ErrHaltNotFound     = errors.New("pausa não encontrada")
	ErrAlreadyLifted    = errors.New("a pausa já foi encerrada")
	ErrAssetNotFound    = errors.New("ativo não encontrado")
	ErrAssetNotTradable = errors.New("o ativo não é negociável no book (sandbox ou renda fixa)")
)

// Halt é uma pausa, vigente (LiftedAt nil) ou encerrada.
type Halt struct {
	ID        string
	Scope     Scope
	AssetID   *string
	Ticker    *string
	Reason    string
	CreatedBy string
	CreatedAt time.Time
	LiftedAt  *time.Time
	LiftedBy  *string
}

// Active diz se a pausa ainda vale.
func (h Halt) Active() bool { return h.LiftedAt == nil }

// NewHalt valida os dados de uma pausa nova. O motivo é aparado.
func NewHalt(scope Scope, assetID, reason, createdBy string) (Halt, error) {
	reason = strings.TrimSpace(reason)
	switch {
	case scope != ScopeGlobal && scope != ScopeAsset:
		return Halt{}, ErrInvalidScope
	case scope == ScopeAsset && assetID == "":
		return Halt{}, ErrAssetRequired
	case scope == ScopeGlobal && assetID != "":
		return Halt{}, ErrAssetNotAllowed
	case reason == "":
		return Halt{}, ErrReasonRequired
	case len([]rune(reason)) > MaxReasonLength:
		return Halt{}, ErrReasonTooLong
	}
	halt := Halt{Scope: scope, Reason: reason, CreatedBy: createdBy}
	if scope == ScopeAsset {
		halt.AssetID = &assetID
	}
	return halt, nil
}

// Blocking devolve a pausa vigente que barra assetID, ou nil. Global e de ativo
// coexistem e a mais restritiva vence: a global, que cobre tudo, é a que vale
// quando as duas estão vigentes.
func Blocking(active []Halt, assetID string) *Halt {
	var assetHalt *Halt
	for i := range active {
		h := &active[i]
		if !h.Active() {
			continue
		}
		if h.Scope == ScopeGlobal {
			return h
		}
		if h.AssetID != nil && *h.AssetID == assetID {
			assetHalt = h
		}
	}
	return assetHalt
}

// Repository é o que o serviço precisa do banco, implementado por *db.TradingHaltRepository.
type Repository interface {
	// Insert grava a pausa nova. ErrAlreadyHalted se já há uma vigente no escopo,
	// ErrAssetNotFound/ErrAssetNotTradable se o ativo não serve.
	Insert(ctx context.Context, halt Halt) (Halt, error)
	// Lift encerra a pausa id. ErrHaltNotFound se não existe, ErrAlreadyLifted se já encerrada.
	Lift(ctx context.Context, id, liftedBy string) (Halt, error)
	// Active devolve as pausas vigentes.
	Active(ctx context.Context) ([]Halt, error)
	// Recent devolve as últimas pausas encerradas, mais recentes primeiro.
	Recent(ctx context.Context, limit int) ([]Halt, error)
}

// HistoryLimit é quantas pausas encerradas a tela do admin mostra.
const HistoryLimit = 30

// Service é o que o painel e a tela pública usam.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }

// Pause cria a pausa.
func (s *Service) Pause(ctx context.Context, scope Scope, assetID, reason, adminID string) (Halt, error) {
	halt, err := NewHalt(scope, assetID, reason, adminID)
	if err != nil {
		return Halt{}, err
	}
	return s.repo.Insert(ctx, halt)
}

// Lift encerra a pausa.
func (s *Service) Lift(ctx context.Context, id, adminID string) (Halt, error) {
	return s.repo.Lift(ctx, id, adminID)
}

// Listing é o que GET /admin/halts mostra: as vigentes e o histórico recente.
type Listing struct {
	Active []Halt
	Recent []Halt
}

// List devolve as pausas vigentes e as últimas encerradas.
func (s *Service) List(ctx context.Context) (Listing, error) {
	active, err := s.repo.Active(ctx)
	if err != nil {
		return Listing{}, err
	}
	recent, err := s.repo.Recent(ctx, HistoryLimit)
	if err != nil {
		return Listing{}, err
	}
	return Listing{Active: active, Recent: recent}, nil
}

// PublicStatus é o que o usuário comum pode saber: se há pausa global e em quais
// ativos. Nunca o motivo interno nem quem pausou.
type PublicStatus struct {
	Global   bool
	AssetIDs []string
}

// Status resume as pausas vigentes pra tela do usuário.
func (s *Service) Status(ctx context.Context) (PublicStatus, error) {
	active, err := s.repo.Active(ctx)
	if err != nil {
		return PublicStatus{}, err
	}
	status := PublicStatus{AssetIDs: []string{}}
	for _, h := range active {
		if h.Scope == ScopeGlobal {
			status.Global = true
		} else if h.AssetID != nil {
			status.AssetIDs = append(status.AssetIDs, *h.AssetID)
		}
	}
	return status, nil
}
