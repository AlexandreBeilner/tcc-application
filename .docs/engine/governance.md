# Governança corporativa (`internal/domain/corporategovernance`)

Lado do motor da **Assembleia de Acionistas** (MO.6.2). O backend (módulo `assemblies`) é dono do ciclo da assembleia, dos votos e da apuração; o motor é dono das **posições** e dos **fundamentos**, então só faz três coisas: tira o snapshot de posições na data de corte, registra a decisão aprovada como evento imutável e aplica o efeito aos poucos. Rotas internas (só o backend as chama, mesmo trust boundary de `POST /admin/tick`); sem `httpserver.WithGovernance` respondem `503`.

Ids de assembleia e de empresa são UUIDs (`400` se não forem).

### `GET /governance/reports`

- **Autenticação:** interna (rede do Compose, via backend)
- **Payload:** query `min_days` e `max_days` (inteiros, `0 <= min_days <= max_days <= 400`).
- **Sucesso:** `200` → `{ simulated_day, reports: [{ company_id, name, sector, tickers, report_day, days_since_report }] }`: o **último balanço já divulgado** de cada empresa com ação negociável no Mercado Ao Vivo, só quando ele saiu entre `min_days` e `max_days` dias antes do dia corrente. `tickers` vêm com a ON antes da PN. Ordem estável por nome.
- **Erros:** `400` parâmetros ausentes, não inteiros ou janela inválida · `503` serviço desligado
- **Regra:** é o gatilho de abertura das assembleias (MO.6.3). O calendário (`GET /market/calendar`) só mostra um `report` global, sem empresa; o dia real de cada balanço depende do atraso próprio (`report_offset_days`) e do dia de corte do escalonamento, então sai de `paymentschedule.DaysSinceReport`. O backend pede "balanço de 2 a 9 dias atrás" (atraso de abertura até o limite de recuperação depois de uma parada) e a idempotência da abertura é dele (`dedupe_key` por empresa e dia de balanço). Empresa só com ativo sandbox fica de fora; antes do primeiro balanço, ou no dia 0, devolve lista vazia.

### `POST /governance/snapshots`

- **Autenticação:** interna (rede do Compose, via backend)
- **Payload:** `{ "assembly_id": uuid, "company_id": uuid }`
- **Sucesso:** `201` na primeira chamada, `200` nas repetições (mesma foto). Corpo: `{ assembly_id, company_id, taken_at, simulated_day, holdings: [{ user_id, quantity }] }`.
- **Erros:** `400` corpo ou UUID inválido · `404` empresa inexistente · `503` serviço desligado
- **Regra:** foto das posições da empresa **no instante da primeira chamada** (o backend chama na abertura da assembleia). Só contas de usuário (`is_bot` fora), ações somadas entre classes (ON e PN), só quantidade positiva. **Idempotente pelo id da assembleia**: vender ou comprar depois do corte não muda a foto, e uma empresa sem acionista de usuário gera um snapshot vazio que também é devolvido igual nas repetições.

### `GET /governance/snapshots/{assembly_id}`

- **Sucesso:** `200` com o mesmo corpo acima. **Erros:** `400` id inválido · `404` sem snapshot.

### `POST /governance/decisions`

- **Autenticação:** interna
- **Payload:** `{ "assembly_id": uuid, "company_id": uuid, "option_key": string, "effect": { "metric": "base_growth_pct" | "quality_multiplier", "direction": 1 | -1, "intensity": (0, 1] } }`. O efeito vem do catálogo de pautas do backend e **nunca traz valor absoluto**: o tamanho máximo da mudança é do motor.
- **Sucesso:** `201` na primeira chamada, `200` nas repetições (devolve a decisão original, **sem novo evento nem novo efeito**). Corpo: `{ assembly_id, company_id, option_key, effect, status, total_delta, ramp_ticks, start_day, applied_ticks, applied_delta, decided_at }`. `total_delta` e `applied_delta` em **centésimos** com sinal (no crescimento, 50 = +0,50 p.p.; no multiplicador de qualidade, 5 = +0,05).
- **Erros:** `400` corpo/UUID/efeito inválido (métrica desconhecida, direção fora de ±1, intensidade fora de (0, 1], opção vazia) · `404` empresa inexistente · `503` serviço desligado
- **Regra:** numa transação travada pela assembleia e pela empresa: (1) planeja com o estado real da empresa, (2) **grava o evento `assembly_decision` em `market_events` primeiro** (conta técnica de governança, `reference_id` = id da assembleia, `quantity` = mudança total em centésimos, `0` se não houve efeito), (3) grava a decisão. O efeito só acontece depois, nos ticks. Status possíveis: `scheduled` (rampa em andamento), `completed`, `skipped_cooldown` (a empresa mudou há menos de `governance_cooldown_days` dias simulados: fica registrado, nada muda) e `skipped_out_of_range` (o efeito levaria o fundamento para fora da faixa válida do cadastro).

### `GET /governance/decisions/{assembly_id}`

- **Sucesso:** `200` com o corpo acima (acompanha a rampa). **Erros:** `400` id inválido · `404` sem decisão.

### `GET /governance/companies/{company_id}/standing?user_id=`

- **Autenticação:** interna (rede do Compose, via backend)
- **Payload:** `company_id` (path) e `user_id` (query), ambos UUID.
- **Sucesso:** `200` → `{ company_id, name, sector, holds_shares, cooldown_days_left }`. `holds_shares` é a posição **de agora** da pessoa na empresa (conta de usuário, ON e PN somadas, quantidade positiva), não a foto de nenhum snapshot. `cooldown_days_left` são os dias simulados que faltam para a empresa poder mudar de novo (`0` = livre), calculados com `governance_cooldown_days` e o início do último efeito que valeu (`scheduled` ou `completed`; `skipped_*` não conta).
- **Erros:** `400` UUID inválido ou ausente · `404` empresa inexistente · `503` serviço desligado
- **Regra:** é o que o backend consulta antes de aceitar uma **proposta de pauta ou um apoio** (MO.6.5): só acionista de hoje propõe e apoia, e uma empresa em período de espera não recebe pauta nova na fila. Não devolve quantidade de ações nem dado de outra pessoa.

## O efeito

- **Só nos fundamentos, nunca no preço.** Mexe em um de dois botões que toda empresa já tem: `companies.base_growth_pct` (crescimento base, em pontos percentuais) ou `companies.quality_multiplier` (margem e alavancagem). O preço continua vindo da negociação dos bots reagindo aos fundamentos. Nenhuma cotação é escrita por esta rota ou pelo passo do tick.
- **Faixa máxima por decisão** (em centésimos): `governance_growth_step_centipp` (padrão 50 = 0,50 p.p.) e `governance_quality_step_centi` (padrão 5 = 0,05). A mudança total é `direction × faixa × intensity`, arredondada, e nunca passa da faixa.
- **Aplicação gradual:** linear em `governance_ramp_ticks` ticks (padrão 30), começando no tick seguinte à decisão (`start_day = dia corrente + 1`). Toda a conta é em centésimos inteiros, então a soma dos passos fecha **exatamente** no total, e recuperar ticks em lote depois de uma parada dá o mesmo resultado de um por vez. Determinístico (RNF08): nenhum sorteio.
- **Cooldown por empresa:** `governance_cooldown_days` dias simulados (padrão 90, "uma mudança por trimestre") entre o início de dois efeitos da mesma empresa; `0` desliga a trava.
- **Quem aplica:** `tick.Service` chama `ApplyDue(novoDia)` ANTES de ler as empresas do tick (opcional, `WithGovernance`). Cada passo é transacional com a mudança na empresa e idempotente (`applied_ticks` confere o estado anterior), então repetir um tick não aplica duas vezes. **Uma falha na governança é logada e nunca derruba o tick do mercado**; o passo é recuperado no seguinte. Se alguém editar a empresa no meio da rampa e o próximo passo sair da faixa válida, a decisão é encerrada como `skipped_out_of_range` e nada muda.

## Parâmetros (`enginesetting`)

Quatro chaves novas, editáveis em runtime pelo mesmo mecanismo do ritmo do Temporizador (`GET/PUT/DELETE /admin/settings`, ver `admin.md`): `governance_growth_step_centipp` (1 a 500), `governance_quality_step_centi` (1 a 50), `governance_ramp_ticks` (1 a 365) e `governance_cooldown_days` (0 a 720). O backend ainda **não** as repassa ao painel (a tela só conhece o ritmo); a MO.6.8 lhes dará tela.

## Tabelas (migration `000051`)

`governance_snapshot_runs` (uma por assembleia, mesmo vazia) e `governance_snapshot_holdings` (uma por usuário com posição); `governance_decisions` (uma por assembleia, `assembly_id` único, com o andamento da rampa); `market_events.reference_id` (uuid, id da assembleia) e o valor `assembly_decision` do enum `market_event_type`. A **conta técnica de governança** (`00000000-0000-4000-8000-00000000a550`, `is_bot`, inativa, sem linha em `users`) é criada na primeira decisão, não na migração, e não conta como bot de liquidez no painel nem entra em ranking ou social.

## Valores de lançamento aprovados (MO.6.9, 2026-10-11)

O autor aprovou como **padrão de lançamento** (não calibração final): degrau de crescimento 50 (0,50 p.p.), degrau de qualidade 5 (0,05), rampa de 30 ticks e cooldown de 90 dias simulados. Base: ensaio de 12 meses simulados com 84 empresas e 200 usuários (`tmp/relatorio-calibracao-assembleia.md`). Os valores já são os padrões do código (`DefaultGovernance*` em `enginesetting`) e agora há um teste com os números literais. Revisar com dado de eleitorado real.
