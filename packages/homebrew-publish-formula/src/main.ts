import { readFile } from 'node:fs/promises'
import * as core from '@actions/core'
import * as github from '@actions/github'
import { findExistingSHA, parseRepo } from '@homebrew/github'
import {
  normalizeVersion,
  parseChecksums,
  parseList,
  parsePlatforms,
} from '@homebrew/parse'
import { renderFormula } from '@homebrew/render'

export async function run(): Promise<void> {
  const token = core.getInput('token', { required: true })
  const tap = core.getInput('tap', { required: true })
  const name = core.getInput('name', { required: true })
  const version = normalizeVersion(core.getInput('version', { required: true }))
  const checksumsFile = core.getInput('checksums-file') || 'dist/checksums.txt'
  const homepage = core
    .getInput('homepage', { required: true })
    .replace(/\/$/, '')
  const binaryName = core.getInput('binary-name') || name

  const checksums = parseChecksums(await readFile(checksumsFile, 'utf8'))
  const formula = renderFormula({
    name,
    className: core.getInput('class') || undefined,
    desc: core.getInput('desc', { required: true }),
    homepage,
    version,
    license: core.getInput('license') || 'MIT',
    platforms: parsePlatforms(core.getInput('platforms')),
    checksums,
    archiveNameTemplate:
      core.getInput('archive-name-template') ||
      '{name}_{version}_{os}_{arch}.tar.gz',
    binaryName,
    modulePath: core.getInput('module-path') || undefined,
    buildPackage: core.getInput('build-package') || '.',
    headURL: core.getInput('head-url') || `${homepage}.git`,
    headBranch: core.getInput('head-branch') || 'main',
    headDependsOn: core.getInput('head-depends-on') || undefined,
    completionArgs: parseList(core.getInput('completion-args')),
    testArgs: core.getInput('test-args'),
    testMatch: core.getInput('test-match') || '{version}',
    livecheck: core.getBooleanInput('livecheck'),
  })

  const formulaPath = `Formula/${name}.rb`
  core.setOutput('formula-path', formulaPath)

  if (core.getBooleanInput('dry-run')) {
    core.info(formula)
    return
  }

  const [owner, repo] = parseRepo(tap)
  const octokit = github.getOctokit(token)
  const branch = core.getInput('branch') || undefined
  const existingSHA = await findExistingSHA(
    octokit,
    owner,
    repo,
    formulaPath,
    branch,
  )
  const message = (core.getInput('commit-message') || '{name}: v{version}')
    .replaceAll('{name}', name)
    .replaceAll('{version}', version)

  const response = await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: formulaPath,
    message,
    content: Buffer.from(formula, 'utf8').toString('base64'),
    sha: existingSHA,
    branch,
  })

  core.setOutput('commit-sha', response.data.commit.sha)
}
