import { describe, it, expect } from 'vitest'
import { localizeSpeed, localizeStatus } from '../pageLabels.js'

describe('localizeSpeed', () => {
  it('localizes known speeds', () => {
    expect(localizeSpeed('steady')).toBe('Stabil')
    expect(localizeSpeed('fast')).toBe('Cepat')
    expect(localizeSpeed('ultra')).toBe('Sangat cepat')
  })

  it('falls back to raw value for unknown', () => {
    expect(localizeSpeed('unknown')).toBe('unknown')
    expect(localizeSpeed('all')).toBe('all')
  })
})

describe('localizeStatus', () => {
  it('localizes known statuses', () => {
    expect(localizeStatus('pending')).toBe('Menunggu')
    expect(localizeStatus('approved')).toBe('Disetujui')
    expect(localizeStatus('rejected')).toBe('Ditolak')
  })

  it('falls back to raw value for unknown', () => {
    expect(localizeStatus('custom')).toBe('custom')
  })
})
