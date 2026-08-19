import bcrypt from 'bcryptjs'
import type { PasswordHasher } from '../../application/ports/passwordHasher'

const SALT_ROUNDS = 12

export function createBcryptPasswordHasher(): PasswordHasher {
  return {
    hash(password) {
      return bcrypt.hash(password, SALT_ROUNDS)
    },
    verify(password, hash) {
      return bcrypt.compare(password, hash)
    },
  }
}
