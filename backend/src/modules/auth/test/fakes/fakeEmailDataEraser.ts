import type { EmailDataEraser } from '../../application/ports/emailDataEraser'

export function createFakeEmailDataEraser(): EmailDataEraser & { erased: string[] } {
  const erased: string[] = []
  return {
    erased,
    async eraseForUser(userId) {
      erased.push(userId)
    },
  }
}
