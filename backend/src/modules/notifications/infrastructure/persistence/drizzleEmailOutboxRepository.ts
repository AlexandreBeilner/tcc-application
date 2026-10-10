import { and, eq, lt, notInArray, sql } from 'drizzle-orm'
import type { Database } from '../../../../db/client'
import { emailOutbox } from '../../../../db/schema'
import type { EmailOutboxRepository } from '../../application/ports/emailOutboxRepository'
import type { EmailCategory, OutboxEmail, OutboxStatus } from '../../domain/emailMessage'

type OutboxRow = typeof emailOutbox.$inferSelect

// `payload - text[]` remove as chaves do jsonb; sem campos a limpar, não mexe no payload.
function scrubbed(fields: readonly string[]) {
  if (fields.length === 0) return {}
  const list = sql.join(
    fields.map((f) => sql`${f}`),
    sql`, `,
  )
  return { payload: sql`${emailOutbox.payload} - ARRAY[${list}]::text[]` }
}

function toOutboxEmail(row: OutboxRow): OutboxEmail {
  return {
    id: row.id,
    userId: row.userId,
    toAddress: row.toAddress,
    templateKey: row.templateKey,
    category: row.category as EmailCategory,
    payload: row.payload,
    idempotencyKey: row.idempotencyKey,
    status: row.status as OutboxStatus,
    attempts: row.attempts,
    nextAttemptAt: row.nextAttemptAt,
  }
}

export function createDrizzleEmailOutboxRepository(db: Database): EmailOutboxRepository {
  return {
    async enqueue(input) {
      const [inserted] = await db
        .insert(emailOutbox)
        .values({
          userId: input.userId,
          toAddress: input.toAddress,
          templateKey: input.templateKey,
          category: input.category,
          payload: input.payload,
          idempotencyKey: input.idempotencyKey,
          ...(input.sendAt ? { nextAttemptAt: input.sendAt } : {}),
          ...(input.suppressedBy
            ? { status: 'suppressed', lastError: `suppressed:${input.suppressedBy}` }
            : {}),
        })
        .onConflictDoNothing({ target: emailOutbox.idempotencyKey })
        .returning({ id: emailOutbox.id })
      if (inserted) return { id: inserted.id, created: true }

      const [existing] = await db
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(eq(emailOutbox.idempotencyKey, input.idempotencyKey))
        .limit(1)
      return { id: existing.id, created: false }
    },

    // `FOR UPDATE SKIP LOCKED` na subconsulta: duas réplicas reivindicando ao mesmo tempo nunca
    // pegam a mesma linha, e uma não espera a outra.
    async claimBatch(limit, now) {
      const rows = await db
        .update(emailOutbox)
        .set({
          status: 'sending',
          attempts: sql`${emailOutbox.attempts} + 1`,
          claimedAt: now,
        })
        .where(
          sql`${emailOutbox.id} IN (
            SELECT ${emailOutbox.id} FROM ${emailOutbox}
            WHERE ${emailOutbox.status} = 'pending' AND ${emailOutbox.nextAttemptAt} <= ${now}
            ORDER BY ${emailOutbox.nextAttemptAt}
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED
          )`,
        )
        .returning()
      return rows
        .map(toOutboxEmail)
        .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime())
    },

    async markSent(id, providerMessageId, now, scrubFields = []) {
      await db
        .update(emailOutbox)
        .set({
          status: 'sent',
          providerMessageId,
          sentAt: now,
          lastError: null,
          claimedAt: null,
          ...scrubbed(scrubFields),
        })
        .where(eq(emailOutbox.id, id))
    },

    async markForRetry(id, error, nextAttemptAt) {
      await db
        .update(emailOutbox)
        .set({ status: 'pending', lastError: error, nextAttemptAt, claimedAt: null })
        .where(eq(emailOutbox.id, id))
    },

    async markFailed(id, error, scrubFields = []) {
      await db
        .update(emailOutbox)
        .set({ status: 'failed', lastError: error, claimedAt: null, ...scrubbed(scrubFields) })
        .where(eq(emailOutbox.id, id))
    },

    async markSuppressed(id, reason) {
      await db
        .update(emailOutbox)
        .set({ status: 'suppressed', lastError: `suppressed:${reason}`, claimedAt: null })
        .where(eq(emailOutbox.id, id))
    },

    async markDelivered(providerMessageId, at) {
      await db
        .update(emailOutbox)
        .set({ deliveredAt: at })
        .where(eq(emailOutbox.providerMessageId, providerMessageId))
    },

    async recoverStuck(claimedBefore, maxAttempts) {
      const rows = await db
        .update(emailOutbox)
        .set({
          status: sql`CASE WHEN ${emailOutbox.attempts} >= ${maxAttempts} THEN 'failed' ELSE 'pending' END`,
          lastError: 'processo caiu durante o envio',
          claimedAt: null,
        })
        .where(and(eq(emailOutbox.status, 'sending'), lt(emailOutbox.claimedAt, claimedBefore)))
        .returning({ id: emailOutbox.id })
      return rows.length
    },

    async deleteByUser(userId, { keepTemplateKeys }) {
      const rows = await db
        .delete(emailOutbox)
        .where(
          and(
            eq(emailOutbox.userId, userId),
            keepTemplateKeys.length > 0
              ? notInArray(emailOutbox.templateKey, [...keepTemplateKeys])
              : undefined,
          ),
        )
        .returning({ id: emailOutbox.id })
      return rows.length
    },
  }
}
