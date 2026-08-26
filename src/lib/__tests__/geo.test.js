import { describe, it, expect } from 'vitest'
import { haversineMeters, formatDistance } from '../geo.js'

describe('haversineMeters', () => {
  it('returns ~0 for same point', () => {
    expect(haversineMeters(-5.3839, 105.2604, -5.3839, 105.2604)).toBeCloseTo(0, 5)
  })

  it('distance Kedaton to Labuhan Ratu ~2.8km', () => {
    // Kopi Janji Jiwa Kedaton -> Digital Hub Labuhan Ratu
    const d = haversineMeters(-5.3839, 105.2604, -5.3632, 105.2448)
    expect(d).toBeGreaterThan(2500)
    expect(d).toBeLessThan(3200)
  })

  it('150m radius check', () => {
    // ~0.00135 deg lat ~150m
    const d = haversineMeters(-5.3839, 105.2604, -5.38255, 105.2604)
    expect(d).toBeGreaterThan(130)
    expect(d).toBeLessThan(170)
  })

  it('symmetric', () => {
    const a = haversineMeters(-5.3839, 105.2604, -5.3632, 105.2448)
    const b = haversineMeters(-5.3632, 105.2448, -5.3839, 105.2604)
    expect(a).toBeCloseTo(b, 5)
  })
})

describe('formatDistance', () => {
  it('formats meters', () => {
    expect(formatDistance(42)).toBe('42 m')
    expect(formatDistance(999)).toBe('999 m')
  })
  it('formats km', () => {
    expect(formatDistance(1500)).toBe('1.5 km')
    expect(formatDistance(2800)).toBe('2.8 km')
  })
  it('handles null', () => {
    expect(formatDistance(null)).toBe('—')
  })
})
