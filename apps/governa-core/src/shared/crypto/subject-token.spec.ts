import { SubjectTokenHasher, createDefaultSubjectTokenHasher } from './subject-token'

const KEY = 'test-hmac-key-at-least-16-chars'

describe('SubjectTokenHasher', () => {
  describe('Given a valid key (≥ 16 chars)', () => {
    it('When constructed, Then does not throw', () => {
      expect(() => new SubjectTokenHasher(KEY)).not.toThrow()
    })
  })

  describe('Given a key shorter than 16 chars', () => {
    it('When constructed, Then throws', () => {
      expect(() => new SubjectTokenHasher('short')).toThrow(/≥ 16/)
    })

    it('When key is empty, Then throws', () => {
      expect(() => new SubjectTokenHasher('')).toThrow()
    })
  })

  describe('hash()', () => {
    it('When called with the same input, Then produces identical output', () => {
      const hasher = new SubjectTokenHasher(KEY)
      expect(hasher.hash('user-123')).toBe(hasher.hash('user-123'))
    })

    it('When called, Then produces 64-char hex string (HMAC-SHA256)', () => {
      const hasher = new SubjectTokenHasher(KEY)
      const token  = hasher.hash('user-123')
      expect(token).toHaveLength(64)
      expect(token).toMatch(/^[0-9a-f]{64}$/)
    })

    it('When rawSubjectId differs, Then token differs', () => {
      const hasher = new SubjectTokenHasher(KEY)
      expect(hasher.hash('user-A')).not.toBe(hasher.hash('user-B'))
    })

    it('When keys differ, Then same rawSubjectId produces different tokens', () => {
      const h1 = new SubjectTokenHasher('key-one-16chars-ok')
      const h2 = new SubjectTokenHasher('key-two-16chars-ok')
      expect(h1.hash('user-123')).not.toBe(h2.hash('user-123'))
    })

    it('When rawSubjectId is empty, Then throws', () => {
      const hasher = new SubjectTokenHasher(KEY)
      expect(() => hasher.hash('')).toThrow()
    })
  })

  describe('matches()', () => {
    it('When token matches rawSubjectId, Then returns true', () => {
      const hasher = new SubjectTokenHasher(KEY)
      const token  = hasher.hash('user-xyz')
      expect(hasher.matches(token, 'user-xyz')).toBe(true)
    })

    it('When token does not match rawSubjectId, Then returns false', () => {
      const hasher = new SubjectTokenHasher(KEY)
      const token  = hasher.hash('user-xyz')
      expect(hasher.matches(token, 'user-other')).toBe(false)
    })

    it('When token has wrong length, Then returns false without throwing', () => {
      const hasher = new SubjectTokenHasher(KEY)
      expect(hasher.matches('short', 'user-xyz')).toBe(false)
    })
  })
})

describe('createDefaultSubjectTokenHasher', () => {
  afterEach(() => {
    delete process.env.PII_HMAC_KEY
  })

  it('When PII_HMAC_KEY is set, Then returns a SubjectTokenHasher', () => {
    process.env.PII_HMAC_KEY = 'valid-test-key-here'
    const hasher = createDefaultSubjectTokenHasher()
    expect(hasher).toBeInstanceOf(SubjectTokenHasher)
  })

  it('When PII_HMAC_KEY is not set, Then throws', () => {
    delete process.env.PII_HMAC_KEY
    expect(() => createDefaultSubjectTokenHasher()).toThrow(/PII_HMAC_KEY/)
  })
})
