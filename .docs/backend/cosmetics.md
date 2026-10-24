# Módulo `cosmetics` (identidade visível)

Backlog: `.claude/backlog-monetizacao.md` (MO.5.1). Moldura de avatar e título, livres para todas as contas desde que o plano PRO saiu do produto (2026-10-24), **visíveis para os outros** no ranking, no feed social, na busca e lista de amigos e no perfil público. Cosmético nunca muda a ordem de um ranking nem expõe patrimônio (RNF09). Tabelas: `cosmetic_items` (catálogo como dado, inserido pela migração `0037`) e `user_cosmetics` (escolha da pessoa, uma linha por tipo).

**Catálogo:** 6 molduras (`frame_aurora`, `frame_oceano`, `frame_crepusculo`, `frame_ametista`, `frame_coral`, `frame_grafite`) e 11 títulos: 8 livres para todos (`title_paciente`, `title_curioso`, `title_diversificador`, `title_leitor`, `title_dividendos`, `title_longo_prazo`, `title_estrategista`, `title_sangue_frio`) e 3 **liberados por indicações válidas** (MO.7.2, coluna `unlock_referrals`: `title_mensageiro` 5, `title_embaixador` 20, `title_patrono` 50; ver `referrals.md`). Títulos descrevem postura, nunca prometem ganho. O visual da moldura vive no frontend, pela chave.

**Forma pública (`cosmetics` nas outras rotas):** `{ frame: string | null, title: string | null }`. `frame` é a chave da moldura, `title` já é o texto. Sem escolha, `{ frame: null, title: null }`. Item desativado no catálogo deixa de aparecer.

### `GET /me/cosmetics`

- **Autenticação:** Bearer token
- **Sucesso:** `200` `{ referralCount, catalog: [{ key, kind, name, description, sortOrder, unlockReferrals }], selection: { frame, title }, display }`. `selection` é a escolha guardada; `display` é como os outros veem a pessoa agora.
- **Erros:** `401` token ausente ou inválido

### `PUT /me/cosmetics`

- **Autenticação:** Bearer token
- **Payload:** `{ kind: 'frame' | 'title', itemKey: string }` (Zod)
- **Sucesso:** `200`, mesmo corpo do `GET`. Um item por tipo: equipar outro troca o anterior.
- **Erros:** `400` corpo inválido; `401`; `403 { error: 'item ainda bloqueado' }` quando o item tem `unlockReferrals` maior que o `referralCount` da pessoa; `404` item inexistente, desativado ou de outro tipo
- **Regra:** `EquipCosmeticUseCase` só confere o item no catálogo e o desbloqueio por indicação.

### `DELETE /me/cosmetics?kind=frame|title`

- **Autenticação:** Bearer token
- **Sucesso:** `200`, mesmo corpo do `GET`
- **Erros:** `400` `kind` inválido; `401`
