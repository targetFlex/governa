import { canonicalJson } from './canonical-json'

describe('canonicalJson', () => {
  describe('Given a plain object', () => {
    it('When keys are out of alphabetical order, Then output has keys sorted', () => {
      const result = canonicalJson({ z: 1, a: 2, m: 3 })
      expect(result).toBe('{"a":2,"m":3,"z":1}')
    })

    it('When two objects have same keys in different order, Then JSON is identical', () => {
      const a = canonicalJson({ b: 1, a: 2 })
      const b = canonicalJson({ a: 2, b: 1 })
      expect(a).toBe(b)
    })
  })

  describe('Given Date values', () => {
    it('When a Date is present, Then it is serialized as ISO 8601 string', () => {
      const d = new Date('2024-01-15T10:30:00.000Z')
      const result = canonicalJson({ ts: d })
      expect(result).toBe('{"ts":"2024-01-15T10:30:00.000Z"}')
    })
  })

  describe('Given undefined values', () => {
    it('When a field is undefined, Then it is omitted (matches JSON.stringify)', () => {
      const result = canonicalJson({ a: 1, b: undefined })
      expect(result).toBe('{"a":1}')
    })
  })

  describe('Given null values', () => {
    it('When a field is null, Then it is preserved as null', () => {
      const result = canonicalJson({ a: null })
      expect(result).toBe('{"a":null}')
    })
  })

  describe('Given arrays', () => {
    it('When value is an array, Then order is preserved', () => {
      const result = canonicalJson({ items: ['c', 'a', 'b'] })
      expect(result).toBe('{"items":["c","a","b"]}')
    })

    it('When array contains objects, Then each object keys are sorted', () => {
      const result = canonicalJson([{ z: 1, a: 2 }])
      expect(result).toBe('[{"a":2,"z":1}]')
    })
  })

  describe('Given nested objects', () => {
    it('When object is nested, Then all levels are key-sorted', () => {
      const result = canonicalJson({ outer: { z: 1, a: { y: 2, b: 3 } } })
      expect(result).toBe('{"outer":{"a":{"b":3,"y":2},"z":1}}')
    })
  })

  describe('Given primitive values', () => {
    it('When value is a number, Then it is serialized directly', () => {
      expect(canonicalJson(42)).toBe('42')
    })

    it('When value is a string, Then it is serialized directly', () => {
      expect(canonicalJson('hello')).toBe('"hello"')
    })

    it('When value is boolean, Then it is serialized directly', () => {
      expect(canonicalJson(true)).toBe('true')
    })
  })
})
