# `announcements` — comunicados globais (Fase N, tarefa N.20)

Módulo: `backend/src/modules/announcements/`. Tabela `announcements` (migration `0023`). A criação, edição e encerramento são do painel (`.docs/backend/admin.md`, "Comunicados e modo de manutenção"); este arquivo documenta só a leitura que o app do usuário faz pra desenhar a faixa no topo (e o WebView do app mobile, que carrega o mesmo frontend, herda a faixa sem código nativo).

---

### `GET /announcements`

- **Autenticação:** Bearer token (qualquer usuário autenticado).
- **Payload:** nenhum.
- **Sucesso:** `200` → `{ announcements: [{ id, title, body, severity ('info' | 'warning' | 'critical'), kind ('notice' | 'maintenance'), dismissible, starts_at, ends_at | null }] }`. Só os que estão **no ar agora** (`starts_at <= agora` e fim ausente ou posterior a agora; no instante do fim já saiu), o mais grave primeiro e, empatando, o mais recente. Comunicado agendado ou terminado nunca aparece. Não devolve `created_by`, `linked_halt_id` nem o histórico.
- **Erros:** `401` — token ausente ou inválido/expirado.
- **Regra:** `ListActiveAnnouncementsUseCase`. O texto é **puro** (o painel recusa `<` e `>` na criação) e o frontend o renderiza como texto, nunca como HTML. "Dispensar" é do cliente: `dismissible: true` pode ser fechado e não volta na mesma sessão do navegador (guardado por id em `sessionStorage`); o servidor não guarda dispensa. O aviso de manutenção vem sempre `severity: critical`, `dismissible: false`.
