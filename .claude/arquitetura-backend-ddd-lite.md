# Arquitetura do backend — DDD lite

> Regras de arquitetura e desenvolvimento pro `backend/` (Node.js/TypeScript). Fechado em 2026-08-19, com o módulo `auth` (tarefa 1.4) como implementação de referência — **antes de criar um módulo novo, leia o `modules/auth` inteiro como exemplo vivo**, não só este documento.

## Por que DDD lite

Não é DDD "completo" (sem agregados, sem bounded context com cerimônia, sem `Result`/Either). É o essencial de DDD + arquitetura hexagonal que evita os problemas que motivaram esta regra: god classes, métodos gigantes, acoplamento forte entre regra de negócio e infraestrutura (Express, Drizzle, bcrypt, JWT, Google OAuth). Não adicionar camada/abstração além do que está documentado aqui — se a spec não pede, não crie.

## Estrutura por módulo

Cada funcionalidade de negócio (auth, lições, conquistas, missões, amizades, ranking...) vira um módulo em `backend/src/modules/<nome>/`, com até quatro camadas:

```
modules/<nome>/
  domain/            # entidades, tipos e erros de negócio — zero import de express/drizzle/bcrypt/jwt/etc
  application/
    ports/             # interfaces que a application define — fronteira de inversão de dependência
    services/           # funções auxiliares de domínio que dependem de uma port (ex: gerar username único)
    useCases/            # 1 classe por ação de negócio, injetada com ports via construtor
  infrastructure/      # adapters concretos que implementam as ports (Drizzle, bcrypt, jsonwebtoken, google-auth-library...)
  interfaces/http/      # Router do Express — valida entrada (Zod), chama caso de uso, traduz erro de domínio → status HTTP
  test/fakes/            # implementações fake das ports, usadas pelos testes de use case e de router
```

Nem todo módulo precisa das quatro camadas completas desde o início — `modules/admin` hoje só tem `interfaces/http` porque ainda não existe regra de negócio própria (isso chega em 4.4/6.x, RF14). Não crie `domain/`/`application/` vazios só por simetria.

**`backend/src/shared/`** é pra código realmente cross-cutting, usado por mais de um módulo (hoje: `shared/http/authMiddleware.ts`, que qualquer módulo usa pra proteger uma rota). **`backend/src/db/`** guarda o schema Drizzle único (`schema.ts`) e as migrations — compartilhado entre módulos porque o banco `gamification` é um só (ver `.claude/der-original-tcc.md`); não fragmentar em um schema por módulo.

## Regra de dependência (a única que não se quebra)

`domain` não importa nada de `infrastructure`, `interfaces`, Express, Drizzle ou qualquer biblioteca externa — só tipos e funções puras. `application` importa `domain` e suas próprias `ports` (interfaces), nunca uma implementação concreta de `infrastructure`. `infrastructure` implementa as `ports` de `application`. `interfaces/http` chama `application` (casos de uso), nunca acessa `infrastructure` direto (nem repositório, nem bcrypt, nem jwt).

Quem decide qual `infrastructure` concreta entra atrás de cada `port` é a **composição** — `backend/src/app.ts` (`createApp`). É o único lugar onde `new DrizzleUserRepository(...)`, `new BcryptPasswordHasher()` etc. aparecem lado a lado. Isso é inversão de dependência (SOLID/DIP) na prática: trocar bcrypt por outro hasher, ou Drizzle por outra persistência, é trocar o que é injetado em `app.ts`, sem tocar em `domain`/`application`.

## Casos de uso

Um caso de uso = uma classe com um único método público `execute(input): Promise<Result>`, construtor recebendo as `ports` que precisa (nunca lendo `process.env` ou instanciando infraestrutura dentro de si). Nome no imperativo (`RegisterUserUseCase`, `LoginUserUseCase`, não `AuthService`). Erros de negócio são classes próprias em `domain/errors.ts` (`EmailAlreadyInUseError`, `InvalidCredentialsError`...), lançadas pelo caso de uso e traduzidas pra status HTTP só na camada `interfaces/http`.

Regra prática: se um caso de uso está fazendo duas coisas que poderiam ser descritas com "e" (ex: "registra o usuário e envia e-mail de boas-vindas e..."), provavelmente devia ser dois casos de uso, ou um orquestrando o outro.

Delegação simples sem regra de negócio (ex: montar a URL de autorização do Google, que é só repassar pra um adapter) não precisa de caso de uso próprio — pode ficar direto no controller, chamando a `port`. Documentar com um comentário curto por quê, como em `authRouter.ts`.

## Validação na borda (Zod)

Toda rota HTTP que recebe corpo/query valida com um schema Zod antes de chamar o caso de uso (`interfaces/http/schemas.ts`). O schema é a fonte de verdade do formato aceito — inclusive define implicitamente o que é **descartado** (ex: um cliente mal-intencionado mandando `role: "admin"` no cadastro nunca chega no caso de uso, porque o schema não declara esse campo e `z.object()` descarta chaves desconhecidas por padrão). Isso é o que garante RNF07 na borda, além da regra já estar no caso de uso.

Não validar de novo dentro do caso de uso o que a borda HTTP já validou (ex: formato de e-mail) — só validar ali regra que é de negócio mesmo (e-mail já cadastrado, credencial inválida). Ver a instrução geral do projeto: validar só nas bordas do sistema.

## Testes — sempre junto, nunca depois

Todo caso de uso, todo adapter de infraestrutura e todo router ganha teste no mesmo commit/sessão que o cria, não numa etapa separada depois. Local: `<arquivo>.test.ts` ao lado do arquivo testado (convenção já usada no projeto inteiro).

- **`domain/`**: teste puro, sem I/O, se houver lógica (funções auxiliares, invariantes).
- **`application/useCases/`**: teste injetando fakes de `test/fakes/` pra cada port (não bibliotecas de mock pesadas, não a implementação real) — rápido, sem rede/banco, cobre a regra de negócio isolada da infraestrutura.
- **`infrastructure/`**: teste da implementação concreta em si (ex: `bcryptPasswordHasher.test.ts` testa hash/verify de verdade; `googleIdentityProviderAdapter.test.ts` mocka só a biblioteca externa `google-auth-library`, não a lógica do adapter).
- **`interfaces/http/`**: teste fino via `supertest`, montando um Express app com fakes injetados (não sobe banco real) — cobre status code e tradução HTTP, não repete a regra de negócio já coberta no teste do caso de uso.
- **Fakes** (`test/fakes/`) implementam a mesma interface de `port` que a produção usa — é o que torna os testes de caso de uso possíveis sem Postgres real. Um fake por port, reaproveitado entre todos os testes que precisam dele.
- Validação de ponta a ponta real (banco real, `docker compose up`, `curl` através do gateway) continua acontecendo por tarefa antes de marcar como concluída no backlog — os testes automatizados não substituem isso, complementam.

## SOLID aplicado (o básico, sem dogma)

- **SRP:** um caso de uso = uma ação de negócio. Um adapter = uma responsabilidade de infraestrutura (hash, ou token, ou persistência — nunca um `AuthInfra` genérico fazendo tudo).
- **ISP:** ports pequenas e focadas (`PasswordHasher`, `TokenIssuer`, `UserRepository`, `GoogleIdentityProvider` — nunca uma interface `AuthPort` juntando tudo).
- **DIP:** `application`/`domain` dependem só de interfaces que eles mesmos declaram (`ports/`); quem implementa e quem injeta é decidido em `infrastructure/` + `app.ts`.
- **OCP:** estender (ex: adicionar login com GitHub) é criar um novo adapter atrás de uma port existente ou nova, sem alterar os casos de uso já existentes de e-mail/senha.
- Nada de método/arquivo gigante: se um arquivo passa de ~150 linhas ou um método de ~30-40, é sinal de que ele está fazendo mais de uma coisa — quebrar.

## Reforço mecânico (não só disciplina)

A regra de dependência acima **não depende só de lembrar** — `backend/eslint.config.mjs` tem três blocos `no-restricted-imports` que bloqueiam, por caminho de arquivo (`files: ['src/modules/*/domain/**/*.ts']` etc.), imports proibidos por camada: `domain/` não pode importar `application/`, `infrastructure/`, `interfaces/` nem bibliotecas concretas (`express`, `drizzle-orm`, `bcryptjs`, `jsonwebtoken`, `google-auth-library`, `pg`, `zod`); `application/` não pode importar `infrastructure/`/`interfaces/` nem essas bibliotecas direto; `interfaces/http/` não pode importar `infrastructure/` direto. Violar isso quebra `npm run lint` com uma mensagem apontando de volta pra este documento — não é um linter genérico, é a arquitetura virando regra de build. Ao criar um módulo novo em `modules/<nome>/`, essas regras já se aplicam automaticamente (o glob usa `*` no lugar do nome do módulo).

## Onde isso já está aplicado

`backend/src/modules/auth/` é a referência viva — implementa exatamente essa estrutura (4 casos de uso, 4 ports, 3 adapters de infraestrutura, 1 router, fakes completos, 46 testes). `backend/src/modules/admin/` mostra o caso mínimo (só `interfaces/http`, reaproveitando a port/middleware de `auth`/`shared`). `backend/src/app.ts` é a composição de referência.
