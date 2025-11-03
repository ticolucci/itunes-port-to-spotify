import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn utility function', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
    expect(cn('foo', true && 'bar')).toBe('foo bar')
  })

  it('handles undefined and null values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar')
    expect(cn('foo', null, 'bar')).toBe('foo bar')
  })

  it('merges conflicting Tailwind classes correctly', () => {
    // Later classes should override earlier ones
    expect(cn('px-2', 'px-4')).toBe('px-4')
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500')
  })

  it('handles arrays of classes', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar')
    expect(cn(['foo'], 'baz')).toBe('foo baz')
  })

  it('handles objects with boolean values', () => {
    expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
  })

  it('combines all input types', () => {
    expect(
      cn(
        'base-class',
        ['array-class'],
        { 'object-class': true, 'excluded': false },
        undefined,
        'final-class'
      )
    ).toBe('base-class array-class object-class final-class')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})
