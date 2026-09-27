package db

import (
	"context"
	"os"
	"testing"
	"time"
)

// Teste de integração da trava consultiva do tick (tarefa S.3) contra um
// Postgres real: duas instâncias do motor são dois pools de conexão
// independentes. Roda só com TEST_DATABASE_URL apontando pra um banco `market`
// com as migrations aplicadas (ex.: o Postgres do compose de teste); sem ela,
// é pulado.
func openTwoInstances(t *testing.T) (*TickRepository, *TickRepository) {
	t.Helper()
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("TEST_DATABASE_URL não definida: teste de integração da trava do tick pulado")
	}
	a, err := Open(url)
	if err != nil {
		t.Fatal(err)
	}
	b, err := Open(url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = a.Close(); _ = b.Close() })
	return NewTickRepository(a, nil), NewTickRepository(b, nil)
}

func TestTickLock_DuasInstanciasNuncaTemATravaAoMesmoTempo(t *testing.T) {
	instA, instB := openTwoInstances(t)
	ctx := context.Background()

	releaseA, ok, err := instA.TryLockTick(ctx)
	if err != nil || !ok {
		t.Fatalf("instância A não pegou a trava: ok=%v err=%v", ok, err)
	}

	if _, ok, err := instB.TryLockTick(ctx); err != nil || ok {
		t.Fatalf("instância B pegou a trava com A segurando: ok=%v err=%v", ok, err)
	}
	// Nem a própria instância A consegue pegar de novo (outra conexão do pool).
	if _, ok, err := instA.TryLockTick(ctx); err != nil || ok {
		t.Fatalf("segunda tentativa da instância A pegou a trava já ocupada: ok=%v err=%v", ok, err)
	}

	releaseA()

	releaseB, ok, err := instB.TryLockTick(ctx)
	if err != nil || !ok {
		t.Fatalf("instância B não pegou a trava depois da liberação: ok=%v err=%v", ok, err)
	}
	releaseB()
}

// Disputa real: N goroutines em 2 instâncias tentam a trava ao mesmo tempo;
// exatamente uma vence a cada rodada.
func TestTickLock_DisputaConcorrenteTemUmSoVencedor(t *testing.T) {
	instA, instB := openTwoInstances(t)
	ctx := context.Background()

	const contenders = 8
	winners := make(chan func(), contenders)
	start := make(chan struct{})
	done := make(chan struct{}, contenders)
	for i := 0; i < contenders; i++ {
		repo := instA
		if i%2 == 1 {
			repo = instB
		}
		go func() {
			<-start
			if release, ok, err := repo.TryLockTick(ctx); err == nil && ok {
				winners <- release
			}
			done <- struct{}{}
		}()
	}
	close(start)
	for i := 0; i < contenders; i++ {
		select {
		case <-done:
		case <-time.After(10 * time.Second):
			t.Fatal("timeout esperando a disputa da trava")
		}
	}
	if len(winners) != 1 {
		t.Fatalf("vencedores = %d, want exatamente 1", len(winners))
	}
	(<-winners)()
}

// Processo dono da trava que cai sem liberar: o Postgres derruba a sessão e a
// trava de sessão some sozinha (simulado terminando o backend do dono).
func TestTickLock_LiberadaQuandoAConexaoCai(t *testing.T) {
	instA, instB := openTwoInstances(t)
	ctx := context.Background()

	if _, ok, err := instA.TryLockTick(ctx); err != nil || !ok {
		t.Fatalf("não pegou a trava: ok=%v err=%v", ok, err)
	}
	if _, ok, _ := instB.TryLockTick(ctx); ok {
		t.Fatal("B pegou a trava com A segurando")
	}

	if _, err := instB.db.ExecContext(ctx,
		`SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND objid = $1 AND granted`,
		tickAdvisoryLockKey,
	); err != nil {
		t.Fatal(err)
	}

	deadline := time.Now().Add(5 * time.Second)
	for {
		release, ok, err := instB.TryLockTick(ctx)
		if err == nil && ok {
			release()
			return
		}
		if time.Now().After(deadline) {
			t.Fatal("a trava não foi liberada depois que a sessão dona caiu")
		}
		time.Sleep(100 * time.Millisecond)
	}
}
