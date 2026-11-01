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

`lib.py` confirma o e-mail das contas criadas direto no banco da stack (o cadastro só entra com
e-mail verificado, EM.3.1) e completa as lições pelo mesmo caminho do jogador: responde as
perguntas intermediárias com o gabarito lido de `lessons.blocks` (todos os formatos), resolve a
micro-decisão e avança os passos respeitando o `step_too_fast`. Os nomes de `neg.py` levam um
sufixo por execução, então ele pode rodar de novo na mesma stack.
