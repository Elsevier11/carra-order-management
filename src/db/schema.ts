import { bigint, boolean, decimal, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const ordini = pgTable('ordini', {
  id: serial('id').primaryKey(),
  rifto: text('rifto'),
  cliente: text('cliente'),
  tipoImpianto: text('tipo_impianto'),
  dataConsegna: timestamp('data_consegna'),
  cantiere: text('cantiere'),
  dataOrdine: timestamp('data_ordine'),
  traspor: text('traspor'),
  scarico: text('scarico'),
  vascheCav: text('vasche_cav'),
  accessori: text('accessori'),
  operai: text('operai'),
  stato: text('stato').default('IN CORSO'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const orderAttachments = pgTable('order_attachments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => ordini.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  storagePath: text('storage_path').notNull(),
  uploadedBy: text('uploaded_by'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  username: text('username'),
  role: text('role'),
  action: text('action').notNull(),
  method: text('method').notNull(),
  path: text('path').notNull(),
  entity: text('entity'),
  entityId: integer('entity_id'),
  success: boolean('success').notNull(),
  statusCode: integer('status_code').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  details: jsonb('details'),
  createdAt: timestamp('created_at').defaultNow(),
})
