package db

import (
	"context"
	"testing"

	"tcc-investimentos/engine/internal/domain/enginesetting"
)

// Cobre os parâmetros editáveis (N.7) contra um Postgres real descartável (roda só com
// TEST_DATABASE_URL): gravar, trocar subindo a versão, apagar, e o Service por cima.
func TestEngineSettingsRepository_SalvaTrocaEApaga(t *testing.T) {
	_, conn := openAccountRepositoryOnScratchDB(t)
	ctx := context.Background()
	repo := NewEngineSettingsRepository(conn)

	var admin string
	if err := conn.QueryRowContext(ctx, `SELECT gen_random_uuid()::text`).Scan(&admin); err != nil {
		t.Fatal(err)
	}
	if got, err := repo.Overrides(ctx); err != nil || len(got) != 0 {
		t.Fatalf("Overrides vazio = %v, %v", got, err)
	}
	svc := enginesetting.NewService(repo, enginesetting.Values{TicksPerDay: 5, MaxCatchUp: 3})
	if err := svc.Set(ctx, enginesetting.TicksPerDay, 8, admin); err != nil {
		t.Fatal(err)
	}
	if err := svc.Set(ctx, enginesetting.TicksPerDay, 10, admin); err != nil {
		t.Fatal(err)
	}
	got, _ := repo.Overrides(ctx)
	o := got[enginesetting.TicksPerDay]
	if o.Value != 10 || o.Version != 2 || o.UpdatedBy != admin {
		t.Errorf("override = %+v, want valor 10, versão 2", o)
	}
	// Um novo Service (como depois de um restart do motor) enxerga o valor gravado.
	fresh := enginesetting.NewService(repo, enginesetting.Values{TicksPerDay: 5, MaxCatchUp: 3})
	if cur, _ := fresh.Current(ctx); cur.TicksPerDay != 10 {
		t.Errorf("depois do restart = %+v, want 10", cur)
	}
	if err := svc.Reset(ctx, enginesetting.TicksPerDay); err != nil {
		t.Fatal(err)
	}
	if got, _ := repo.Overrides(ctx); len(got) != 0 {
		t.Errorf("depois do Reset sobrou %v", got)
	}
}
