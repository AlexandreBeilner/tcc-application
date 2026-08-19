import type { AccountProvisioner } from '../../application/ports/accountProvisioner'

export interface FakeAccountProvisioner extends AccountProvisioner {
  provisionedUserIds: string[]
}

export function createFakeAccountProvisioner(): FakeAccountProvisioner {
  const provisionedUserIds: string[] = []
  return {
    provisionedUserIds,
    async provision(userId) {
      provisionedUserIds.push(userId)
    },
  }
}
