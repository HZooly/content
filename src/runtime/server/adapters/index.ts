import { parseJsonFields } from '../../utils/internal/parseJsonFields'
import createSqliteAdapter from './sqlite'
import type { DatabaseAdapter } from './factory'
import { useRuntimeConfig } from '#imports'
import { collections } from '#content-v3/collections'

export default function useContentDatabase() {
  const { database, localDatabase } = useRuntimeConfig().contentv3

  let adapter: DatabaseAdapter
  async function loadAdapter() {
    if (!adapter) {
      if (['nitro-prerender', 'nitro-dev'].includes(import.meta.preset as string)) {
        adapter = await createSqliteAdapter(localDatabase)
      }
      else if (database.type === 'd1') {
        adapter = await import('./d1').then(m => m.default(database))
      }
      else if (database.type === 'sqlite') {
        adapter = await createSqliteAdapter(database)
      }
      else {
        adapter = await createSqliteAdapter(localDatabase)
      }
    }
    return adapter
  }

  function collectionJsonFields(sql: string): string[] {
    const table = sql.match(/FROM\s+(\w+)/)
    if (!table) {
      return []
    }
    return collections.find((c: { name: string }) => c.name === table[1])?.jsonFields || []
  }

  return <DatabaseAdapter>{
    all: async (sql, params) => {
      !adapter && (await loadAdapter())
      const result = await adapter.all<Record<string, unknown>>(sql, params)

      if (!result) {
        return []
      }
      const jsonFields = collectionJsonFields(sql)
      return result.map(item => parseJsonFields(item, jsonFields))
    },
    first: async (sql, params) => {
      !adapter && (await loadAdapter())
      const item = await adapter.first<Record<string, unknown>>(sql, params)

      if (!item) {
        return item
      }

      const jsonFields = collectionJsonFields(sql)
      return parseJsonFields(item, jsonFields)
    },
    exec: async (sql) => {
      !adapter && (await loadAdapter())
      return adapter.exec(sql)
    },
  }
}
