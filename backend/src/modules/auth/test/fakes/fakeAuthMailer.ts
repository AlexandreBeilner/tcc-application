import type {
  AuthMailer,
  PasswordChangedMail,
  PasswordResetMail,
} from '../../application/ports/authMailer'

export interface FakeAuthMailer extends AuthMailer {
  resets: PasswordResetMail[]
  changes: PasswordChangedMail[]
}

export function createFakeAuthMailer(): FakeAuthMailer {
  const resets: PasswordResetMail[] = []
  const changes: PasswordChangedMail[] = []
  return {
    resets,
    changes,
    async sendPasswordReset(mail) {
      resets.push(mail)
    },
    async sendPasswordChanged(mail) {
      changes.push(mail)
    },
  }
}
