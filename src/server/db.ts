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
    create table if not exists commerciali (
      id serial primary key,
      nome text not null,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists responsabili_interni (
      id serial primary key,
      nome text not null,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists mittenti_disegno (
      id serial primary key,
      nome text not null,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists operai (
      id serial primary key,
      nome text not null,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists vettori (
      id serial primary key,
      nome text not null,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists cementi_tipi (
      id serial primary key,
      nome text not null,
      ordine integer not null default 0,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists accessori_tipi (
      id serial primary key,
      nome text not null,
      ordine integer not null default 0,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists ordini (
      id serial primary key,
      rifto text,
      cliente text,
      tipo_impianto text,
      data_consegna timestamp,
      cantiere text,
      data_ordine timestamp,
      scarico text,
      vasche_cav text,
      accessori text,
      operai text,
      stato text default 'IN CORSO',
      note text,
      trasporto boolean not null default false,
      scarico_carico boolean not null default false,
      acconto_pagato boolean not null default false,
      commerciale_id integer references commerciali(id) on delete set null,
      responsabile_interno_id integer references responsabili_interni(id) on delete set null,
      created_at timestamp not null default now(),
      external_ref text,
      folder_link_documenti text,
      folder_link_foto text,
      disegno_spedito_at timestamp,
      disegno_mittente_id integer references mittenti_disegno(id) on delete set null,
      disegno_note text,
      massicciata_nota text,
      tipo_carici_nota text,
      lavorazione_assegnata_at timestamp,
      consegna_data_effettiva timestamp,
      vettore_id integer references vettori(id) on delete set null,
      bilici integer not null default 0,
      ddt_pronti boolean not null default false,
      bancale boolean not null default false,
      chiusini boolean not null default false,
      carico_verificato boolean not null default false,
      cam_si_no boolean not null default false
    );
  `)

  await pgClient.unsafe(`
    create table if not exists order_operai (
      order_id integer not null references ordini(id) on delete cascade,
      operaio_id integer not null references operai(id) on delete cascade,
      primary key (order_id, operaio_id)
    );
  `)

  await pgClient.unsafe(`
    create table if not exists order_cementi (
      id serial primary key,
      order_id integer not null references ordini(id) on delete cascade,
      tipo_id integer not null references cementi_tipi(id) on delete cascade,
      ordinata boolean not null default false,
      fatta boolean not null default false
    );
  `)

  await pgClient.unsafe(`
    create table if not exists order_accessori (
      id serial primary key,
      order_id integer not null references ordini(id) on delete cascade,
      tipo_id integer not null references accessori_tipi(id) on delete cascade,
      ordinata boolean not null default false,
      fatta boolean not null default false
    );
  `)

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

  await pgClient.unsafe(`
    create table if not exists commerciali (
      id serial primary key,
      nome text not null,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`
    create table if not exists responsabili_interni (
      id serial primary key,
      nome text not null,
      created_at timestamp not null default now()
    );
  `)

  await pgClient.unsafe(`alter table ordini add column if not exists trasporto boolean not null default false;`)
  await pgClient.unsafe(`alter table ordini add column if not exists scarico_carico boolean not null default false;`)
  await pgClient.unsafe(`alter table ordini add column if not exists acconto_pagato boolean not null default false;`)
  await pgClient.unsafe(`alter table ordini add column if not exists commerciale_id integer references commerciali(id) on delete set null;`)
  await pgClient.unsafe(`alter table ordini add column if not exists responsabile_interno_id integer references responsabili_interni(id) on delete set null;`)
  await pgClient.unsafe(`alter table ordini add column if not exists referente text;`)
  await pgClient.unsafe(`alter table ordini add column if not exists telefono text;`)
  await pgClient.unsafe(`alter table ordini add column if not exists bilici integer not null default 0;`)
  await pgClient.unsafe(`alter table ordini add column if not exists chiusini boolean not null default false;`)
  await pgClient.unsafe(`alter table order_events add column if not exists details jsonb;`)
  await pgClient.unsafe(`update ordini set stato = 'DA ASSEGNARE' where stato = 'IN LAVORAZIONE';`)

  // Cartella di rete per ordine
  await pgClient.unsafe(`alter table ordini add column if not exists folder_link text;`)

  // ERP SQL Server import support
  await pgClient.unsafe(`alter table ordini add column if not exists external_ref text;`)
  await pgClient.unsafe(`
    create unique index if not exists idx_ordini_external_ref
    on ordini(external_ref)
    where external_ref is not null;
  `)
  await pgClient.unsafe(`
    create table if not exists import_config (
      key        text primary key,
      value      text not null,
      updated_at timestamp not null default now()
    );
  `)
  await pgClient.unsafe(`
    insert into import_config (key, value)
    values ('sqlserver_last_import_date', '1970-01-01')
    on conflict (key) do nothing;
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
