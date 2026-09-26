# Validação ponta a ponta do mercado simulado

Stack isolada (projeto Compose `tccsim`, gateway em `localhost:8100`, Postgres em `5544`), sem tocar no ambiente de desenvolvimento.
Rodar da raiz do repositório:

    docker compose -f engine/scripts/e2e-mercado-simulado/compose.e2e.yml up -d --build
    # seed do mercado (com catálogo sintético) e do backend: ver relatório em tmp/relatorio-e2e-mercado-simulado.md
    cd engine/scripts/e2e-mercado-simulado
    CROWD=25 python3 sim.py 60 1   # 60 dias, usuários de várias personas + bots
    python3 neg.py                 # caminhos de erro, segurança, concorrência
    python3 gating.py              # gate de produtos pela trilha, lição a lição
    python3 liq.py a               # profundidade/slippage por ativo
