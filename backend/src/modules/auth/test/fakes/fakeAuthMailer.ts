import type {
  AuthMailer,
  EmailVerificationMail,
  PasswordChangedMail,
  PasswordResetMail,
  SessionsEndedMail,
} from '../../application/ports/authMailer'

export interface FakeAuthMailer extends AuthMailer {
  resets: PasswordResetMail[]
  changes: PasswordChangedMail[]
  verifications: EmailVerificationMail[]
  sessionsEnded: SessionsEndedMail[]
}

export function createFakeAuthMailer(): FakeAuthMailer {
  const resets: PasswordResetMail[] = []
  const changes: PasswordChangedMail[] = []
  const verifications: EmailVerificationMail[] = []
  const sessionsEnded: SessionsEndedMail[] = []
  return {
    resets,
    changes,
    verifications,
    sessionsEnded,
    async sendEmailVerification(mail) {
      verifications.push(mail)
    },
    async sendPasswordReset(mail) {
      resets.push(mail)
    },
    async sendPasswordChanged(mail) {
      changes.push(mail)
    },
    async sendSessionsEnded(mail) {
      sessionsEnded.push(mail)
    },
  }
}
