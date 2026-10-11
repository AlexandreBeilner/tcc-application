FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/engine ./cmd/api
# Seed do catálogo de mercado (LW.3.14): o mesmo binário que o desenvolvimento roda com `go run`,
# para um servidor novo ser semeado só com comandos de dentro da imagem.
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/seed ./cmd/seed

FROM alpine:3.19
RUN adduser -D -g '' appuser
COPY --from=builder /out/engine /usr/local/bin/engine
COPY --from=builder /out/seed /usr/local/bin/seed
USER appuser
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/engine"]
