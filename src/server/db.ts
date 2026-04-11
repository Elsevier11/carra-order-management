import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../db/schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  throw new Error('Missing DATABASE_URL in environment variables')
}

export const pgClient = postgres(connectionString, {
  max: 10,
})

export const db = drizzle(pgClient, { schema })

export async function ensureDatabaseObjects() {
  await pgClient.unsafe(`
    create table if not exists order_events (
      id serial primary key,
      order_id integer not null references ordini(id) on delete cascade,
      event_type text not null,
      from_status text,
      to_status text,
      note text,
      actor text,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create index if not exists idx_order_events_order_id_created_at
    on order_events(order_id, created_at desc);
  `)
}
