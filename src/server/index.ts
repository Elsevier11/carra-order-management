import 'dotenv/config'
import { createApp } from './app'
import { ensureDatabaseObjects } from './db'

const app = createApp()
const port = Number(process.env.PORT || 3000)

const runDbBootstrap = process.env.RUN_DB_BOOTSTRAP !== 'false'

if (runDbBootstrap) {
  await ensureDatabaseObjects()
} else {
  console.log('Database bootstrap skipped')
}

app.listen(port, '0.0.0.0', () => {
  console.log(`API server running on http://0.0.0.0:${port}`)
})
