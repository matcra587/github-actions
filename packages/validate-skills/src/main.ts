import { existsSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import * as core from '@actions/core'
import { discover } from '@validate-skills/discover'
import { describeRules, type Issue } from '@validate-skills/issue'
import { readMarketplace } from '@validate-skills/parsers/marketplace'
import { validateAgentskills } from '@validate-skills/validators/agentskills'
import { validateFrontmatter } from '@validate-skills/validators/frontmatter'
import { validateMarketplace } from '@validate-skills/validators/marketplace'

export async function main(): Promise<void> {
  const inputPath = core.getInput('path') || '.'
  const root = resolve(inputPath)

  if (!existsSync(root)) {
    core.setFailed(`Path "${root}" does not exist`)
    return
  }

  core.info(`validate-skills scanning ${root}`)
  const discovery = await discover(root)

  const skillFiles = discovery.frontmatter.filter((f) => f.type === 'skill')
  const agentFiles = discovery.frontmatter.filter((f) => f.type === 'agent')
  const commandFiles = discovery.frontmatter.filter((f) => f.type === 'command')

  core.info(
    `Discovered: ${skillFiles.length} skills, ${agentFiles.length} agents, ${commandFiles.length} commands, ${discovery.pluginManifests.length} plugin manifests, ${discovery.marketplace ? '1' : '0'} marketplace.json`,
  )

  if (
    discovery.frontmatter.length === 0 &&
    discovery.pluginManifests.length === 0 &&
    !discovery.marketplace
  ) {
    core.warning(
      `Nothing to validate at "${root}" (no skills, agents, commands, plugin manifests, or marketplace.json found)`,
    )
    core.setOutput('error-count', 0)
    core.setOutput('warning-count', 1)
    return
  }

  const issues: Issue[] = []
  const rel = (p: string) => relative(root, p)

  // Marketplace is parsed once here; both this logging block and the
  // marketplace validator consume the same MarketplaceShape, so the
  // file is read + JSON.parsed exactly once per action invocation.
  const marketplaceShape = discovery.marketplace
    ? await readMarketplace(discovery.marketplace.path)
    : null
  const marketplaceEntryCount = marketplaceShape?.entries.length ?? 0

  // Frontmatter validator
  core.startGroup(
    `Frontmatter validator (${discovery.frontmatter.length} files)`,
  )
  core.info(`Rules: ${describeRules('frontmatter/')}`)
  for (const file of discovery.frontmatter) {
    core.info(`  ✓ ${rel(file.path)} [${file.type}]`)
    issues.push(...(await validateFrontmatter(file)))
  }
  core.endGroup()

  // agentskills validator
  core.startGroup(`agentskills.io spec validator (${skillFiles.length} skills)`)
  core.info(`Rules: ${describeRules('agentskills/')}`)
  for (const file of skillFiles) {
    core.info(`  ✓ ${rel(file.path)}`)
    issues.push(...(await validateAgentskills(file)))
  }
  core.endGroup()

  // Marketplace validator (with per-entry receipt)
  if (discovery.marketplace && marketplaceShape) {
    core.startGroup(
      `Marketplace consistency validator (${marketplaceEntryCount} entries, ${discovery.pluginManifests.length} plugin manifests)`,
    )
    core.info(
      `Rules: ${describeRules('marketplace/')}, ${describeRules('plugin-manifest/')}`,
    )
    for (const entry of marketplaceShape.entries) {
      const name = typeof entry.name === 'string' ? entry.name : '?'
      const source = typeof entry.source === 'string' ? entry.source : '?'
      core.info(`  ✓ ${name} → ${source}`)
    }
    issues.push(
      ...(await validateMarketplace(root, discovery, marketplaceShape)),
    )
    core.endGroup()
  } else {
    core.info(
      'Marketplace consistency validator: no marketplace.json found — skipping',
    )
    issues.push(...(await validateMarketplace(root, discovery, null)))
  }

  // Per-issue annotations
  for (const issue of issues) {
    const props = {
      file: issue.file,
      ...(issue.line ? { startLine: issue.line } : {}),
    }
    if (issue.level === 'error') {
      core.error(`[${issue.code}] ${issue.message}`, props)
    } else {
      core.warning(`[${issue.code}] ${issue.message}`, props)
    }
  }

  const errorCount = issues.filter((i) => i.level === 'error').length
  const warningCount = issues.filter((i) => i.level === 'warning').length
  core.setOutput('error-count', errorCount)
  core.setOutput('warning-count', warningCount)

  // Tally + verdict
  core.info(
    `Checked: ${discovery.frontmatter.length} frontmatter files, ${skillFiles.length} agentskills checks, ${marketplaceEntryCount} marketplace entries, ${discovery.pluginManifests.length} plugin manifests. ${errorCount} error(s), ${warningCount} warning(s).`,
  )
  if (errorCount === 0 && warningCount === 0) {
    core.info('✓ All checks passed')
  }

  // Job summary
  const summary = core.summary
    .addHeading('validate-skills report', 2)
    .addHeading('What was checked', 3)
    .addList([
      `${skillFiles.length} skills (frontmatter + agentskills.io spec)`,
      `${agentFiles.length} agents (frontmatter)`,
      `${commandFiles.length} commands (frontmatter)`,
      `${discovery.pluginManifests.length} plugin manifests (unsupported-fields check)`,
      `${discovery.marketplace ? `marketplace.json — ${marketplaceEntryCount} entries — checked structure, required fields, source paths, duplicates, orphans` : 'no marketplace.json (skipped marketplace checks)'}`,
    ])
    .addHeading('Results', 3)
    .addRaw(`Errors: **${errorCount}**, Warnings: **${warningCount}**`)
    .addBreak()

  if (issues.length > 0) {
    summary.addTable([
      [
        { data: 'Level', header: true },
        { data: 'Code', header: true },
        { data: 'File', header: true },
        { data: 'Message', header: true },
      ],
      ...issues.map((i) => [i.level, i.code, i.file, i.message]),
    ])
  } else {
    summary.addRaw('All checks passed.').addBreak()
  }

  await summary.write()

  if (errorCount > 0) {
    core.setFailed(`${errorCount} validation error(s)`)
  }
}
