import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

export type AntivirusScanResult = {
  clean: boolean
  scanner: string
  output?: string
}

function execScanner(command: string, args: string[]): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    let output = ''
    child.stdout.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      output += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      resolve({ code: code ?? 1, output: output.trim() })
    })
  })
}

function parseCommand(value: string): { command: string; args: string[] } {
  const parts = value
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean)
  return {
    command: parts[0] ?? '',
    args: parts.slice(1),
  }
}

export async function scanBufferWithAntivirus(buffer: Buffer, originalName: string): Promise<AntivirusScanResult> {
  const scannerCommand = (process.env.ATTACHMENTS_ANTIVIRUS_COMMAND ?? '').trim()
  const scannerMode = (process.env.ATTACHMENTS_ANTIVIRUS_MODE ?? '').trim().toLowerCase()

  if (!scannerCommand && scannerMode !== 'mock') {
    return { clean: true, scanner: 'disabled' }
  }

  const safeName = originalName.replace(/[^A-Za-z0-9._-]/g, '_') || 'upload.bin'
  const tempPath = path.join(os.tmpdir(), `carra_upload_${Date.now()}_${safeName}`)

  await fs.writeFile(tempPath, buffer)
  try {
    if (scannerMode === 'mock') {
      const failPattern = (process.env.ATTACHMENTS_ANTIVIRUS_FAIL_PATTERN ?? 'eicar').toLowerCase()
      const isInfected = safeName.toLowerCase().includes(failPattern)
      return {
        clean: !isInfected,
        scanner: 'mock',
        output: isInfected ? `Mock antivirus blocked file pattern "${failPattern}"` : 'OK',
      }
    }

    const { command, args } = parseCommand(scannerCommand)
    if (!command) {
      return { clean: true, scanner: 'disabled' }
    }
    const resolvedArgs = args.map((item) => item.replaceAll('{file}', tempPath))
    if (!resolvedArgs.some((item) => item.includes(tempPath))) {
      resolvedArgs.push(tempPath)
    }

    const result = await execScanner(command, resolvedArgs)
    return {
      clean: result.code === 0,
      scanner: command,
      output: result.output,
    }
  } finally {
    await fs.rm(tempPath, { force: true })
  }
}
