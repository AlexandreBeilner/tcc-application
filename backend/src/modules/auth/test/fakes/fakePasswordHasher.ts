import type { PasswordHasher } from '../../application/ports/passwordHasher'

// Hash previsível (não critográfico) — evita custo real de bcrypt nos testes
// de casos de uso, que não exercitam a implementação de hashing em si
// (isso é responsabilidade do teste de infrastructure/security/bcryptPasswordHasher.test.ts).
export function createFakePasswordHasher(): PasswordHasher {
  return {
    async hash(password) {
      return `hashed:${password}`
    },
    async verify(password, hash) {
      return hash === `hashed:${password}`
    },
  }
}
