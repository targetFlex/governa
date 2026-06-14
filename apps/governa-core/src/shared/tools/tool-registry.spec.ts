import { ALL_TOOLS, getAllTools } from './tool-registry'

describe('tool-registry', () => {
  it('Given the registry When inspected Then every tool has a non-empty name', () => {
    for (const tool of ALL_TOOLS) {
      expect(typeof tool.name).toBe('string')
      expect(tool.name.length).toBeGreaterThan(0)
      expect(typeof tool.description).toBe('string')
      expect(typeof tool.isWrite).toBe('boolean')
      expect(typeof tool.execute).toBe('function')
    }
  })

  it('Given the registry When inspected Then read_* tools have isWrite=false', () => {
    const reads = ALL_TOOLS.filter(t => t.name.startsWith('read_'))
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every(t => t.isWrite === false)).toBe(true)
  })

  it('Given the registry When inspected Then write_* tools have isWrite=true', () => {
    const writes = ALL_TOOLS.filter(t => t.name.startsWith('write_'))
    expect(writes.length).toBeGreaterThan(0)
    expect(writes.every(t => t.isWrite === true)).toBe(true)
  })

  it('Given a stub tool When execute is called Then it throws (not implemented)', async () => {
    const someTool = ALL_TOOLS[0]
    await expect(someTool.execute(undefined)).rejects.toThrow('integração Protheus')
  })

  it('Given the registry When frozen Then ALL_TOOLS is immutable', () => {
    expect(Object.isFrozen(ALL_TOOLS)).toBe(true)
  })

  it('Given getAllTools When called Then returns the registry instance', () => {
    expect(getAllTools()).toBe(ALL_TOOLS)
  })
})
