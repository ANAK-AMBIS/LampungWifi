import { describe, it, expect } from 'vitest'
import {
  localizeLabel,
  categoryOptions,
  accessTypeOptions,
  passwordSourceOptions,
  quickFilters,
  legalRules,
  defaultSubmissionForm,
} from '../constants.js'

describe('localizeLabel', () => {
  it('translates category labels to Indonesian', () => {
    expect(localizeLabel('Cafe / Coffee Shop')).toBe('Kafe / Kedai Kopi')
    expect(localizeLabel('Coworking Space')).toBe('Ruang Kerja Bersama')
    expect(localizeLabel('Library')).toBe('Perpustakaan')
    expect(localizeLabel('Campus Lounge')).toBe('Area Kampus')
    expect(localizeLabel('Restaurant')).toBe('Restoran')
    expect(localizeLabel('Rest Area')).toBe('Area Istirahat')
  })

  it('translates access type labels', () => {
    expect(localizeLabel('Customer login')).toBe('Login pelanggan')
    expect(localizeLabel('Public WiFi')).toBe('WiFi publik')
    expect(localizeLabel('Open network')).toBe('Jaringan terbuka')
    expect(localizeLabel('Student account')).toBe('Akun mahasiswa')
  })

  it('translates password source labels', () => {
    expect(localizeLabel('Verified by staff')).toBe('Diverifikasi staf')
    expect(localizeLabel('Printed on receipt')).toBe('Tercetak di struk')
    expect(localizeLabel('Displayed on venue signage')).toBe('Tertera di lokasi')
    expect(localizeLabel('Shared by venue owner')).toBe('Dibagikan pemilik tempat')
  })

  it('returns the original value for unknown labels', () => {
    expect(localizeLabel('unknown-label')).toBe('unknown-label')
    expect(localizeLabel('')).toBe('')
  })

  it('returns the original value for falsy inputs', () => {
    expect(localizeLabel(null)).toBe(null)
    expect(localizeLabel(undefined)).toBe(undefined)
  })
})

describe('categoryOptions', () => {
  it('contains all expected categories', () => {
    expect(categoryOptions).toContain('Cafe / Coffee Shop')
    expect(categoryOptions).toContain('Coworking Space')
    expect(categoryOptions).toContain('Library')
    expect(categoryOptions).toContain('Campus Lounge')
    expect(categoryOptions).toContain('Restaurant')
    expect(categoryOptions).toContain('Rest Area')
  })

  it('has 6 categories', () => {
    expect(categoryOptions).toHaveLength(6)
  })
})

describe('accessTypeOptions', () => {
  it('contains expected access types', () => {
    expect(accessTypeOptions.length).toBeGreaterThan(0)
    expect(accessTypeOptions).toContain('Public WiFi')
    expect(accessTypeOptions).toContain('Open network')
  })
})

describe('passwordSourceOptions', () => {
  it('contains expected sources', () => {
    expect(passwordSourceOptions).toContain('Verified by staff')
    expect(passwordSourceOptions).toContain('Displayed on venue signage')
  })
})

describe('quickFilters', () => {
  it('has 4 quick filter items', () => {
    expect(quickFilters).toHaveLength(4)
  })

  it('each item has label, description, and query', () => {
    for (const filter of quickFilters) {
      expect(filter).toHaveProperty('label')
      expect(filter).toHaveProperty('description')
      expect(filter).toHaveProperty('query')
    }
  })
})

describe('legalRules', () => {
  it('has 3 rules', () => {
    expect(legalRules).toHaveLength(3)
  })

  it('each rule is a non-empty string', () => {
    for (const rule of legalRules) {
      expect(typeof rule).toBe('string')
      expect(rule.length).toBeGreaterThan(0)
    }
  })
})

describe('defaultSubmissionForm', () => {
  it('has all required fields', () => {
    const form = defaultSubmissionForm
    expect(form).toHaveProperty('name')
    expect(form).toHaveProperty('category')
    expect(form).toHaveProperty('address')
    expect(form).toHaveProperty('district')
    expect(form).toHaveProperty('wifiAvailable')
    expect(form).toHaveProperty('wifiAccessType')
  })

  it('has default values set', () => {
    const form = defaultSubmissionForm
    expect(form.wifiAvailable).toBe(true)
    expect(form.open24Hours).toBe(false)
    expect(form.hasPowerOutlets).toBe(true)
    expect(form.quietZone).toBe(true)
    expect(form.category).toBe('Cafe / Coffee Shop')
  })
})
