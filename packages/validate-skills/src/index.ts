import { main } from '@validate-skills/main'

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error:', err)
  process.exit(2)
})
