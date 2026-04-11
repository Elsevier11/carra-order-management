import 'dotenv/config'
import { createApp } from './app'
import { ensureDatabaseObjects } from './db'

const app = createApp()
const port = Number(process.env.PORT || 3000)

await ensureDatabaseObjects()

app.listen(port, () => {
  console.log(`API server running on http://localhost:${port}`)
})
