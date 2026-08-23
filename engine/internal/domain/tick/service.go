package tick

import (
	"context"

	"tcc-investimentos/engine/internal/domain/selic"
)

// Service executa um tick completo (ler estado → calcular próximo passo →
// persistir), tanto pro job diário automático quanto pro disparo manual via
// POST /admin/tick (tarefa 3.11) — os dois caminhos chamam Run, a única
// diferença é quem aciona.
type Service struct {
	repo     Repository
	selicCfg selic.Config
	seed     int64
}

// NewService monta o orquestrador do Temporizador. selicCfg.Initial é
// ignorado (Advance usa o estado persistido); os demais campos (Neutral,
// ReversionSpeed, Volatility) calibram a reversão à média da Selic
// simulada, mesma calibração de selic.DefaultConfig. seed é a seed base da
// simulação (RNF08) — fixa entre reinícios, configurada uma vez na
// composição (cmd/api/main.go).
func NewService(repo Repository, selicCfg selic.Config, seed int64) *Service {
	return &Service{repo: repo, selicCfg: selicCfg, seed: seed}
}

// Run lê o último estado persistido, calcula o próximo tick (Advance) e
// grava o resultado. Se o Temporizador nunca rodou (motor recém-subido,
// sem linha em market_calendar), começa do dia 0 com a Selic neutra de
// selicCfg como taxa inicial.
func (s *Service) Run(ctx context.Context) (Result, error) {
	current, found, err := s.repo.LoadState(ctx)
	if err != nil {
		return Result{}, err
	}
	if !found {
		current = State{Day: 0, SelicRate: s.selicCfg.Neutral}
	}

	assets, err := s.repo.ListPricingAssets(ctx)
	if err != nil {
		return Result{}, err
	}

	companies, err := s.repo.ListCompaniesForFundamentals(ctx)
	if err != nil {
		return Result{}, err
	}

	result := Advance(current, assets, companies, s.selicCfg, s.seed)

	if err := s.repo.SaveTick(ctx, result); err != nil {
		return Result{}, err
	}
	return result, nil
}
