package botpool

import (
	"testing"

	"tcc-investimentos/engine/internal/domain/bot"
)

func TestUserID_IndexOf(t *testing.T) {
	for _, i := range []int{0, 1, 18, 19, 149} {
		got, ok := IndexOf(UserID(i))
		if !ok || got != i {
			t.Errorf("IndexOf(UserID(%d)) = %d, %v", i, got, ok)
		}
	}
	for _, id := range []string{"", "abc", "00000000-0000-0000-0001-000000000002", "00000000-0000-0000-0000-000000000001"} {
		if _, ok := IndexOf(id); ok {
			t.Errorf("IndexOf(%q) devia recusar", id)
		}
	}
	if UserID(0) != "00000000-0000-0000-0000-000000000002" {
		t.Errorf("UserID(0) = %s, o id do seed real mudou", UserID(0))
	}
}

// Crescer o pool nunca altera um bot que já existe e mantém todos os arquétipos.
func TestPersonalities_CrescerNaoAlteraOsExistentes(t *testing.T) {
	small, err := Personalities(LegacyPoolSize)
	if err != nil {
		t.Fatal(err)
	}
	large, err := Personalities(60)
	if err != nil {
		t.Fatal(err)
	}
	if len(small) != LegacyPoolSize || len(large) != 60 {
		t.Fatalf("tamanhos = %d e %d", len(small), len(large))
	}
	for i := range small {
		if small[i].Archetype != large[i].Archetype {
			t.Errorf("bot %d mudou de arquétipo ao crescer o pool", i)
		}
		if (small[i].KnowledgeLevel == nil) != (large[i].KnowledgeLevel == nil) ||
			(small[i].KnowledgeLevel != nil && *small[i].KnowledgeLevel != *large[i].KnowledgeLevel) {
			t.Errorf("bot %d mudou de nível de conhecimento ao crescer o pool", i)
		}
	}
	counts := map[bot.Archetype]int{}
	for _, p := range large {
		counts[p.Archetype]++
	}
	if len(counts) != 3 {
		t.Errorf("arquétipos = %v, queria os 3 direcionais", counts)
	}
}
