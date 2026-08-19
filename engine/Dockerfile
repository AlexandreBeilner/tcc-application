FROM golang:1.22-alpine AS builder
WORKDIR /app
COPY go.mod go.sum* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /out/engine ./cmd/api

FROM alpine:3.19
RUN adduser -D -g '' appuser
COPY --from=builder /out/engine /usr/local/bin/engine
USER appuser
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/engine"]
