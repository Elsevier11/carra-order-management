import sql from 'mssql'
import type postgres from 'postgres'

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

export interface ErpConfig {
  server: string
  port: number
  database: string
  user: string
  password: string
  timeoutMs: number
}

export async function resolveErpConfig(pgClient: postgres.Sql): Promise<ErpConfig> {
  const rows = await pgClient<{ key: string; value: string }[]>`
    select key, value from import_config
    where key in (
      'sqlserver_host', 'sqlserver_port', 'sqlserver_database',
      'sqlserver_user', 'sqlserver_password', 'sqlserver_timeout_ms'
    )
  `
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  const host = map['sqlserver_host'] ?? process.env.SQLSERVER_HOST
  if (!host) {
    throw new Error(
      'Parametri ERP non configurati. Configurare la connessione nella pagina Impostazioni.',
    )
  }

  return {
    server: host,
    port: parseInt(map['sqlserver_port'] ?? process.env.SQLSERVER_PORT ?? '1433', 10),
    database: map['sqlserver_database'] ?? process.env.SQLSERVER_DATABASE ?? '',
    user: map['sqlserver_user'] ?? process.env.SQLSERVER_USER ?? '',
    password: map['sqlserver_password'] ?? process.env.SQLSERVER_PASSWORD ?? '',
    timeoutMs: parseInt(
      map['sqlserver_timeout_ms'] ?? process.env.SQLSERVER_QUERY_TIMEOUT_MS ?? '15000',
      10,
    ),
  }
}

function buildSqlConfig(config: ErpConfig, timeoutOverride?: number): sql.config {
  const timeout = timeoutOverride ?? config.timeoutMs
  return {
    server: config.server,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    connectionTimeout: timeout,
    requestTimeout: timeout,
  }
}

export async function testErpConnection(config: ErpConfig): Promise<void> {
  const pool = new sql.ConnectionPool(buildSqlConfig(config, 5000))
  try {
    await pool.connect()
  } finally {
    await pool.close().catch(() => {})
  }
}

type SqlServerConnectionErrorLike = {
  code?: string
  message?: string
  number?: number
  originalError?: {
    code?: string
    message?: string
  }
}

export function describeErpConnectionError(error: unknown, config?: ErpConfig): string {
  const err = error as SqlServerConnectionErrorLike
  const code = (err?.code ?? err?.originalError?.code ?? '').toUpperCase()
  const message = err?.message ?? 'Errore connessione'
  const target = config ? `${config.server}:${config.port}` : 'server ERP'

  if (code === 'ENOTFOUND') {
    return `Host SQL non risolto: ${message}. Verifica il nome server, il DNS o usa l'indirizzo IP di ${target}.`
  }

  if (code === 'ECONNREFUSED') {
    return `Connessione rifiutata su ${target}. Verifica che SQL Server sia avviato, in ascolto sulla porta corretta e raggiungibile dal backend.`
  }

  if (code === 'ETIMEDOUT' || code === 'ETIMEOUT' || code === 'ESOCKET' || code === 'EHOSTUNREACH' || code === 'ENETUNREACH') {
    return `Connessione a ${target} non raggiungibile: controlla rete, firewall e porta SQL Server.`
  }

  if (code === 'ELOGIN' || err?.number === 18456) {
    return `Credenziali SQL non valide per ${target}. Controlla utente e password.`
  }

  if (err?.number === 4060) {
    return `Database SQL non accessibile su ${target}. Controlla il nome database "${config?.database ?? ''}" e i permessi dell'utente.`
  }

  return message
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) {
    return value.toISOString().split('T')[0]
  }
  return String(value)
}

export async function fetchErpOrders(config: ErpConfig, sinceDate: Date): Promise<ErpOrder[]> {
  const pool = new sql.ConnectionPool(buildSqlConfig(config))
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
