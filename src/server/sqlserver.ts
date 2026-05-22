import sql from 'mssql'

export interface ErpOrder {
  externalRef: string
  rifto: string
  cliente: string
  dataOrdine: string | null
  dataConsegna: string | null
  cantiere: string | null
  agenteNome: string | null
  agenteCodice: string | null
}

function getConfig(): sql.config {
  const host = process.env.SQLSERVER_HOST
  if (!host) {
    throw new Error(
      'Variabile SQLSERVER_HOST non configurata. Impostare le variabili SQLSERVER_* nel file .env',
    )
  }
  return {
    server: host,
    port: process.env.SQLSERVER_PORT ? parseInt(process.env.SQLSERVER_PORT, 10) : 1433,
    database: process.env.SQLSERVER_DATABASE ?? '',
    user: process.env.SQLSERVER_USER ?? '',
    password: process.env.SQLSERVER_PASSWORD ?? '',
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    connectionTimeout: parseInt(process.env.SQLSERVER_QUERY_TIMEOUT_MS ?? '15000', 10),
    requestTimeout: parseInt(process.env.SQLSERVER_QUERY_TIMEOUT_MS ?? '15000', 10),
  }
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  return String(value)
}

export async function fetchErpOrders(sinceDate: Date): Promise<ErpOrder[]> {
  const pool = new sql.ConnectionPool(getConfig())
  await pool.connect()
  try {
    const request = pool.request()
    request.input('sinceDate', sql.DateTime, sinceDate)

    const result = await request.query<{
      NumeroDoc: string
      DataDoc: Date | null
      DataConsegna: Date | null
      Cd_DoSottoCommessa: string | null
      ClienteNome: string | null
      AgenteCodice: string | null
      AgenteNome: string | null
    }>(`
      SELECT TOP 1000
        t.NumeroDoc,
        t.DataDoc,
        t.DataConsegna,
        t.Cd_DoSottoCommessa,
        cf.Descrizione  AS ClienteNome,
        a.Cd_Agente     AS AgenteCodice,
        a.Descrizione   AS AgenteNome
      FROM dbo.DOTes t
      LEFT JOIN dbo.CF     cf ON t.Cd_CF       = cf.Cd_CF
      LEFT JOIN dbo.Agente a  ON t.Cd_Agente_1 = a.Cd_Agente
      WHERE t.Cd_Do   = 'OC '
        AND t.DataDoc >= @sinceDate
      ORDER BY t.DataDoc ASC
    `)

    return result.recordset.map((row) => ({
      externalRef: String(row.NumeroDoc).trim(),
      rifto: String(row.NumeroDoc).trim(),
      cliente: row.ClienteNome?.trim() ?? '',
      dataOrdine: toIsoDate(row.DataDoc),
      dataConsegna: toIsoDate(row.DataConsegna),
      cantiere: row.Cd_DoSottoCommessa?.trim() ?? null,
      agenteNome: row.AgenteNome?.trim() ?? null,
      agenteCodice: row.AgenteCodice?.trim() ?? null,
    }))
  } finally {
    await pool.close()
  }
}
