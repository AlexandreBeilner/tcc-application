import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

// Aplicações concretas de infraestrutura que domain/application nunca podem
// importar direto — só via port + injeção em app.ts. Ver
// .claude/arquitetura-backend-ddd-lite.md.
const INFRA_PACKAGES = ['express', 'drizzle-orm', 'drizzle-orm/*', 'bcryptjs', 'jsonwebtoken', 'google-auth-library', 'pg']

const ARCHITECTURE_DOC_REF = 'ver .claude/arquitetura-backend-ddd-lite.md'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  // Camada domain/: zero dependência de application, infrastructure,
  // interfaces ou qualquer biblioteca externa de infraestrutura.
  {
    files: ['src/modules/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interfaces/**', '**/application/**', 'zod', ...INFRA_PACKAGES],
              message: `domain/ não pode depender de application, infrastructure, interfaces ou bibliotecas externas — ${ARCHITECTURE_DOC_REF}`,
            },
          ],
        },
      ],
    },
  },
  // Camada application/ (ports, services, useCases): só depende de domain e
  // das próprias ports — infrastructure entra por injeção, nunca por import.
  {
    files: ['src/modules/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', '**/interfaces/**', ...INFRA_PACKAGES],
              message: `application/ não pode importar infrastructure/interfaces nem bibliotecas concretas direto — dependa de ports (application/ports) — ${ARCHITECTURE_DOC_REF}`,
            },
          ],
        },
      ],
    },
  },
  // Camada interfaces/http: chama casos de uso via ports, nunca instancia
  // infraestrutura concreta (isso é papel exclusivo da composição em app.ts).
  {
    files: ['src/modules/*/interfaces/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/infrastructure/**', 'drizzle-orm', 'drizzle-orm/*', 'bcryptjs', 'jsonwebtoken', 'google-auth-library', 'pg'],
              message: `interfaces/http não pode importar infrastructure direto — só application (casos de uso) e ports — ${ARCHITECTURE_DOC_REF}`,
            },
          ],
        },
      ],
    },
  },
)
