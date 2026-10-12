package httpserver

import (
	"context"
	"net"
	"net/http"
	"testing"
	"time"
)

func freeAddr(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	_ = l.Close()
	return addr
}

func TestServeDrainsInFlightRequestOnCancel(t *testing.T) {
	addr := freeAddr(t)
	started := make(chan struct{})
	release := make(chan struct{})
	mux := http.NewServeMux()
	mux.HandleFunc("/slow", func(w http.ResponseWriter, _ *http.Request) {
		close(started)
		<-release
		_, _ = w.Write([]byte("ok"))
	})
	srv := &http.Server{Addr: addr, Handler: mux}

	ctx, cancel := context.WithCancel(context.Background())
	served := make(chan error, 1)
	go func() { served <- Serve(ctx, srv, 3*time.Second) }()

	var body string
	reqDone := make(chan error, 1)
	go func() {
		var resp *http.Response
		var err error
		for i := 0; i < 50; i++ { // espera o listener subir
			resp, err = http.Get("http://" + addr + "/slow")
			if err == nil {
				break
			}
			time.Sleep(20 * time.Millisecond)
		}
		if err != nil {
			reqDone <- err
			return
		}
		defer func() { _ = resp.Body.Close() }()
		buf := make([]byte, 2)
		n, _ := resp.Body.Read(buf)
		body = string(buf[:n])
		reqDone <- nil
	}()

	<-started
	cancel()
	select {
	case err := <-served:
		t.Fatalf("Serve devolveu antes da requisição terminar: %v", err)
	case <-time.After(150 * time.Millisecond):
	}
	close(release)

	if err := <-reqDone; err != nil {
		t.Fatalf("requisição em andamento falhou: %v", err)
	}
	if body != "ok" {
		t.Fatalf("corpo = %q, quer %q", body, "ok")
	}
	if err := <-served; err != nil {
		t.Fatalf("Serve = %v, quer nil num encerramento limpo", err)
	}
}

func TestServeReturnsShutdownErrorWhenRequestOutlivesTimeout(t *testing.T) {
	addr := freeAddr(t)
	started := make(chan struct{})
	mux := http.NewServeMux()
	mux.HandleFunc("/hang", func(_ http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
	})
	srv := &http.Server{Addr: addr, Handler: mux}

	ctx, cancel := context.WithCancel(context.Background())
	served := make(chan error, 1)
	go func() { served <- Serve(ctx, srv, 100*time.Millisecond) }()
	go func() {
		for i := 0; i < 50; i++ {
			if resp, err := http.Get("http://" + addr + "/hang"); err == nil {
				_ = resp.Body.Close()
				return
			}
			time.Sleep(20 * time.Millisecond)
		}
	}()

	<-started
	cancel()
	if err := <-served; err == nil {
		t.Fatal("Serve = nil, quer o erro de Shutdown quando a requisição passa do prazo")
	}
}

func TestServeReturnsListenError(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = l.Close() }()
	srv := &http.Server{Addr: l.Addr().String(), Handler: http.NewServeMux()}
	if err := Serve(context.Background(), srv, time.Second); err == nil {
		t.Fatal("Serve = nil numa porta ocupada, quer o erro do ListenAndServe")
	}
}
