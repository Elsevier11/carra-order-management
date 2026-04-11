type SmokeCheck = {
  name: string
  ok: boolean
  status?: number
  detail?: string
}

type AuthResponse = {
  token: string
  user: { username: string; role: string }
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env: ${name}`)
  }
  return value
}

async function main() {
  const apiBase = requiredEnv('SMOKE_API_BASE').replace(/\/$/, '')
  const username = process.env.SMOKE_USERNAME
  const password = process.env.SMOKE_PASSWORD
  const checks: SmokeCheck[] = []

  const healthRes = await fetch(`${apiBase}/health`)
  checks.push({ name: 'health', ok: healthRes.ok, status: healthRes.status })

  const listRes = await fetch(`${apiBase}/api/consegne?page=1&pageSize=5&sortBy=dataConsegna&sortDir=desc`)
  checks.push({ name: 'consegne-list', ok: listRes.ok, status: listRes.status })

  const statsRes = await fetch(`${apiBase}/api/consegne/stats`)
  checks.push({ name: 'consegne-stats', ok: statsRes.ok, status: statsRes.status })

  if (username && password) {
    const loginRes = await fetch(`${apiBase}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    const loginOk = loginRes.ok
    checks.push({ name: 'auth-login', ok: loginOk, status: loginRes.status })

    if (loginOk) {
      const auth = (await loginRes.json()) as AuthResponse
      const authHeaders = { Authorization: `Bearer ${auth.token}` }

      const exportRes = await fetch(`${apiBase}/api/consegne/export?sortBy=dataConsegna&sortDir=desc`, {
        headers: authHeaders,
      })
      checks.push({ name: 'consegne-export', ok: exportRes.ok, status: exportRes.status })

      if (auth.user.role === 'admin') {
        const auditRes = await fetch(`${apiBase}/api/audit?page=1&pageSize=5`, { headers: authHeaders })
        checks.push({ name: 'audit-list-admin', ok: auditRes.ok, status: auditRes.status })
      }

      const uploadOrderId = process.env.SMOKE_ATTACHMENT_ORDER_ID
      if (uploadOrderId) {
        const form = new FormData()
        form.append('file', new Blob(['smoke attachment'], { type: 'text/plain' }), 'smoke-check.txt')
        const uploadRes = await fetch(`${apiBase}/api/consegne/${uploadOrderId}/attachments`, {
          method: 'POST',
          headers: authHeaders,
          body: form,
        })
        checks.push({ name: 'attachment-upload', ok: uploadRes.ok, status: uploadRes.status })
      }
    }
  }

  const failed = checks.filter((check) => !check.ok)
  console.table(
    checks.map((check) => ({
      check: check.name,
      ok: check.ok,
      status: check.status ?? '-',
      detail: check.detail ?? '',
    })),
  )

  if (failed.length > 0) {
    throw new Error(`Smoke checks failed: ${failed.map((item) => item.name).join(', ')}`)
  }
}

main().catch((error) => {
  console.error('[smoke-prod] failed', error)
  process.exitCode = 1
})
