import { sql } from 'drizzle-orm'
import type { Database } from '../client'

interface UserReference {
  table: string
  columns: string[]
  nullable: boolean
  // Gatilho próprio (ex: append-only de `admin_audit_log` e `lesson_revisions`) recusa UPDATE/DELETE linha a linha.
  guarded: boolean
}

// Apaga todos os usuários de um banco de teste DESCARTÁVEL, qualquer que seja o resíduo deixado por outros
// arquivos de teste no mesmo `TEST_DATABASE_URL`. Uma lista fixa de `db.delete(...)` antes de `users` quebra a cada
// tabela nova que referencia `users`, e não consegue limpar tabela append-only (o gatilho recusa DELETE). Aqui a
// lista vem do catálogo do Postgres:
// - FK com ON DELETE CASCADE/SET NULL/SET DEFAULT: o próprio DELETE de `users` resolve;
// - FK anulável numa tabela sem gatilho: vira NULL, e a linha fica (ex: `daily_settings.updated_by`, cuja linha
//   única vem da migration);
// - o resto (FK obrigatória, ou tabela com gatilho): TRUNCATE ... CASCADE, que não dispara gatilho de linha.
// Nenhuma tabela truncada aqui recebe linha de migration, por isso o TRUNCATE não apaga dado de que outro teste
// dependa.
export async function deleteAllUsers(db: Database): Promise<void> {
  const result = await db.execute<{
    table: string
    columns: string[]
    nullable: boolean
    guarded: boolean
  }>(sql`
    SELECT
      format('%I.%I', n.nspname, r.relname) AS "table",
      array_agg(a.attname::text ORDER BY a.attnum) AS "columns",
      bool_and(NOT a.attnotnull) AS "nullable",
      EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = c.conrelid AND NOT t.tgisinternal) AS "guarded"
    FROM pg_constraint c
    JOIN pg_class r ON r.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = r.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.users'::regclass
      AND c.conrelid <> c.confrelid
      AND c.confdeltype IN ('a', 'r')
    GROUP BY c.oid, n.nspname, r.relname, c.conrelid
  `)
  const references: UserReference[] = result.rows

  const truncated = [
    ...new Set(references.filter((ref) => !ref.nullable || ref.guarded).map((ref) => ref.table)),
  ]
  if (truncated.length > 0) {
    await db.execute(sql.raw(`TRUNCATE ${truncated.join(', ')} CASCADE`))
  }
  for (const ref of references) {
    if (truncated.includes(ref.table)) continue
    const assignments = ref.columns.map((column) => `"${column}" = NULL`).join(', ')
    const filter = ref.columns.map((column) => `"${column}" IS NOT NULL`).join(' OR ')
    await db.execute(sql.raw(`UPDATE ${ref.table} SET ${assignments} WHERE ${filter}`))
  }
  await db.execute(sql`DELETE FROM users`)
}
