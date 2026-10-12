import type {
  AccountAdjustedMail,
  AccountDeletedMail,
  AccountMailer,
  AccountReactivatedMail,
  AccountSuspendedMail,
  DataExportedMail,
  WelcomeMail,
} from '../../application/ports/accountMailer'

export interface FakeAccountMailer extends AccountMailer {
  welcomes: WelcomeMail[]
  suspensions: AccountSuspendedMail[]
  reactivations: AccountReactivatedMail[]
  deletions: AccountDeletedMail[]
  exports: DataExportedMail[]
  adjustments: AccountAdjustedMail[]
  // Simula o outbox fora do ar: toda chamada rejeita.
  failWith(error: Error): void
}

export function createFakeAccountMailer(): FakeAccountMailer {
  const welcomes: WelcomeMail[] = []
  const suspensions: AccountSuspendedMail[] = []
  const reactivations: AccountReactivatedMail[] = []
  const deletions: AccountDeletedMail[] = []
  const exports: DataExportedMail[] = []
  const adjustments: AccountAdjustedMail[] = []
  let failure: Error | null = null
  const record =
    <T>(list: T[]) =>
    async (mail: T) => {
      if (failure) throw failure
      list.push(mail)
    }
  return {
    welcomes,
    suspensions,
    reactivations,
    deletions,
    exports,
    adjustments,
    failWith(error) {
      failure = error
    },
    sendWelcome: record(welcomes),
    sendAccountSuspended: record(suspensions),
    sendAccountReactivated: record(reactivations),
    sendAccountDeleted: record(deletions),
    sendDataExported: record(exports),
    sendAccountAdjusted: record(adjustments),
  }
}
