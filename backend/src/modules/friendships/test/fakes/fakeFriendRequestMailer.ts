import type { FriendRequestMailer } from '../../application/ports/friendRequestMailer'

export interface FakeFriendRequestMailer extends FriendRequestMailer {
  received: { requesterId: string; addresseeId: string }[]
  accepted: { requesterId: string; accepterId: string }[]
  failWith(error: Error): void
}

export function createFakeFriendRequestMailer(): FakeFriendRequestMailer {
  const received: FakeFriendRequestMailer['received'] = []
  const accepted: FakeFriendRequestMailer['accepted'] = []
  let failure: Error | null = null
  return {
    received,
    accepted,
    failWith(error) {
      failure = error
    },
    async sendRequestReceived(input) {
      if (failure) throw failure
      received.push(input)
    },
    async sendRequestAccepted(input) {
      if (failure) throw failure
      accepted.push(input)
    },
  }
}
