import type {
  AuthMailer,
  EmailVerificationMail,
  PasswordChangedMail,
  PasswordResetMail,
} from '../../application/ports/authMailer'

export interface FakeAuthMailer extends AuthMailer {
  resets: PasswordResetMail[]
  changes: PasswordChangedMail[]
  verifications: EmailVerificationMail[]
}

export function createFakeAuthMailer(): FakeAuthMailer {
  const resets: PasswordResetMail[] = []
  const changes: PasswordChangedMail[] = []
  const verifications: EmailVerificationMail[] = []
  return {
    resets,
    changes,
    verifications,
    async sendEmailVerification(mail) {
      verifications.push(mail)
    },
    async sendPasswordReset(mail) {
      resets.push(mail)
    },
    async sendPasswordChanged(mail) {
      changes.push(mail)
    },
  }
}
