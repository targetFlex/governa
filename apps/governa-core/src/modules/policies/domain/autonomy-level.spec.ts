import { AUTONOMY_LEVELS } from './autonomy-level'

describe('AUTONOMY_LEVELS constant', () => {
  it('Given the constant Then it lists exactly the 3 levels in canonical order', () => {
    expect([...AUTONOMY_LEVELS]).toEqual(['CONSULTIVO', 'ASSISTIDO', 'AUTONOMO'])
  })
})
