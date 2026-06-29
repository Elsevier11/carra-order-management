import { bigint, boolean, integer, jsonb, pgTable, primaryKey, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const commerciali = pgTable('commerciali', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const responsabiliInterni = pgTable('responsabili_interni', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// --- Nuove tabelle anagrafe ---

export const mittentiDisegno = pgTable('mittenti_disegno', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const operai = pgTable('operai', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const vettori = pgTable('vettori', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const cementiTipi = pgTable('cementi_tipi', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  ordine: integer('ordine').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

export const accessoriTipi = pgTable('accessori_tipi', {
  id: serial('id').primaryKey(),
  nome: text('nome').notNull(),
  ordine: integer('ordine').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

// --- Tabella principale ordini ---

export const ordini = pgTable('ordini', {
  id: serial('id').primaryKey(),
  rifto: text('rifto'),
  cliente: text('cliente'),
  tipoImpianto: text('tipo_impianto'),
  dataConsegna: timestamp('data_consegna'),
  cantiere: text('cantiere'),
  dataOrdine: timestamp('data_ordine'),
  referente: text('referente'),
  telefono: text('telefono'),
  referente2: text('referente2'),
  telefono2: text('telefono2'),
  scarico: text('scarico'),
  vascheCav: text('vasche_cav'),
  accessori: text('accessori'),
  operai: text('operai'),
  stato: text('stato').default('IN CORSO'),
  note: text('note'),
  trasporto: boolean('trasporto').notNull().default(false),
  scaricoCarico: boolean('scarico_carico').notNull().default(false),
  accontoPagato: boolean('acconto_pagato').notNull().default(false),
  commercialeId: integer('commerciale_id').references(() => commerciali.id, { onDelete: 'set null' }),
  responsabileInternoId: integer('responsabile_interno_id').references(() => responsabiliInterni.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  externalRef: text('external_ref'),
  // migrato da folder_link → folder_link_documenti
  folderLinkDocumenti: text('folder_link_documenti'),
  folderLinkFoto: text('folder_link_foto'),
  // campi DISEGNO IN GESTIONE
  disegnoSpeditoAt: timestamp('disegno_spedito_at'),
  disegnoMittenteId: integer('disegno_mittente_id').references(() => mittentiDisegno.id, { onDelete: 'set null' }),
  disegnoNote: text('disegno_note'),
  // campi DISEGNO APPROVATO
  disegnoApprovatoAt: timestamp('disegno_approvato_at'),
  massicciataNota: text('massicciata_nota'),
  tipoCariciNota: text('tipo_carici_nota'),
  // campi ASSEGNATO
  lavorazioneAssegnataAt: timestamp('lavorazione_assegnata_at'),
  // campi CONSEGNA PIANIFICATA
  consegnaDataEffettiva: timestamp('consegna_data_effettiva'),
  vettoreId: integer('vettore_id').references(() => vettori.id, { onDelete: 'set null' }),
  bilici: integer('bilici').notNull().default(0),
  ddtPronti: boolean('ddt_pronti').notNull().default(false),
  bancale: boolean('bancale').notNull().default(false),
  chiusini: boolean('chiusini').notNull().default(false),
  caricoVerificato: boolean('carico_verificato').notNull().default(false),
  // tab C.A.M.
  camSiNo: boolean('cam_si_no').notNull().default(false),
  cementiNote: text('cementi_note'),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// --- Tabelle relazione per ordine ---

export const orderOperai = pgTable('order_operai', {
  orderId: integer('order_id').notNull().references(() => ordini.id, { onDelete: 'cascade' }),
  operaioId: integer('operaio_id').notNull().references(() => operai.id, { onDelete: 'cascade' }),
}, (table) => ({
  pk: primaryKey({ columns: [table.orderId, table.operaioId] }),
}))

export const orderCementi = pgTable('order_cementi', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => ordini.id, { onDelete: 'cascade' }),
  tipoId: integer('tipo_id').notNull().references(() => cementiTipi.id, { onDelete: 'cascade' }),
  ordinata: boolean('ordinata').notNull().default(false),
  fatta: boolean('fatta').notNull().default(false),
})

export const orderAccessori = pgTable('order_accessori', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => ordini.id, { onDelete: 'cascade' }),
  tipoId: integer('tipo_id').notNull().references(() => accessoriTipi.id, { onDelete: 'cascade' }),
  ordinata: boolean('ordinata').notNull().default(false),
  fatta: boolean('fatta').notNull().default(false),
})

// --- Tabelle esistenti invariate ---

export const importConfig = pgTable('import_config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

export const appUsers = pgTable('app_users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  role: text('role').notNull(),
  passwordHash: text('password_hash').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
