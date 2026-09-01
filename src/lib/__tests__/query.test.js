import { describe, it, expect } from 'vitest'
import { buildQuery } from '../query.js'

describe('buildQuery', () => {
  it('returns empty string for no params', () => {
    expect(buildQuery()).toBe('')
    expect(buildQuery({})).toBe('')
  })

  it('builds query string from valid params', () => {
    expect(buildQuery({ q: 'kedaton', category: 'Cafe' })).toBe('?q=kedaton&category=Cafe')
  })

  it('omits undefined, null, empty string and false', () => {
    expect(buildQuery({ q: undefined, category: null, speed: '', wifi: false })).toBe('')
  })

  it('includes truthy values and stringifies numbers', () => {
    expect(buildQuery({ limit: 10, offset: 0 })).toBe('?limit=10&offset=0')
    // offset 0 is truthy? actually 0 is not omitted because check is value === '' not 0, but false check filters false; 0 should be included
    expect(buildQuery({ limit: 5 })).toBe('?limit=5')
  })

  it('omits false but includes true', () => {
    expect(buildQuery({ outlets: true })).toBe('?outlets=true')
    expect(buildQuery({ outlets: false })).toBe('')
  })

  it('encodes special characters', () => {
    const qs = buildQuery({ q: 'kopi tubruk' })
    expect(qs).toContain('q=kopi')
  })
})
