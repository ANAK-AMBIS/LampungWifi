import { describe, it, expect } from 'vitest'
import { readFilters, filtersToQuery, searchParamsKey } from '../filters.js'

describe('readFilters', () => {
  it('reads all filter values from URLSearchParams', () => {
    const params = new URLSearchParams('q=kedaton&category=Cafe&speed=fast&outlets=true&open24=true')
    const filters = readFilters(params)
    expect(filters.q).toBe('kedaton')
    expect(filters.category).toBe('Cafe')
    expect(filters.speed).toBe('fast')
    expect(filters.outlets).toBe(true)
    expect(filters.open24).toBe(true)
    expect(filters.wifi).toBe(true)
  })

  it('returns defaults when params is null', () => {
    const filters = readFilters(null)
    expect(filters.q).toBe('')
    expect(filters.category).toBe('all')
    expect(filters.speed).toBe('all')
    expect(filters.outlets).toBe(false)
    expect(filters.open24).toBe(false)
    expect(filters.wifi).toBe(true)
  })

  it('handles plain object params', () => {
    const filters = readFilters({ q: 'cafe', category: 'Library' })
    expect(filters.q).toBe('cafe')
    expect(filters.category).toBe('Library')
  })

  it('handles array values by taking the first element', () => {
    const filters = readFilters({ q: ['test', 'second'] })
    expect(filters.q).toBe('test')
  })

  it('sets wifi to false only when explicitly "false"', () => {
    const filters1 = readFilters(new URLSearchParams('wifi=false'))
    expect(filters1.wifi).toBe(false)

    const filters2 = readFilters(new URLSearchParams('wifi=true'))
    expect(filters2.wifi).toBe(true)

    const filters3 = readFilters(new URLSearchParams(''))
    expect(filters3.wifi).toBe(true)
  })
})

describe('filtersToQuery', () => {
  it('converts filters to query params, omitting defaults', () => {
    const result = filtersToQuery({
      q: 'kedaton',
      category: 'Cafe / Coffee Shop',
      accessType: 'all',
      speed: 'all',
      outlets: true,
      open24: false,
      wifi: true,
    })
    expect(result.q).toBe('kedaton')
    expect(result.category).toBe('Cafe / Coffee Shop')
    expect(result.accessType).toBeUndefined()
    expect(result.speed).toBeUndefined()
    expect(result.outlets).toBe(true)
    expect(result.open24).toBeUndefined()
    expect(result.wifi).toBeUndefined() // true is default
  })

  it('includes wifi=false when explicitly set', () => {
    const result = filtersToQuery({
      q: '',
      category: 'all',
      accessType: 'all',
      speed: 'all',
      outlets: false,
      open24: false,
      wifi: false,
    })
    expect(result.wifi).toBe('false')
  })
})

describe('searchParamsKey', () => {
  it('returns empty string for null params', () => {
    expect(searchParamsKey(null)).toBe('')
  })

  it('returns a stable key from URLSearchParams', () => {
    const params = new URLSearchParams('q=test&category=Cafe')
    const key = searchParamsKey(params)
    expect(key).toBe('q=test&category=Cafe')
  })

  it('returns a stable key from plain object', () => {
    const key = searchParamsKey({ q: 'test', category: 'Library' })
    expect(key).toContain('q=test')
    expect(key).toContain('category=Library')
  })
})
