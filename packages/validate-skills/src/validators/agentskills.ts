import { basename, dirname } from 'node:path'
import type { FrontmatterFile } from '@validate-skills/discover'
import type { Issue } from '@validate-skills/issue'
import { readAndParse } from '@validate-skills/validators/frontmatter'

const NAME_MAX = 64
const DESCRIPTION_MAX = 1024
const COMPATIBILITY_MAX = 500
// lowercase letters + digits + hyphens; no leading/trailing/consecutive hyphens
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export async function validateAgentskills(
  file: FrontmatterFile,
): Promise<Issue[]> {
  if (file.type !== 'skill') return []
  const parsed = await readAndParse(file.path)
  if (parsed.parseError || !parsed.data) return [] // frontmatter validator handles parse errors
  const data = parsed.data
  const issues: Issue[] = []

  const name = typeof data.name === 'string' ? data.name : null
  if (name) {
    if (name.length > NAME_MAX) {
      issues.push({
        level: 'error',
        file: file.path,
        message: `name "${name}" is ${name.length} chars (max ${NAME_MAX})`,
        code: 'agentskills/name-too-long',
      })
    }
    if (!NAME_PATTERN.test(name)) {
      issues.push({
        level: 'error',
        file: file.path,
        message: `name "${name}" must be lowercase letters/digits/hyphens, no leading/trailing/consecutive hyphens`,
        code: 'agentskills/name-pattern',
      })
    }
    const parentDir = basename(dirname(file.path))
    if (name !== parentDir) {
      issues.push({
        level: 'error',
        file: file.path,
        message: `name "${name}" must match parent directory "${parentDir}"`,
        code: 'agentskills/name-dir-mismatch',
      })
    }
  }

  const description =
    typeof data.description === 'string' ? data.description : null
  if (description && description.length > DESCRIPTION_MAX) {
    issues.push({
      level: 'error',
      file: file.path,
      message: `description is ${description.length} chars (max ${DESCRIPTION_MAX})`,
      code: 'agentskills/description-too-long',
    })
  }

  const compatibility =
    typeof data.compatibility === 'string' ? data.compatibility : null
  if (compatibility && compatibility.length > COMPATIBILITY_MAX) {
    issues.push({
      level: 'warning',
      file: file.path,
      message: `compatibility is ${compatibility.length} chars (recommended max ${COMPATIBILITY_MAX})`,
      code: 'agentskills/compatibility-too-long',
    })
  }

  return issues
}
