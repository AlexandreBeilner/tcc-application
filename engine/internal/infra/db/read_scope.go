package db

import (
	"context"
	"sync"
)

// readScope é o cache de leitura de um tick (tarefa Q.1): guarda o que não muda
// enquanto o tick roda (dados estáticos de um ativo e o dia simulado corrente)
// para as centenas de LoadContext das rodadas de bot não relerem a mesma coisa.
// Vive só no context.Context devolvido por WithReadScope, então nunca vaza para
// outro tick nem para uma requisição HTTP de usuário, que não passa por aqui e
// continua lendo direto do banco.
type readScope struct {
	mu     sync.Mutex
	assets map[string]assetStatic
	dayVal *int
}

type readScopeKey struct{}

// WithReadScope devolve um contexto com um cache de leitura novo, para a
// duração de um tick. Implementa tick.OrderContextLoader.
func (r *OrderExecutionRepository) WithReadScope(ctx context.Context) context.Context {
	return context.WithValue(ctx, readScopeKey{}, &readScope{assets: make(map[string]assetStatic)})
}

func scopeFrom(ctx context.Context) *readScope {
	scope, _ := ctx.Value(readScopeKey{}).(*readScope)
	return scope
}

// asset devolve os dados estáticos de assetID, carregando-os uma vez. Sem
// escopo (receiver nil) sempre carrega. Erro nunca é cacheado.
func (s *readScope) asset(assetID string, load func() (assetStatic, error)) (assetStatic, error) {
	if s == nil {
		return load()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if st, ok := s.assets[assetID]; ok {
		return st, nil
	}
	st, err := load()
	if err != nil {
		return assetStatic{}, err
	}
	s.assets[assetID] = st
	return st, nil
}

// day devolve o dia simulado corrente, carregando-o uma vez. Sem escopo, sempre
// carrega. Erro nunca é cacheado.
func (s *readScope) day(load func() (int, error)) (int, error) {
	if s == nil {
		return load()
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.dayVal != nil {
		return *s.dayVal, nil
	}
	day, err := load()
	if err != nil {
		return 0, err
	}
	s.dayVal = &day
	return day, nil
}

// forget descarta os dados em cache de assetID, para a próxima leitura ir ao banco.
// Usado quando algo que o cache guarda muda no meio do tick: o float (outstanding_shares)
// de um ETF muda a cada criação ou resgate de cotas (tarefa R.6). Sem escopo (receiver
// nil), não faz nada.
func (s *readScope) forget(assetID string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.assets, assetID)
}
