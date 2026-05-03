import { readFile } from 'node:fs/promises'
import { isPlainObject } from '@validate-skills/issue'

/**
 * The raw shape of a marketplace.json entry as it appears in the
 * parsed JSON, before any structural validation. Field types are
 * `unknown` because the JSON is untrusted at parse time — callers
 * narrow with `typeof` checks before reading.
 */
export type MarketplaceEntryRaw = {
  name?: unknown
  description?: unknown
  source?: unknown
  category?: unknown
  homepage?: unknown
}

/**
 * The result of reading + parsing a marketplace.json file. Captures
 * every structural state the validator might need to differentiate
 * (parse error vs. wrong root type vs. missing plugins array vs. valid).
 *
 * Both `validators/marketplace.ts` and `main.ts` consume this — single
 * read, single parse per action invocation.
 */
export type MarketplaceShape = {
  /** Raw file content, or `null` if the file could not be read. */
  rawText: string | null
  /** `JSON.parse` output, or `null` if parse failed. */
  parsed: unknown
  /** Populated iff JSON.parse threw. */
  parseError: string | null
  /** True iff `parsed` is a plain object (not array, not null). */
  rootIsObject: boolean
  /** True iff the root object's `plugins` field is an array. */
  pluginsIsArray: boolean
  /**
   * Every entry in the `plugins` array (filtered to plain objects only).
   * Empty if `pluginsIsArray` is false. Non-object entries are dropped
   * here; callers needing to flag them should iterate `parsed.plugins`
   * directly.
   */
  entries: ReadonlyArray<MarketplaceEntryRaw>
}

export async function readMarketplace(path: string): Promise<MarketplaceShape> {
  let rawText: string
  try {
    rawText = await readFile(path, 'utf-8')
  } catch {
    return {
      rawText: null,
      parsed: null,
      parseError: null,
      rootIsObject: false,
      pluginsIsArray: false,
      entries: [],
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch (err) {
    return {
      rawText,
      parsed: null,
      parseError: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
      rootIsObject: false,
      pluginsIsArray: false,
      entries: [],
    }
  }

  const rootIsObject = isPlainObject(parsed)
  let pluginsIsArray = false
  let entries: ReadonlyArray<MarketplaceEntryRaw> = []

  if (isPlainObject(parsed) && Array.isArray(parsed.plugins)) {
    pluginsIsArray = true
    entries = parsed.plugins.filter((p): p is MarketplaceEntryRaw =>
      isPlainObject(p),
    )
  }

  return {
    rawText,
    parsed,
    parseError: null,
    rootIsObject,
    pluginsIsArray,
    entries,
  }
}
