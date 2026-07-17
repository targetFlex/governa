import { parsePagination } from './pagination'

describe('parsePagination', () => {
  it('retorna defaults (page=1, pageSize=20) quando query vazia', () => {
    expect(parsePagination({})).toEqual({ page: 1, pageSize: 20 })
  })

  it('usa page/pageSize informados quando válidos', () => {
    expect(parsePagination({ page: '3', pageSize: '10' })).toEqual({ page: 3, pageSize: 10 })
  })

  it('cai no default quando page não é numérico', () => {
    expect(parsePagination({ page: 'abc' })).toEqual({ page: 1, pageSize: 20 })
  })

  it('cai no default quando page é zero ou negativo', () => {
    expect(parsePagination({ page: '0' }).page).toBe(1)
    expect(parsePagination({ page: '-5' }).page).toBe(1)
  })

  it('trava pageSize em 100 (evita listagem completa disfarçada de página)', () => {
    expect(parsePagination({ pageSize: '9999' }).pageSize).toBe(100)
  })

  it('cai no default quando pageSize não é numérico ou é zero/negativo', () => {
    expect(parsePagination({ pageSize: 'xyz' }).pageSize).toBe(20)
    expect(parsePagination({ pageSize: '0' }).pageSize).toBe(20)
  })
})
