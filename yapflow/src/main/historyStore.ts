/**
 * HistoryStore — Local history of transcription + rewrite results.
 *
 * Stores up to MAX_HISTORY_ENTRIES entries. Oldest entries are pruned
 * automatically on insert.
 *
 * Storage location: ~/Library/Application Support/YapFlow/history.json
 */

import Store from 'electron-store'
import { HistoryEntry } from '../shared/types'
import { HISTORY } from '../shared/constants'

interface HistorySchema {
  entries: HistoryEntry[]
}

export class HistoryStore {
  private store: Store<HistorySchema>

  constructor() {
    this.store = new Store<HistorySchema>({
      name: 'history',
      defaults: {
        entries: []
      }
    })
  }

  /** Add a new entry (newest first). Prunes oldest if over limit. */
  addEntry(entry: HistoryEntry): void {
    const entries = this.store.get('entries', [])
    entries.unshift(entry) // newest first

    // Prune if over limit
    if (entries.length > HISTORY.MAX_ENTRIES) {
      entries.splice(HISTORY.MAX_ENTRIES)
    }

    this.store.set('entries', entries)
  }

  /** Get entries, newest first. Optionally limit result count. */
  getEntries(limit?: number): HistoryEntry[] {
    const entries = this.store.get('entries', [])
    return limit ? entries.slice(0, limit) : entries
  }

  /** Delete a single entry by ID. */
  deleteEntry(id: string): void {
    const entries = this.store.get('entries', [])
    this.store.set(
      'entries',
      entries.filter((e) => e.id !== id)
    )
  }

  /** Delete all history entries. */
  clearAll(): void {
    this.store.set('entries', [])
  }

  getCount(): number {
    return this.store.get('entries', []).length
  }
}
