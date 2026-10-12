import { describe, expect, it } from 'vitest'
import {
  assertProductionConfig,
  findProductionConfigProblems,
  readDeployEnv,
} from './productionConfigGuard'

const STRONG_SECRET = 'x'.repeat(40)

// Configuração mínima que passa pela guarda; cada teste estraga uma coisa só.
function validEnv(overrides: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    DEPLOY_ENV: 'production',
    JWT_SECRET: STRONG_SECRET,
    EMAIL_PROVIDER: 'resend',
    BILLING_PROVIDER: 'revenuecat',
    FRONTEND_URL: 'https://app.selucra.com.br',
    PUBLIC_API_URL: 'https://api.selucra.com.br',
    DATABASE_URL: 'postgres://gamification_app:SenhaLongaDoBanco123@postgres:5432/gamification',
    REDIS_URL: 'redis://:SenhaLongaDoRedis123@redis:6379/1',
    ENGINE_URL: 'http://engine:8080',
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  return env
}

describe('readDeployEnv', () => {
  it('sem valor ou "development" é desenvolvimento', () => {
    expect(readDeployEnv({})).toBe('development')
    expect(readDeployEnv({ DEPLOY_ENV: '  ' })).toBe('development')
    expect(readDeployEnv({ DEPLOY_ENV: 'development' })).toBe('development')
  })

  it('"production" liga a guarda', () => {
    expect(readDeployEnv({ DEPLOY_ENV: 'production' })).toBe('production')
  })

  it('"staging" também liga a guarda', () => {
    expect(readDeployEnv({ DEPLOY_ENV: 'staging' })).toBe('staging')
  })

  it('valor desconhecido derruba a subida em vez de cair em desenvolvimento', () => {
    expect(() => readDeployEnv({ DEPLOY_ENV: 'prod' })).toThrow(/DEPLOY_ENV inválido/)
    expect(() => readDeployEnv({ DEPLOY_ENV: 'Production' })).toThrow(/DEPLOY_ENV inválido/)
  })
})

describe('findProductionConfigProblems', () => {
  it('aceita uma configuração de produção completa', () => {
    expect(findProductionConfigProblems(validEnv())).toEqual([])
  })

  it('ASSEMBLIES_ENABLED: ausente, on e off passam; outro valor é recusado (seria lido como ligado)', () => {
    for (const value of [undefined, 'on', 'off']) {
      expect(findProductionConfigProblems(validEnv({ ASSEMBLIES_ENABLED: value }))).toEqual([])
    }
    expect(findProductionConfigProblems(validEnv({ ASSEMBLIES_ENABLED: 'false' }))).toEqual([
      'ASSEMBLIES_ENABLED="false" não é reconhecido: use "off" para desligar as assembleias (ou deixe vazio/"on")',
    ])
  })

  it('aceita BILLING_PROVIDER ausente ou disabled (cobrança ainda não ligada)', () => {
    expect(findProductionConfigProblems(validEnv({ BILLING_PROVIDER: undefined }))).toEqual([])
    expect(findProductionConfigProblems(validEnv({ BILLING_PROVIDER: 'disabled' }))).toEqual([])
  })

  it('recusa JWT_SECRET ausente, de desenvolvimento ou curto', () => {
    expect(findProductionConfigProblems(validEnv({ JWT_SECRET: undefined }))).toEqual([
      'JWT_SECRET é obrigatório em produção',
    ])
    expect(
      findProductionConfigProblems(validEnv({ JWT_SECRET: 'dev-secret-troque-em-producao' })),
    ).toEqual(['JWT_SECRET está com o valor de desenvolvimento do repositório'])
    expect(findProductionConfigProblems(validEnv({ JWT_SECRET: 'curto' }))).toEqual([
      'JWT_SECRET precisa ter pelo menos 32 caracteres',
    ])
  })

  it('o segredo de cancelar inscrição é opcional, mas se vier precisa ser forte', () => {
    expect(
      findProductionConfigProblems(validEnv({ EMAIL_UNSUBSCRIBE_SECRET: STRONG_SECRET })),
    ).toEqual([])
    expect(
      findProductionConfigProblems(
        validEnv({ EMAIL_UNSUBSCRIBE_SECRET: 'dev-secret-troque-em-producao' }),
      ),
    ).toEqual(['EMAIL_UNSUBSCRIBE_SECRET está com o valor de desenvolvimento do repositório'])
    expect(findProductionConfigProblems(validEnv({ EMAIL_UNSUBSCRIBE_SECRET: 'curto' }))).toEqual([
      'EMAIL_UNSUBSCRIBE_SECRET precisa ter pelo menos 32 caracteres',
    ])
  })

  it('recusa e-mail que não seja resend', () => {
    expect(findProductionConfigProblems(validEnv({ EMAIL_PROVIDER: 'log' }))).toHaveLength(1)
    expect(findProductionConfigProblems(validEnv({ EMAIL_PROVIDER: undefined }))).toHaveLength(1)
  })

  it('recusa cobrança em modo dev', () => {
    expect(findProductionConfigProblems(validEnv({ BILLING_PROVIDER: 'dev' }))).toEqual([
      'BILLING_PROVIDER=dev grava assinatura de mentira, não vale em produção',
    ])
  })

  it('exige FRONTEND_URL e PUBLIC_API_URL em https e fora de localhost', () => {
    expect(findProductionConfigProblems(validEnv({ FRONTEND_URL: undefined }))).toEqual([
      'FRONTEND_URL é obrigatória em produção',
    ])
    expect(
      findProductionConfigProblems(validEnv({ FRONTEND_URL: 'http://app.selucra.com.br' })),
    ).toEqual(['FRONTEND_URL precisa usar https em produção'])
    expect(
      findProductionConfigProblems(validEnv({ PUBLIC_API_URL: 'https://localhost:8000' })),
    ).toEqual(['PUBLIC_API_URL aponta para localhost'])
    expect(findProductionConfigProblems(validEnv({ PUBLIC_API_URL: 'não é url' }))).toEqual([
      'PUBLIC_API_URL não é uma URL válida',
    ])
  })

  it('só confere o retorno do Google quando o login Google está configurado', () => {
    expect(
      findProductionConfigProblems(
        validEnv({ GOOGLE_REDIRECT_URI: 'http://localhost:8000/auth/google/callback' }),
      ),
    ).toEqual([])
    expect(
      findProductionConfigProblems(
        validEnv({
          GOOGLE_CLIENT_ID: 'id',
          GOOGLE_REDIRECT_URI: 'http://localhost:8000/auth/google/callback',
        }),
      ),
    ).toEqual([
      'GOOGLE_REDIRECT_URI precisa usar https em produção',
      'GOOGLE_REDIRECT_URI aponta para localhost',
    ])
    expect(findProductionConfigProblems(validEnv({ GOOGLE_CLIENT_ID: 'id' }))).toEqual([
      'GOOGLE_REDIRECT_URI é obrigatória em produção',
    ])
  })

  it('recusa banco sem senha, com senha padrão ou curta', () => {
    expect(
      findProductionConfigProblems(
        validEnv({ DATABASE_URL: 'postgres://tcc:tcc@postgres:5432/gamification' }),
      ),
    ).toEqual(['a senha do banco em DATABASE_URL é uma senha padrão conhecida'])
    expect(
      findProductionConfigProblems(
        validEnv({ DATABASE_URL: 'postgres://app@postgres:5432/gamification' }),
      ),
    ).toEqual(['DATABASE_URL sem senha'])
    expect(
      findProductionConfigProblems(
        validEnv({ DATABASE_URL: 'postgres://app:curta@postgres:5432/g' }),
      ),
    ).toEqual(['a senha do banco em DATABASE_URL precisa ter pelo menos 16 caracteres'])
    expect(findProductionConfigProblems(validEnv({ DATABASE_URL: undefined }))).toEqual([
      'DATABASE_URL é obrigatória em produção',
    ])
  })

  it('aplica as mesmas regras de senha à URL do papel que migra (opcional)', () => {
    expect(
      findProductionConfigProblems(
        validEnv({
          DATABASE_MIGRATE_URL:
            'postgres://selucra_owner:SenhaLongaDoDonoDoBanco1@postgres:5432/gamification',
        }),
      ),
    ).toEqual([])
    expect(findProductionConfigProblems(validEnv({ DATABASE_MIGRATE_URL: '' }))).toEqual([])
    expect(
      findProductionConfigProblems(
        validEnv({
          DATABASE_MIGRATE_URL: 'postgres://selucra_owner:curta@postgres:5432/gamification',
        }),
      ),
    ).toEqual(['a senha do banco em DATABASE_MIGRATE_URL precisa ter pelo menos 16 caracteres'])
    expect(
      findProductionConfigProblems(
        validEnv({ DATABASE_MIGRATE_URL: 'postgres://selucra_owner@postgres:5432/gamification' }),
      ),
    ).toEqual(['DATABASE_MIGRATE_URL sem senha'])
  })

  it('exige Redis e motor', () => {
    expect(findProductionConfigProblems(validEnv({ REDIS_URL: undefined }))).toEqual([
      'REDIS_URL é obrigatória em produção',
    ])
    expect(findProductionConfigProblems(validEnv({ ENGINE_URL: undefined }))).toEqual([
      'ENGINE_URL é obrigatória em produção',
    ])
  })

  it('lista tudo de uma vez quando está tudo com padrão de desenvolvimento', () => {
    const problems = findProductionConfigProblems({
      DEPLOY_ENV: 'production',
      EMAIL_PROVIDER: 'log',
      BILLING_PROVIDER: 'dev',
      DATABASE_URL: 'postgres://tcc:tcc@postgres:5432/gamification',
    })
    expect(problems.length).toBeGreaterThanOrEqual(7)
  })
})

describe('assertProductionConfig', () => {
  it('em desenvolvimento não olha nada', () => {
    expect(() => assertProductionConfig({})).not.toThrow()
    expect(() =>
      assertProductionConfig({
        JWT_SECRET: 'dev-secret-troque-em-producao',
        EMAIL_PROVIDER: 'log',
      }),
    ).not.toThrow()
  })

  it('em produção com configuração boa, passa', () => {
    expect(() => assertProductionConfig(validEnv())).not.toThrow()
  })

  it('em produção com problema, derruba com a lista completa', () => {
    expect(() =>
      assertProductionConfig(validEnv({ JWT_SECRET: 'curto', EMAIL_PROVIDER: 'log' })),
    ).toThrow(/configuração inválida para produção:.*JWT_SECRET.*EMAIL_PROVIDER/)
  })
})

describe('staging', () => {
  const stagingEnv = (overrides: Record<string, string | undefined> = {}) =>
    validEnv({ DEPLOY_ENV: 'staging', ...overrides })

  it('aceita e-mail em log, que produção recusa', () => {
    expect(() => assertProductionConfig(stagingEnv({ EMAIL_PROVIDER: 'log' }))).not.toThrow()
    expect(() => assertProductionConfig(validEnv({ EMAIL_PROVIDER: 'log' }))).toThrow(
      /EMAIL_PROVIDER/,
    )
  })

  it('recusa provedor de e-mail desconhecido', () => {
    expect(() => assertProductionConfig(stagingEnv({ EMAIL_PROVIDER: 'smtp' }))).toThrow(
      /configuração inválida para staging:.*EMAIL_PROVIDER/,
    )
  })

  it('mantém as exigências de segredo, URL, banco e cobrança', () => {
    expect(() => assertProductionConfig(stagingEnv({ JWT_SECRET: 'curto' }))).toThrow(/JWT_SECRET/)
    expect(() => assertProductionConfig(stagingEnv({ BILLING_PROVIDER: 'dev' }))).toThrow(
      /BILLING_PROVIDER/,
    )
    expect(() =>
      assertProductionConfig(stagingEnv({ FRONTEND_URL: 'http://localhost:5173' })),
    ).toThrow(/FRONTEND_URL/)
  })
})
