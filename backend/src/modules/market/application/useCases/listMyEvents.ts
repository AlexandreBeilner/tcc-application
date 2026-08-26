import type { AccountEventRecord, AccountReader } from '../ports/accountReader'

export interface ListMyEventsInput {
  userId: string
  limit?: number
  offset?: number
}

export class ListMyEventsUseCase {
  constructor(private readonly accountReader: AccountReader) {}

  execute(input: ListMyEventsInput): Promise<AccountEventRecord[]> {
    return this.accountReader.listAccountEvents(input.userId, {
      limit: input.limit,
      offset: input.offset,
    })
  }
}
