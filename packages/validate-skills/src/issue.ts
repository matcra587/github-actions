export type IssueLevel = 'error' | 'warning'

export type IssueCode =
  | 'frontmatter/missing'
  | 'frontmatter/yaml-parse'
  | 'frontmatter/missing-name'
  | 'frontmatter/missing-description'
  | 'agentskills/name-too-long'
  | 'agentskills/name-pattern'
  | 'agentskills/name-dir-mismatch'
  | 'agentskills/description-too-long'
  | 'agentskills/compatibility-too-long'
  | 'marketplace/invalid-json'
  | 'marketplace/not-object'
  | 'marketplace/no-plugins'
  | 'marketplace/entry-not-object'
  | 'marketplace/missing-field'
  | 'marketplace/duplicate-name'
  | 'marketplace/source-missing'
  | 'marketplace/missing-optional'
  | 'marketplace/orphan'
  | 'plugin-manifest/invalid-json'
  | 'plugin-manifest/unsupported-field'

export type Issue = {
  level: IssueLevel
  file: string
  line?: number
  message: string
  code: IssueCode
}

export function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Per-rule metadata: human-readable description (used in log output)
 * + the level the validator emits (so the rule list documents
 * whether each check is an error or warning).
 *
 * `RULES` is `satisfies Record<IssueCode, RuleMeta>` so the TypeScript
 * compiler enforces that every IssueCode has a corresponding entry.
 * Adding a new code without a description is a compile error — this
 * prevents drift between the IssueCode union and the rule descriptions
 * shown to users.
 */
export type RuleMeta = { description: string; level: IssueLevel }

export const RULES = {
  'frontmatter/missing': { description: 'missing-frontmatter', level: 'error' },
  'frontmatter/yaml-parse': { description: 'yaml-parse', level: 'error' },
  'frontmatter/missing-name': {
    description: 'missing-name (agents only)',
    level: 'error',
  },
  'frontmatter/missing-description': {
    description: 'missing-description',
    level: 'error',
  },
  'agentskills/name-too-long': {
    description: 'name-too-long (>64)',
    level: 'error',
  },
  'agentskills/name-pattern': { description: 'name-pattern', level: 'error' },
  'agentskills/name-dir-mismatch': {
    description: 'name-dir-mismatch',
    level: 'error',
  },
  'agentskills/description-too-long': {
    description: 'description-too-long (>1024)',
    level: 'error',
  },
  'agentskills/compatibility-too-long': {
    description: 'compatibility-too-long (>500)',
    level: 'warning',
  },
  'marketplace/invalid-json': { description: 'invalid-json', level: 'error' },
  'marketplace/not-object': { description: 'not-object', level: 'error' },
  'marketplace/no-plugins': { description: 'no-plugins', level: 'error' },
  'marketplace/entry-not-object': {
    description: 'entry-not-object',
    level: 'error',
  },
  'marketplace/missing-field': {
    description: 'missing-field (name/description/source)',
    level: 'error',
  },
  'marketplace/duplicate-name': {
    description: 'duplicate-name',
    level: 'error',
  },
  'marketplace/source-missing': {
    description: 'source-missing',
    level: 'error',
  },
  'marketplace/missing-optional': {
    description: 'missing-optional (category/homepage)',
    level: 'warning',
  },
  'marketplace/orphan': {
    description: 'orphan (plugin only)',
    level: 'warning',
  },
  'plugin-manifest/invalid-json': {
    description: 'plugin-manifest invalid-json',
    level: 'error',
  },
  'plugin-manifest/unsupported-field': {
    description: 'plugin-manifest unsupported-field',
    level: 'error',
  },
} as const satisfies Record<IssueCode, RuleMeta>

/**
 * Returns the human-readable rule descriptions for every IssueCode
 * whose code starts with the given prefix (e.g. `'frontmatter/'`).
 * Used by `main.ts` to display per-validator rule lists in the log
 * without hand-maintaining duplicate strings.
 */
export function describeRules(prefix: string): string {
  return (Object.entries(RULES) as Array<[IssueCode, RuleMeta]>)
    .filter(([code]) => code.startsWith(prefix))
    .map(([, meta]) => meta.description)
    .join(', ')
}
