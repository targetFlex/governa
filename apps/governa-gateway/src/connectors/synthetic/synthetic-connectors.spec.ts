import { SyntheticPedidoConnector } from './synthetic-pedido.connector'
import { SyntheticClienteConnector } from './synthetic-cliente.connector'
import { SyntheticAuthConnector } from './synthetic-auth.connector'

describe('Conectores sintéticos (piloto sandbox Target Flex)', () => {
  describe('SyntheticPedidoConnector', () => {
    const connector = new SyntheticPedidoConnector()

    it('retorna todos os pedidos quando nenhum filtro é passado', async () => {
      const result = await connector.execute({})
      expect(result.length).toBeGreaterThan(0)
    })

    it('filtra por numeroPedido', async () => {
      const result = await connector.execute({ numeroPedido: '10001' })
      expect(result).toHaveLength(1)
      expect(result[0]!.numeroPedido).toBe('10001')
    })

    it('retorna lista vazia para pedido inexistente', async () => {
      const result = await connector.execute({ numeroPedido: '99999' })
      expect(result).toHaveLength(0)
    })

    it('filtra por clienteId', async () => {
      const result = await connector.execute({ clienteId: 'CLI-001' })
      expect(result.length).toBeGreaterThan(0)
      expect(result.every((p) => p.clienteId === 'CLI-001')).toBe(true)
    })
  })

  describe('SyntheticClienteConnector', () => {
    const connector = new SyntheticClienteConnector()

    it('retorna todos os clientes quando nenhum filtro é passado', async () => {
      const result = await connector.execute({})
      expect(result.length).toBeGreaterThan(0)
    })

    it('filtra por codigoCliente', async () => {
      const result = await connector.execute({ codigoCliente: 'CLI-002' })
      expect(result).toHaveLength(1)
      expect(result[0]!.codigoCliente).toBe('CLI-002')
    })

    it('retorna lista vazia para cliente inexistente', async () => {
      const result = await connector.execute({ codigoCliente: 'CLI-999' })
      expect(result).toHaveLength(0)
    })

    it('filtra por documentoToken', async () => {
      const [alvo] = await connector.execute({ codigoCliente: 'CLI-002' })
      const result = await connector.execute({ documentoToken: alvo!.documentoPseudo })
      expect(result).toHaveLength(1)
      expect(result[0]!.codigoCliente).toBe('CLI-002')
    })

    it('retorna lista vazia para documentoToken inexistente', async () => {
      const result = await connector.execute({ documentoToken: 'hash-que-nao-existe' })
      expect(result).toHaveLength(0)
    })

    describe('executePii', () => {
      it('retorna ClientePiiView para codigoCliente+loja existentes', async () => {
        const result = await connector.executePii({ codigoCliente: 'CLI-002', loja: '01' })
        expect(result).not.toBeNull()
        expect(result?.codigoCliente).toBe('CLI-002')
        expect(result?.nome).toBeTruthy()
      })

      it('retorna null para codigoCliente inexistente', async () => {
        const result = await connector.executePii({ codigoCliente: 'CLI-999', loja: '01' })
        expect(result).toBeNull()
      })

      it('retorna null quando loja não bate', async () => {
        const result = await connector.executePii({ codigoCliente: 'CLI-002', loja: '99' })
        expect(result).toBeNull()
      })
    })
  })

  describe('SyntheticAuthConnector', () => {
    it('retorna token fixo independentemente das credenciais', async () => {
      const connector = new SyntheticAuthConnector()
      const result = await connector.execute({ email: 'qualquer@teste.com', password: 'x' })
      expect(result.token).toBe('synthetic-sandbox-token')
      expect(result.expiresIn).toBeGreaterThan(0)
    })
  })
})
