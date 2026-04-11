import 'dotenv/config'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from '../db/schema'
import { parseSeedUsersFromEnv } from './user-seed'

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

  await pgClient.unsafe(`
    create table if not exists order_attachments (
      id serial primary key,
      order_id integer not null references ordini(id) on delete cascade,
      file_name text not null,
      mime_type text not null,
      size_bytes bigint not null,
      storage_path text not null,
      uploaded_by text,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create index if not exists idx_order_attachments_order_id_created_at
    on order_attachments(order_id, created_at desc);
  `)

  await pgClient.unsafe(`
    create table if not exists audit_logs (
      id serial primary key,
      username text,
      role text,
      action text not null,
      method text not null,
      path text not null,
      entity text,
      entity_id integer,
      success boolean not null,
      status_code integer not null,
      ip_address text,
      user_agent text,
      details jsonb,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create index if not exists idx_audit_logs_created_at
    on audit_logs(created_at desc);
  `)

  await pgClient.unsafe(`
    create index if not exists idx_audit_logs_username
    on audit_logs(username);
  `)

  await pgClient.unsafe(`
    create table if not exists app_users (
      id serial primary key,
      username text not null unique,
      role text not null,
      password_hash text not null,
      is_active boolean not null default true,
      created_at timestamp not null default now(),
      updated_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create index if not exists idx_app_users_username
    on app_users(username);
  `)

  const seedUsers = parseSeedUsersFromEnv()
  for (const user of seedUsers) {
    await db.execute(sql`
      insert into app_users (username, role, password_hash, is_active)
      values (${user.username}, ${user.role}, ${user.passwordHash}, ${user.isActive !== false})
      on conflict (username) do nothing
    `)
  }
}
