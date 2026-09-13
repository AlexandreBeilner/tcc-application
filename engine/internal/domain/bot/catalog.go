// Package bot — escopo de especialização + catálogo de bots (tarefa C.6):
// distribui um pool de bots entre arquétipos e atribui a cada um um
// subconjunto dos setores/classes de ativo que ele "entende" (proposta
// 2.3.2), garantindo que todo setor/classe tenha pelo menos um bot de cada
// arquétipo cobrindo-o — sem depender de nenhuma infraestrutura (o
// resultado é só a estrutura de atribuição; quem persiste/associa a contas
// concretas é o seed, `cmd/seed/main.go`, mesmo padrão de
// InitialAllocation/B.1 devolver posições posicionais que B.2 associa a
// contas).
package bot

import (
	"errors"

	"tcc-investimentos/engine/internal/domain/catalog"
)

var (
	// ErrNoArchetypesToAssign é devolvido quando archetypes está vazio —
	// não há nada pra distribuir os bots entre.
	ErrNoArchetypesToAssign = errors.New("nenhum arquétipo informado pra distribuir os bots")
	// ErrInsufficientBotsForArchetypes é devolvido quando botCount é menor
	// que len(archetypes) — cada arquétipo precisa de pelo menos 1 bot,
	// senão ele fica sem cobertura nenhuma.
	ErrInsufficientBotsForArchetypes = errors.New("quantidade de bots insuficiente pra cobrir todos os arquétipos pedidos (pelo menos 1 bot por arquétipo)")
	// ErrNoCoverageKeys é devolvido quando nem sectors nem assetClasses
	// têm nenhum elemento — não há nada a cobrir.
	ErrNoCoverageKeys = errors.New("nenhum setor nem classe de ativo informado pra cobrir")
)

// SpecializationAssignment é o escopo bruto (setores + classes de ativo,
// sem WithinScopePct — decisão de quem monta a Personality final, já que
// esse percentual não varia por bot nesta tarefa) atribuído a um bot do
// pool por AssignSpecializations — nunca vazio (Sectors e AssetClasses
// nunca ficam os dois vazios ao mesmo tempo).
type SpecializationAssignment struct {
	Archetype    Archetype
	Sectors      []catalog.Sector
	AssetClasses []catalog.AssetType
}

// coverageKey é a união opaca de "setor" ou "classe de ativo" usada
// internamente pra tratar as duas listas de entrada como uma única
// sequência de itens a cobrir, sem duplicar a lógica de chunking pra cada
// uma.
type coverageKey struct {
	sector     *catalog.Sector
	assetClass *catalog.AssetType
}

// AssignSpecializations distribui botCount bots entre archetypes (o mais
// igualmente possível) e, dentro de cada arquétipo, distribui os setores
// de sectors e as classes de assetClasses (tratados como uma sequência
// única de "chaves de cobertura") entre os bots daquele arquétipo — de
// forma que toda chave apareça no escopo de pelo menos um bot de cada
// arquétipo (proposta 2.3.2: "o catálogo de bots deve cobrir todos os
// setores... e as 3 classes... com sobreposição suficiente pra nenhum
// ativo ficar sem bot especializado"). Quando um arquétipo tem mais bots
// que chaves, o excedente repete chaves already atribuídas (round-robin) —
// nunca um bot fica com escopo vazio (violaria NewSpecializationScope,
// C.1). Quando tem menos bots que chaves, cada bot recebe um chunk
// contíguo de chaves (o mais equilibrado possível), garantindo que a união
// dos chunks cubra todas elas. 100% determinístico — mesma chamada sempre
// produz a mesma atribuição (não há nenhuma escolha arbitrária a sortear
// aqui, é só partição).
//
// Devolve um slice de tamanho botCount, agrupado por arquétipo na mesma
// ordem de archetypes (não embaralhado) — índice i corresponde ao i-ésimo
// bot do pool na ordem em que quem chama (o seed) os enumerar.
func AssignSpecializations(archetypes []Archetype, sectors []catalog.Sector, assetClasses []catalog.AssetType, botCount int) ([]SpecializationAssignment, error) {
	if len(archetypes) == 0 {
		return nil, ErrNoArchetypesToAssign
	}
	if botCount < len(archetypes) {
		return nil, ErrInsufficientBotsForArchetypes
	}
	keys := make([]coverageKey, 0, len(sectors)+len(assetClasses))
	for i := range sectors {
		keys = append(keys, coverageKey{sector: &sectors[i]})
	}
	for i := range assetClasses {
		keys = append(keys, coverageKey{assetClass: &assetClasses[i]})
	}
	if len(keys) == 0 {
		return nil, ErrNoCoverageKeys
	}

	botsPerArchetype := evenSplit(botCount, len(archetypes))

	assignments := make([]SpecializationAssignment, 0, botCount)
	for i, archetype := range archetypes {
		for _, chunk := range chunkKeysAcrossBots(keys, botsPerArchetype[i]) {
			assignment := SpecializationAssignment{Archetype: archetype}
			for _, k := range chunk {
				if k.sector != nil {
					assignment.Sectors = append(assignment.Sectors, *k.sector)
				} else {
					assignment.AssetClasses = append(assignment.AssetClasses, *k.assetClass)
				}
			}
			assignments = append(assignments, assignment)
		}
	}
	return assignments, nil
}

// evenSplit divide total em n partes o mais igualmente possível — as
// primeiras (total mod n) partes recebem um item a mais, mesmo método de
// rateio proporcional (sem resto perdido) já usado em
// largestRemainderAllocation (allocation.go), simplificado aqui porque
// todos os "pesos" são iguais (1 bot = 1 bot, não há fração a ponderar).
func evenSplit(total, n int) []int {
	base := total / n
	remainder := total % n
	parts := make([]int, n)
	for i := range parts {
		parts[i] = base
		if i < remainder {
			parts[i]++
		}
	}
	return parts
}

// chunkKeysAcrossBots devolve botCount chunks de keys: se botCount >=
// len(keys), os primeiros len(keys) bots recebem uma chave distinta cada e
// o restante repete a partir do início (round-robin) — nenhum bot fica sem
// chave. Se botCount < len(keys), keys é particionado em botCount grupos
// contíguos o mais equilibrados possível (evenSplit sobre o tamanho de
// cada grupo), cobrindo todas as chaves sem repetição.
func chunkKeysAcrossBots(keys []coverageKey, botCount int) [][]coverageKey {
	chunks := make([][]coverageKey, botCount)
	if botCount >= len(keys) {
		for i := 0; i < botCount; i++ {
			chunks[i] = []coverageKey{keys[i%len(keys)]}
		}
		return chunks
	}

	sizes := evenSplit(len(keys), botCount)
	idx := 0
	for i, size := range sizes {
		chunks[i] = keys[idx : idx+size]
		idx += size
	}
	return chunks
}
