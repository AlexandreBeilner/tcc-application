package coverage

import (
	"context"
	"fmt"

	"tcc-investimentos/engine/internal/domain/bot"
)

// firstMarketMakerID é o ID do primeiro Market Maker, o mesmo do Market
// Maker único que o seed criava antes da cobertura (compatível com bancos
// existentes).
const firstMarketMakerID = "00000000-0000-0000-0000-000000000001"

// NewMarketMakerID devolve o ID determinístico do Market Maker de índice
// existingCount (quantos já existem). Determinístico e não aleatório porque o
// ID entra na semente das rodadas do bot (RNF08): dois bancos semeados do
// mesmo jeito precisam produzir o mesmo mercado.
func NewMarketMakerID(existingCount int) string {
	if existingCount == 0 {
		return firstMarketMakerID
	}
	return fmt.Sprintf("00000000-0000-0000-0001-%012d", existingCount+1)
}

// Input descreve o ativo a cobrir e o tamanho do provisionamento.
type Input struct {
	AssetID string
	// OutstandingShares é o float total do ativo (teto validado ao gravar).
	OutstandingShares int64
	// MarketMakerShares é a fatia do grupo Market Maker no float dos bots
	// (bot.Allocation.MarketMaker).
	MarketMakerShares int64
	// Price é o preço de referência da posição inicial.
	Price float64
}

// Ensurer provisiona a cobertura de ativos (EnsureCoverage).
type Ensurer struct {
	lister      MarketMakerLister
	provisioner Provisioner
}

func NewEnsurer(lister MarketMakerLister, provisioner Provisioner) *Ensurer {
	return &Ensurer{lister: lister, provisioner: provisioner}
}

// Result diz o que EnsureCoverage fez.
type Result struct {
	// MarketMakerID é quem cobre o ativo (já existente ou recém-atribuído).
	MarketMakerID string
	// Provisioned é false quando o ativo já tinha cobertura (nada foi feito).
	Provisioned bool
	// CreatedMarketMaker é true quando nenhum Market Maker tinha folga e um
	// novo foi criado.
	CreatedMarketMaker bool
}

// EnsureCoverage garante que o ativo tem um Market Maker cobrindo: idempotente.
//
//  1. Se algum Market Maker já cobre o ativo, não faz nada. Vale também para
//     um Market Maker inativo: reatribuir cobertura é ação do painel de bots
//     (Fase N, proposta seção 3.9), e provisionar outro float por cima de um
//     ativo já distribuído estouraria o teto.
//  2. Senão escolhe o Market Maker por Assign; sem folga em nenhum, cria um.
//  3. Grava cobertura, posição e caixa (2x o valor da posição,
//     bot.InitialCash) numa transação.
func (e *Ensurer) EnsureCoverage(ctx context.Context, in Input) (Result, error) {
	marketMakers, err := e.lister.ListMarketMakers(ctx)
	if err != nil {
		return Result{}, fmt.Errorf("listar Market Makers: %w", err)
	}
	for _, mm := range marketMakers {
		if mm.covers(in.AssetID) {
			return Result{MarketMakerID: mm.AccountID}, nil
		}
	}

	result := Result{Provisioned: true}
	accountID, ok := Assign(in.AssetID, marketMakers)
	if !ok {
		accountID = NewMarketMakerID(len(marketMakers))
		personality, err := bot.DefaultMarketMakerPersonality()
		if err != nil {
			return Result{}, fmt.Errorf("personalidade padrão de Market Maker: %w", err)
		}
		if err := e.provisioner.CreateMarketMaker(ctx, accountID, personality); err != nil {
			return Result{}, fmt.Errorf("criar Market Maker %s: %w", accountID, err)
		}
		result.CreatedMarketMaker = true
	}
	result.MarketMakerID = accountID

	err = e.provisioner.ProvisionCoverage(ctx, Provision{
		AssetID:           in.AssetID,
		MMAccountID:       accountID,
		Shares:            in.MarketMakerShares,
		Price:             in.Price,
		Cash:              bot.InitialCash(float64(in.MarketMakerShares)*in.Price, 0, true),
		OutstandingShares: in.OutstandingShares,
	})
	if err != nil {
		return Result{}, fmt.Errorf("provisionar cobertura do ativo %s: %w", in.AssetID, err)
	}
	return result, nil
}
