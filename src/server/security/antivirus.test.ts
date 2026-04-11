import { afterEach, describe, expect, it } from 'vitest'
import { scanBufferWithAntivirus } from './antivirus'

describe('antivirus hook', () => {
  afterEach(() => {
    delete process.env.ATTACHMENTS_ANTIVIRUS_MODE
    delete process.env.ATTACHMENTS_ANTIVIRUS_FAIL_PATTERN
    delete process.env.ATTACHMENTS_ANTIVIRUS_COMMAND
  })

  it('returns clean when scanner is disabled', async () => {
    const result = await scanBufferWithAntivirus(Buffer.from('safe', 'utf8'), 'safe.txt')
    expect(result.clean).toBe(true)
    expect(result.scanner).toBe('disabled')
  })

  it('blocks file in mock mode by configured pattern', async () => {
    process.env.ATTACHMENTS_ANTIVIRUS_MODE = 'mock'
    process.env.ATTACHMENTS_ANTIVIRUS_FAIL_PATTERN = 'virus'

    const result = await scanBufferWithAntivirus(Buffer.from('unsafe', 'utf8'), 'report-virus.txt')
    expect(result.clean).toBe(false)
    expect(result.scanner).toBe('mock')
  })
})
