import { pgTable, serial, text, timestamp, integer, decimal, boolean } from 'drizzle-orm/pg-core'

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
