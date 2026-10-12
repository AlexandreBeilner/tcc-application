# Módulo `cosmetics` (identidade visível do PRO)

Backlog: `.claude/backlog-monetizacao.md` (MO.5.1). Selo PRO, moldura de avatar e título, **visíveis para os outros** no ranking, no feed social, na busca e lista de amigos e no perfil público. Cosmético nunca muda a ordem de um ranking nem expõe patrimônio (RNF09). Tabelas: `cosmetic_items` (catálogo como dado, inserido pela migração `0037`) e `user_cosmetics` (escolha da pessoa, uma linha por tipo).

**Catálogo:** 6 molduras (`frame_aurora`, `frame_oceano`, `frame_crepusculo`, `frame_ametista`, `frame_coral`, `frame_grafite`) e 11 títulos: 8 livres para todo PRO (`title_paciente`, `title_curioso`, `title_diversificador`, `title_leitor`, `title_dividendos`, `title_longo_prazo`, `title_estrategista`, `title_sangue_frio`) e 3 **liberados por indicações válidas** (MO.7.2, coluna `unlock_referrals`: `title_mensageiro` 5, `title_embaixador` 20, `title_patrono` 50; ver `referrals.md`). Títulos descrevem postura, nunca prometem ganho. O visual da moldura vive no frontend, pela chave. O **selo PRO** não é item: aparece automaticamente para quem é PRO.

**Forma pública (`cosmetics` nas outras rotas):** `{ isPro: boolean, frame: string | null, title: string | null }`. `frame` é a chave da moldura, `title` já é o texto. Quem não é PRO agora sempre vem `{ isPro: false, frame: null, title: null }`, mesmo com escolha guardada.

**Arquivamento:** cancelar o PRO não apaga nada. A leitura pública só mostra a escolha de quem é PRO neste instante (decisão tomada a cada leitura, em lote, a partir da assinatura), então cancelar "desequipa" para os outros e reativar restaura sem nenhuma escrita.

### `GET /me/cosmetics`

- **Autenticação:** Bearer token (não exige PRO)
- **Sucesso:** `200` `{ isPro, referralCount, catalog: [{ key, kind, name, description, sortOrder, unlockReferrals }], selection: { frame, title }, display }`. `selection` é a escolha guardada (mesmo para quem cancelou); `display` é como os outros veem a pessoa agora.
- **Erros:** `401` token ausente ou inválido

### `PUT /me/cosmetics`

- **Autenticação:** Bearer token + plano PRO
- **Payload:** `{ kind: 'frame' | 'title', itemKey: string }` (Zod)
- **Sucesso:** `200`, mesmo corpo do `GET`. Um item por tipo: equipar outro troca o anterior.
- **Erros:** `400` corpo inválido; `401`; `403 { error: 'requer plano PRO' }` sem plano ativo; `403 { error: 'item ainda bloqueado' }` quando o item tem `unlockReferrals` maior que o `referralCount` da pessoa; `404` item inexistente, desativado ou de outro tipo
- **Regra:** `EquipCosmeticUseCase` chama `ProAccessGuard.assertPro`, nunca claim de JWT.

### `DELETE /me/cosmetics?kind=frame|title`

- **Autenticação:** Bearer token (não exige PRO: a pessoa sempre pode tirar o que mostra)
- **Sucesso:** `200`, mesmo corpo do `GET`
- **Erros:** `400` `kind` inválido; `401`
