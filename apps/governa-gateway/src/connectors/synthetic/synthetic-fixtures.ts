// ============================================================
// synthetic-fixtures.ts — Dados sintéticos para o piloto sandbox
// Target Flex (Entregável MVP §"Sandbox Target Flex").
//
// Usados pelos conectores sintéticos quando PROTHEUS_MODE=synthetic.
// Nenhum dado real de cliente — apenas fixtures para validar o
// comportamento do orquestrador antes do DPA ser assinado.
// ============================================================

import { PedidoInterno } from '../pedido/pedido.schema'
import { ClienteInterno } from '../cliente/cliente.schema'

export const SYNTHETIC_PEDIDOS: readonly PedidoInterno[] = Object.freeze([
  {
    numeroPedido: '10001',
    clienteId:    'CLI-001',
    loja:         '01',
    dataEmissao:  new Date('2026-07-01T00:00:00.000Z'),
    valorTotal:   1250.00,
    status:       'ABERTO',
    itens: [{ codigoProduto: 'PRD-100', quantidade: 2, precoUnitario: 625.00 }],
  },
  {
    numeroPedido: '10002',
    clienteId:    'CLI-001',
    loja:         '01',
    dataEmissao:  new Date('2026-06-15T00:00:00.000Z'),
    valorTotal:   480.00,
    status:       'ENCERRADO',
    itens: [{ codigoProduto: 'PRD-200', quantidade: 1, precoUnitario: 480.00 }],
  },
  {
    numeroPedido: '10003',
    clienteId:    'CLI-002',
    loja:         '01',
    dataEmissao:  new Date('2026-06-20T00:00:00.000Z'),
    valorTotal:   890.50,
    status:       'BLOQUEADO',
    itens: [{ codigoProduto: 'PRD-300', quantidade: 3, precoUnitario: 296.83 }],
  },
  {
    numeroPedido: '10004',
    clienteId:    'CLI-003',
    loja:         '02',
    dataEmissao:  new Date('2026-07-05T00:00:00.000Z'),
    valorTotal:   2100.00,
    status:       'LIBERADO',
    itens: [{ codigoProduto: 'PRD-400', quantidade: 1, precoUnitario: 2100.00 }],
  },
])

export const SYNTHETIC_CLIENTES: readonly ClienteInterno[] = Object.freeze([
  {
    codigoCliente:   'CLI-001',
    loja:            '01',
    nome:            'Empresa Sintética Um LTDA',
    tipo:            'JURIDICA',
    ativo:           true,
    documentoPseudo: 'synthetic-doc-hash-cli-001',
    emailPseudo:     'synthetic-email-hash-cli-001',
    telefonePseudo:  'synthetic-tel-hash-cli-001',
    endereco: { logradouro: 'Rua Sintética, 100', municipio: 'São Paulo', estado: 'SP', cep: '01000000' },
  },
  {
    codigoCliente:   'CLI-002',
    loja:            '01',
    nome:            'Cliente Sintético Dois',
    tipo:            'FISICA',
    ativo:           true,
    documentoPseudo: 'synthetic-doc-hash-cli-002',
    emailPseudo:     'synthetic-email-hash-cli-002',
    telefonePseudo:  null,
    endereco: { logradouro: 'Av. Teste, 200', municipio: 'Campinas', estado: 'SP', cep: '13000000' },
  },
  {
    codigoCliente:   'CLI-003',
    loja:            '02',
    nome:            'Empresa Sintética Três S.A.',
    tipo:            'JURIDICA',
    ativo:           false,
    documentoPseudo: 'synthetic-doc-hash-cli-003',
    emailPseudo:     null,
    telefonePseudo:  'synthetic-tel-hash-cli-003',
    endereco: { logradouro: 'Rua Fixture, 300', municipio: 'Rio de Janeiro', estado: 'RJ', cep: '20000000' },
  },
])
