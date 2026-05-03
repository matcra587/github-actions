import * as core from '@actions/core'
import { run } from '@validate-skills/main'

run().catch((error) => {
  core.setFailed(error instanceof Error ? error.message : String(error))
})
