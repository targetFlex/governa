// ============================================================
// synthetic-fixtures.ts — Dados sintéticos para o piloto sandbox
// Target Flex (Entregável MVP §"Sandbox Target Flex").
//
// Usados pelos conectores sintéticos quando PROTHEUS_MODE=synthetic.
// Nenhum dado real de cliente — apenas fixtures para validar o
// comportamento do orquestrador antes do DPA ser assinado.
// ============================================================

import { PedidoInterno } from '../pedido/pedido.schema'
import { ClienteInterno, ClientePiiView } from '../cliente/cliente.schema'

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
    nomePseudo:      'synthetic-nome-hash-cli-001',
    tipo:            'JURIDICA',
    ativo:           true,
    documentoPseudo: 'synthetic-doc-hash-cli-001',
    emailPseudo:     'synthetic-email-hash-cli-001',
    telefonePseudo:  'synthetic-tel-hash-cli-001',
    enderecoPseudo:  'synthetic-endereco-hash-cli-001',
  },
  {
    codigoCliente:   'CLI-002',
    loja:            '01',
    nomePseudo:      'synthetic-nome-hash-cli-002',
    tipo:            'FISICA',
    ativo:           true,
    documentoPseudo: 'synthetic-doc-hash-cli-002',
    emailPseudo:     'synthetic-email-hash-cli-002',
    telefonePseudo:  null,
    enderecoPseudo:  'synthetic-endereco-hash-cli-002',
  },
  {
    codigoCliente:   'CLI-003',
    loja:            '02',
    nomePseudo:      'synthetic-nome-hash-cli-003',
    tipo:            'JURIDICA',
    ativo:           false,
    documentoPseudo: 'synthetic-doc-hash-cli-003',
    emailPseudo:     null,
    telefonePseudo:  'synthetic-tel-hash-cli-003',
    enderecoPseudo:  'synthetic-endereco-hash-cli-003',
  },
])

// Contraparte em texto claro de SYNTHETIC_CLIENTES — alimenta o fluxo de
// reidentificação (executePii) sem depender do Protheus real. Nomes/dados
// claramente fictícios, nunca de clientes reais.
export const SYNTHETIC_CLIENTES_PII: readonly ClientePiiView[] = Object.freeze([
  {
    codigoCliente: 'CLI-001',
    loja:          '01',
    nome:          'Empresa Sintética Um LTDA',
    tipo:          'JURIDICA',
    ativo:         true,
    documento:     '11.111.111/0001-11',
    email:         'contato@sintetica-um.example',
    telefone:      '(11) 4000-0001',
    endereco:      'Rua Sintética, 1|São Paulo|SP|01000000',
  },
  {
    codigoCliente: 'CLI-002',
    loja:          '01',
    nome:          'Fulano Sintético da Silva',
    tipo:          'FISICA',
    ativo:         true,
    documento:     '222.222.222-22',
    email:         'fulano.sintetico@example.com',
    telefone:      null,
    endereco:      'Av. Sintética, 200|Campinas|SP|13000000',
  },
  {
    codigoCliente: 'CLI-003',
    loja:          '02',
    nome:          'Comércio Sintético Três SA',
    tipo:          'JURIDICA',
    ativo:         false,
    documento:     '33.333.333/0001-33',
    email:         null,
    telefone:      '(19) 4000-0003',
    endereco:      'Rua Sintética Três, 300|Curitiba|PR|80000000',
  },
])
