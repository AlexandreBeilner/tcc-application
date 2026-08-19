// Package domain contém as regras de negócio do motor de simulação —
// precificação de renda fixa/variável, event sourcing, curvas de juros —
// isoladas de qualquer detalhe de infraestrutura (HTTP, banco, etc).
//
// Nenhum tipo aqui deve importar net/http, database/sql, ou pacotes de
// internal/infra. A dependência é sempre infra -> domain, nunca o contrário.
package domain
