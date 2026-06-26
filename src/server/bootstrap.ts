import 'dotenv/config'
import { ensureDatabaseObjects } from './db'

await ensureDatabaseObjects()

console.log('Database bootstrap completed')
