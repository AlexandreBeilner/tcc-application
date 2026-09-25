package bot

import "math"

// Tamanho do pool de bots direcionais (Ruído, Chartista e Fundamentalista),
// tarefa Q.2 (achado 014 de pontos-em-aberto-decisao-produto.md). O volume de um
// ativo é proporcional aos turnos de bot que ele recebe por dia, e cada bot
// negocia 1 ativo por rodada, então um pool fixo esvazia o volume por ativo
// quando o catálogo cresce. Todos os valores são ilustrativos, a validar no
// benchmark da tarefa Q.4.
const (
	// MinPoolSize é o pool mínimo: a faixa de 15 a 25 bots da proposta 2.3.2, que
	// também garante que todo setor e classe de ativo tenha os 3 arquétipos.
	MinPoolSize = 19
	// BotsPerAsset é quantos bots direcionais o catálogo ganha por ativo. Com 1 a
	// 4 rodadas por dia (média de 2,5), 2 bots por ativo rendem cerca de 5 turnos
	// por ativo por dia, o que leva o volume perto do piso da faixa de 0,3% do
	// float (cerca de 0,05% a 0,07% do float por turno, medido na P.8).
	BotsPerAsset = 2.0
	// MaxPoolSize é o teto de custo: com ~9 comandos SQL por turno (depois da Q.1)
	// e ~2,5 rodadas, 150 bots gastam cerca de 3.400 comandos por tick, dentro
	// do teto de 5.000 do orçamento (seção 6.1 da proposta de cobertura) junto do
	// custo fixo e do Market Maker. Acima disso o volume por ativo cai de novo:
	// é a cauda longa aceita pelo autor.
	MaxPoolSize = 150
)

// PoolSize devolve quantos bots direcionais um catálogo de assetCount ativos
// negociáveis precisa: BotsPerAsset por ativo, entre MinPoolSize e MaxPoolSize.
// Função pura e monotônica, reaproveitável pelo painel de bots (Fase N).
func PoolSize(assetCount int) int {
	size := int(math.Ceil(BotsPerAsset * float64(assetCount)))
	if size < MinPoolSize {
		return MinPoolSize
	}
	if size > MaxPoolSize {
		return MaxPoolSize
	}
	return size
}
