import { describe, it, expect } from 'vitest'
import { formatDate, formatMbps, buildMapsUrl } from '../format.js'

describe('formatDate', () => {
  it('formats an ISO date string to Indonesian locale', () => {
    const result = formatDate('2026-05-10T08:00:00.000Z')
    expect(result).toMatch(/Mei/) // Indonesian month name
    expect(result).toContain('2026')
    expect(result).toContain('10')
  })

  it('handles a Date object', () => {
    const result = formatDate(new Date('2026-01-15T12:00:00Z'))
    expect(result).toContain('2026')
    expect(result).toContain('15')
  })

  it('returns a non-empty string', () => {
    const result = formatDate('2026-06-18T00:00:00Z')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatMbps', () => {
  it('formats integer speed values', () => {
    expect(formatMbps(100)).toBe('100')
    expect(formatMbps(50)).toBe('50')
  })

  it('formats decimal speed values to 1 decimal place', () => {
    expect(formatMbps(48.2)).toBe('48.2')
    expect(formatMbps(101.3)).toBe('101.3')
  })

  it('strips unnecessary .0 suffix', () => {
    expect(formatMbps(100.0)).toBe('100')
  })

  it('returns "0" for falsy non-zero values', () => {
    expect(formatMbps(0)).toBe('0')
    expect(formatMbps(null)).toBe('0')
    expect(formatMbps(undefined)).toBe('0')
  })

  it('handles string numbers', () => {
    expect(formatMbps('92.4')).toBe('92.4')
  })
})

describe('buildMapsUrl', () => {
  it('builds a Google Maps URL with coordinates when available', () => {
    const place = { latitude: -5.3839, longitude: 105.2604, address: 'Test Address' }
    const url = buildMapsUrl(place)
    expect(url).toContain('google.com/maps/search')
    expect(url).toContain('-5.3839')
    expect(url).toContain('105.2604')
  })

  it('falls back to address query when coordinates are missing', () => {
    const place = { latitude: null, longitude: null, address: 'Jl. Teuku Umar No.45' }
    const url = buildMapsUrl(place)
    expect(url).toContain('google.com/maps/search')
    expect(url).toContain('Jl.%20Teuku%20Umar%20No.45')
  })

  it('falls back when latitude is 0 and longitude is missing', () => {
    const place = { latitude: 0, longitude: null, address: 'Some Place' }
    const url = buildMapsUrl(place)
    expect(url).toContain('Some%20Place')
  })
})
