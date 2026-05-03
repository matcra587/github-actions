import { readFile } from 'node:fs/promises'
import type { FrontmatterFile } from '@validate-skills/discover'
import { type Issue, isPlainObject } from '@validate-skills/issue'
import { parse as parseYaml } from 'yaml'

const FRONTMATTER_REGEX = /^---\s*\n([\s\S]*?)---\s*\n?/
const YAML_SPECIAL_CHARS = /[{}[\]*&#!|>%@`]/

function quoteSpecialValues(text: string): string {
  // Pre-process to quote values containing special YAML chars (e.g., glob patterns)
  return text
    .split('\n')
    .map((line) => {
      const match = line.match(/^([a-zA-Z_-]+):\s+(.+)$/)
      if (!match) return line
      const [, key, value] = match
      if (!key || !value) return line
      const trimmed = value.trim()
      if (
        (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'")) ||
        /^[>|][+-]?$/.test(trimmed)
      ) {
        return line
      }
      if (YAML_SPECIAL_CHARS.test(value)) {
        const escaped = value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        return `${key}: "${escaped}"`
      }
      return line
    })
    .join('\n')
}

export type ParsedFrontmatter = {
  raw: string
  data: Record<string, unknown> | null
  body: string
  parseError: string | null
}

export async function readAndParse(
  filePath: string,
): Promise<ParsedFrontmatter> {
  const content = await readFile(filePath, 'utf-8')
  const match = content.match(FRONTMATTER_REGEX)
  if (!match) {
    return {
      raw: '',
      data: null,
      body: content,
      parseError: 'No frontmatter found',
    }
  }
  const raw = match[1] ?? ''
  const body = content.slice(match[0].length)
  try {
    const parsed = parseYaml(quoteSpecialValues(raw))
    if (isPlainObject(parsed)) {
      return { raw, data: parsed, body, parseError: null }
    }
    return {
      raw,
      data: null,
      body,
      parseError: `YAML parsed but result is not an object (got ${typeof parsed}${Array.isArray(parsed) ? ' array' : ''})`,
    }
  } catch (err) {
    return {
      raw,
      data: null,
      body,
      parseError: `YAML parse failed: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

export async function validateFrontmatter(
  file: FrontmatterFile,
): Promise<Issue[]> {
  const parsed = await readAndParse(file.path)
  const issues: Issue[] = []

  if (parsed.parseError) {
    issues.push({
      level: 'error',
      file: file.path,
      message: parsed.parseError,
      code:
        parsed.data === null && parsed.raw === ''
          ? 'frontmatter/missing'
          : 'frontmatter/yaml-parse',
    })
    return issues
  }

  const data = parsed.data ?? {}

  if (file.type === 'agent') {
    if (!data.name || typeof data.name !== 'string') {
      issues.push({
        level: 'error',
        file: file.path,
        message: 'Missing required "name" field',
        code: 'frontmatter/missing-name',
      })
    }
  }

  if (!data.description || typeof data.description !== 'string') {
    issues.push({
      level: 'error',
      file: file.path,
      message: 'Missing required "description" field',
      code: 'frontmatter/missing-description',
    })
  }

  return issues
}
