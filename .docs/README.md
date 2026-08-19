# `.docs/` — documentação de endpoints

Documentação de referência rápida de cada endpoint HTTP exposto pelo backend gamificado (`backend/`) e pelo motor de simulação (`engine/`). Não confundir com `.claude/` (decisões de produto/arquitetura) — aqui é só "o que a API faz, na prática", pra quem está integrando ou revisando sem precisar ler o código.

- `.docs/backend/` — endpoints do backend Node/TS. Um arquivo por módulo (`modules/<nome>/`), nomeado igual ao módulo.
- `.docs/engine/` — endpoints do motor Go. Ainda quase vazio (só `/health`) — vai crescer a partir da Semana 2 (motor de renda fixa).

## Regra: toda rota nova é documentada no mesmo commit/sessão que a cria

Mesma lógica do checklist de arquitetura em `CLAUDE.md` — não é um passo separado "documentar depois". Ao criar ou alterar uma rota, atualize o arquivo do módulo correspondente (ou crie um novo se for o primeiro endpoint do módulo).

## Template por endpoint

```md
### `MÉTODO /caminho`

- **Autenticação:** público | Bearer token | Bearer token + role `admin`
- **Payload:** corpo/query, campo a campo, com as regras de validação (schema Zod no backend)
- **Sucesso:** status + formato da resposta
- **Erros:** status → condição, um por linha
- **Regra:** o que o caso de uso faz, em 1–3 frases — não repetir o código, explicar a decisão de negócio
```
