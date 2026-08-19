import { randomUUID } from 'node:crypto'
import type { UserRepository } from '../ports/userRepository'

export function usernameFromEmail(email: string): string {
  const local = email
    .split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
  return (local || 'usuario').slice(0, 24)
}

export async function generateUniqueUsername(
  userRepository: UserRepository,
  base: string,
): Promise<string> {
  let candidate = base
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (!(await userRepository.findByUsername(candidate))) {
      return candidate
    }
    candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 30)
  }
  return `${base}${randomUUID().slice(0, 8)}`.slice(0, 30)
}
